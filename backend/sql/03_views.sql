-- ============================================================================
-- 03_views.sql — reporting views
--
-- NOTE: /generate-portfolio does NOT read this view. Allocation is computed by
-- the Python engine (backend/app/engine.py), which applies the full constraint
-- set (risk + duration + liquidity + amount thresholds + caps + existing
-- holdings) and is unit tested. This view exists as a simplified SQL mirror
-- for ad-hoc inspection in a MySQL client.
-- ============================================================================

USE investment_engine;

DROP VIEW IF EXISTS final_portfolio;

CREATE VIEW final_portfolio AS
WITH eligible AS (
  -- Instruments allowed for this user's strategy, minus explicit disallows.
  SELECT
    u.user_id,
    a.asset_id,
    a.asset_name,
    a.asset_type
  FROM user_profile u
  JOIN investment_type_asset_rules r
    ON r.investment_type = u.investment_type
   AND r.allowed = 'yes'
  JOIN asset_master a
    ON a.asset_id = r.asset_id
  LEFT JOIN risk_asset_constraints rac
    ON rac.risk_level = u.risk_level
   AND rac.asset_id  = a.asset_id
   AND rac.rule      = 'disallow'
  LEFT JOIN duration_asset_constraints dac
    ON dac.duration_bucket = CASE
         WHEN u.duration_years <= 1 THEN 'upto_1'
         WHEN u.duration_years <= 3 THEN '1 -- 3'
         WHEN u.duration_years <= 5 THEN '3 -- 5'
         WHEN u.duration_years <= 8 THEN '5 -- 8'
         ELSE '>8'
       END
   AND dac.asset_id = a.asset_id
   AND dac.rule     = 'disallow'
  LEFT JOIN liquidity_constraints lc
    ON lc.liquidity_need = u.liquidity_need
   AND lc.asset_id       = a.asset_id
   AND lc.rule           = 'disallow'
  WHERE rac.asset_id IS NULL
    AND dac.asset_id IS NULL
    AND lc.asset_id  IS NULL
),
buckets AS (
  -- Risk base allocation tilted by duration and liquidity need.
  SELECT
    u.user_id,
    GREATEST(r.equity_pct + d.equity_adj, 0) AS equity,
    GREATEST(r.debt_pct + d.debt_adj
             - CASE WHEN u.liquidity_need = 'medium' THEN 5 ELSE 0 END, 0) AS debt,
    r.gold_pct AS gold,
    r.safe_pct + CASE WHEN u.liquidity_need = 'medium' THEN 5 ELSE 0 END AS safe,
    r.crypto_pct AS crypto
  FROM user_profile u
  JOIN risk_base_allocation r
    ON r.risk_level = u.risk_level
  JOIN duration_allocation_rules d
    ON d.duration_bucket = CASE
         WHEN u.duration_years <= 1 THEN 'upto_1'
         WHEN u.duration_years <= 3 THEN '1 -- 3'
         WHEN u.duration_years <= 5 THEN '3 -- 5'
         WHEN u.duration_years <= 8 THEN '5 -- 8'
         ELSE '>8'
       END
),
counts AS (
  -- How many eligible instruments sit in each asset class for this user.
  SELECT e.user_id, e.asset_type, COUNT(*) AS total_assets
  FROM eligible e
  GROUP BY e.user_id, e.asset_type
)
SELECT
  e.user_id,
  e.asset_name,
  e.asset_type,
  -- CAST to DECIMAL: both operands here are integer expressions, so without an
  -- explicit cast MySQL performs integer division and silently truncates
  -- (45 / 2 -> 22, losing 3 points). The cast keeps the decimal fraction.
  ROUND(
    CASE e.asset_type
      WHEN 'equity' THEN CAST(b.equity   AS DECIMAL(18,6)) / c.total_assets
      WHEN 'debt'   THEN CAST(b.debt     AS DECIMAL(18,6)) / c.total_assets
      WHEN 'gold'   THEN CAST(b.gold     AS DECIMAL(18,6)) / c.total_assets
      WHEN 'safe'   THEN CAST(b.safe     AS DECIMAL(18,6)) / c.total_assets
      WHEN 'crypto' THEN CAST(b.crypto   AS DECIMAL(18,6)) / c.total_assets
    END, 2) AS allocation_pct
FROM eligible e
JOIN buckets b ON b.user_id = e.user_id
JOIN counts  c ON c.user_id = e.user_id AND c.asset_type = e.asset_type;