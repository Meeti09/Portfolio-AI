-- ============================================================================
-- 02_seed.sql — reference data for the allocation engine
-- Run after 01_schema.sql, before 03_views.sql
-- ============================================================================

USE investment_engine;

-- ---------------------------------------------------------------------------
-- asset_master
-- ---------------------------------------------------------------------------
INSERT INTO asset_master (asset_id, asset_name, asset_type) VALUES
  (1,  'Equity Mutual Fund', 'equity'),
  (2,  'Direct Stocks',      'equity'),
  (3,  'Equity ETF',         'equity'),
  (4,  'Fixed Deposit',      'debt'),
  (5,  'Debt Mutual Fund',   'debt'),
  (6,  'Govt Bonds',         'debt'),
  (7,  'Post Office Schemes','debt'),
  (8,  'Physical Gold',      'gold'),
  (9,  'Savings Account',    'safe'),
  (10, 'Liquid Mutual Fund', 'safe'),
  (11, 'Cryptocurrency',     'crypto'),
  (12, 'PPF',                'long_term'),
  (13, 'NPS',                'long_term');

-- ---------------------------------------------------------------------------
-- risk_base_allocation  (must sum to 100 per row)
-- ---------------------------------------------------------------------------
INSERT INTO risk_base_allocation
  (risk_level, equity_pct, debt_pct, gold_pct, safe_pct, crypto_pct) VALUES
  ('low',         15, 50, 20, 15,  0),
  ('low_medium',  30, 40, 15, 15,  0),
  ('medium',      50, 30, 10, 10,  0),
  ('medium_high', 60, 20, 10,  5,  5),
  ('high',        65, 15,  5,  5, 10);

-- ---------------------------------------------------------------------------
-- duration_allocation_rules
-- Bucket mapping lives in the engine (see BUCKET_BY_DURATION in engine.py):
--   1 yr    -> 'upto_1'  | 2-3 yrs -> '1 -- 3' | 4-5 yrs -> '3 -- 5'
--   6-8 yrs -> '5 -- 8'  | 9+ yrs  -> '>8'
-- The first bucket is 'upto_1' rather than '<1' because duration_years has a
-- minimum of 1, which would make a strict '<1' bucket unreachable.
-- ---------------------------------------------------------------------------
INSERT INTO duration_allocation_rules (duration_bucket, equity_adj, debt_adj) VALUES
  ('upto_1',      -25,  25),
  ('1 -- 3',  -15,  15),
  ('3 -- 5',    0,   0),
  ('5 -- 8',   10, -10),
  ('>8',       15, -15);

-- ---------------------------------------------------------------------------
-- investment_type_asset_rules
-- 'yes'         = standard for this strategy
-- 'conditional' = usable, subject to the risk/horizon/liquidity/cap rules
-- Every asset class in risk_base_allocation needs at least one instrument per
-- strategy, otherwise the engine has to orphan that bucket and redistribute it.
-- PPF/NPS are asset_type 'long_term' and are funded from the debt bucket.
-- ---------------------------------------------------------------------------
INSERT INTO investment_type_asset_rules (investment_type, asset_id, allowed) VALUES
  -- monthly: equity + safe (Liquid MF) + debt (PPF) + crypto
  ('monthly',  1, 'yes'),         -- Equity Mutual Fund   equity
  ('monthly',  2, 'conditional'), -- Direct Stocks        equity
  ('monthly',  3, 'yes'),         -- Equity ETF           equity
  ('monthly', 10, 'yes'),         -- Liquid Mutual Fund   safe
  ('monthly', 11, 'conditional'), -- Cryptocurrency       crypto
  ('monthly', 12, 'yes'),         -- PPF                  long_term -> debt
  -- lumpsum: debt + gold + safe + equity + crypto
  ('lumpsum',  1, 'yes'),         -- Equity Mutual Fund   equity
  ('lumpsum',  3, 'yes'),         -- Equity ETF           equity
  ('lumpsum',  4, 'yes'),         -- Fixed Deposit        debt
  ('lumpsum',  5, 'yes'),         -- Debt Mutual Fund     debt
  ('lumpsum',  6, 'yes'),         -- Govt Bonds           debt
  ('lumpsum',  8, 'yes'),         -- Physical Gold        gold
  ('lumpsum',  9, 'yes'),         -- Savings Account      safe
  ('lumpsum', 11, 'conditional'), -- Cryptocurrency       crypto
  ('lumpsum', 13, 'yes');         -- NPS                  long_term -> debt

-- ---------------------------------------------------------------------------
-- risk_asset_constraints
-- ---------------------------------------------------------------------------
INSERT INTO risk_asset_constraints (risk_level, asset_id, rule) VALUES
  ('low',          2, 'disallow'),
  ('low',         11, 'disallow'),
  ('low_medium', 11, 'disallow'),
  ('medium',      11, 'disallow'),
  ('medium_high', 11, 'max_5'),
  ('high',        11, 'max_10');

-- ---------------------------------------------------------------------------
-- duration_asset_constraints
-- ---------------------------------------------------------------------------
INSERT INTO duration_asset_constraints (duration_bucket, asset_id, rule) VALUES
  ('upto_1',      2, 'disallow'),
  ('upto_1',      1, 'limit'),
  ('1 -- 3',  2, 'limit'),
  ('5 -- 8',  2, 'allow'),
  ('>8',      2, 'allow');

-- ---------------------------------------------------------------------------
-- liquidity_constraints
-- ---------------------------------------------------------------------------
INSERT INTO liquidity_constraints (liquidity_need, asset_id, rule) VALUES
  ('high',   4, 'disallow'),
  ('high',   6, 'disallow'),
  ('high',   2, 'disallow'),
  ('medium', 4, 'limit'),
  ('low',    4, 'allow');

-- ---------------------------------------------------------------------------
-- existing_investment_rules
-- The frontend sends 'none' when the user holds nothing notable.
-- ---------------------------------------------------------------------------
INSERT INTO existing_investment_rules (asset_type, threshold_pct, action) VALUES
  ('gold',   20, 'reduce'),
  ('debt',   50, 'reduce'),
  ('equity', 70, 'reduce'),
  ('crypto',  5, 'cap');

-- ---------------------------------------------------------------------------
-- amount_threshold_rules
-- The largest min_amount at or below the user's amount that matches their
-- investment_type determines the eligible instrument list. Every name listed
-- here must also appear in investment_type_asset_rules for that strategy,
-- otherwise the size gate would silently empty a bucket.
-- ---------------------------------------------------------------------------
INSERT INTO amount_threshold_rules (investment_type, min_amount, allowed_assets) VALUES
  ('monthly',   100, 'Equity Mutual Fund,Liquid Mutual Fund'),
  ('monthly',  1000, 'Equity Mutual Fund,Equity ETF,Liquid Mutual Fund'),
  ('monthly',  5000, 'Equity Mutual Fund,Equity ETF,Liquid Mutual Fund,PPF'),
  ('lumpsum',  5000, 'Fixed Deposit,Debt Mutual Fund'),
  ('lumpsum', 25000, 'Debt Mutual Fund,Fixed Deposit,Govt Bonds,Savings Account'),
  ('lumpsum',100000, 'Debt Mutual Fund,Fixed Deposit,Govt Bonds,Savings Account,Equity Mutual Fund,Equity ETF,Physical Gold');

-- ---------------------------------------------------------------------------
-- allocation_caps
-- ---------------------------------------------------------------------------
INSERT INTO allocation_caps (asset_type, max_pct) VALUES
  ('equity', 75),
  ('crypto', 10),
  ('gold',   25);

-- ---------------------------------------------------------------------------
-- return_reference  (indicative annual %, not a forecast)
-- ---------------------------------------------------------------------------
INSERT INTO return_reference (asset_type, min_return, max_return) VALUES
  ('equity',    8, 14),
  ('debt',      4,  7),
  ('gold',      5,  8),
  ('safe',      2,  4),
  ('crypto',   -20, 30),
  ('long_term', 7, 12);