-- ============================================================================
-- 01_schema.sql — investment_engine table definitions
--
-- Run after 00_bootstrap.sql (which owns the database and app user):
--   mysql -u root -p investment_engine < sql/01_schema.sql
--   mysql -u root -p investment_engine < sql/02_seed.sql
--   mysql -u root -p investment_engine < sql/03_views.sql
--
-- Re-runnable: every table this file creates is dropped first, children before
-- parents, so the foreign keys never block the teardown and a second run does
-- not fail on "table already exists".
-- ============================================================================

USE investment_engine;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Drop everything this script creates, children before parents.
-- ---------------------------------------------------------------------------
DROP VIEW  IF EXISTS final_portfolio;
DROP TABLE IF EXISTS user_profile;
DROP TABLE IF EXISTS investment_type_asset_rules;
DROP TABLE IF EXISTS risk_asset_constraints;
DROP TABLE IF EXISTS duration_asset_constraints;
DROP TABLE IF EXISTS liquidity_constraints;
DROP TABLE IF EXISTS asset_master;
-- Standalone reference tables (no foreign keys, but still recreated below).
DROP TABLE IF EXISTS existing_investment_rules;
DROP TABLE IF EXISTS amount_threshold_rules;
DROP TABLE IF EXISTS allocation_caps;
DROP TABLE IF EXISTS return_reference;
DROP TABLE IF EXISTS duration_allocation_rules;
DROP TABLE IF EXISTS risk_base_allocation;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users — authentication accounts
-- NOTE: password_hash holds a bcrypt digest. Plaintext passwords are never
-- stored and never logged.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(60)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  age           INT          NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_age  CHECK (age BETWEEN 1 AND 100)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- asset_master — catalogue of investable instruments
-- ---------------------------------------------------------------------------
CREATE TABLE asset_master (
  asset_id   INT AUTO_INCREMENT PRIMARY KEY,
  asset_name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(50)  NOT NULL,
  CONSTRAINT uq_asset_name UNIQUE (asset_name)
) ENGINE = InnoDB;

CREATE INDEX idx_asset_master_type ON asset_master (asset_type);

-- ---------------------------------------------------------------------------
-- risk_base_allocation — starting bucket weights per risk profile
-- ---------------------------------------------------------------------------
CREATE TABLE risk_base_allocation (
  risk_level  VARCHAR(20) PRIMARY KEY,
  equity_pct  INT NOT NULL,
  debt_pct    INT NOT NULL,
  gold_pct    INT NOT NULL,
  safe_pct    INT NOT NULL,
  crypto_pct  INT NOT NULL,
  CONSTRAINT chk_risk_base_nonneg
    CHECK (equity_pct >= 0 AND debt_pct >= 0 AND gold_pct >= 0
           AND safe_pct >= 0 AND crypto_pct >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- duration_allocation_rules — tilt applied for the investment horizon
-- equity_adj is added to equity, debt_adj is added to debt.
-- ---------------------------------------------------------------------------
CREATE TABLE duration_allocation_rules (
  duration_bucket VARCHAR(20) PRIMARY KEY,
  equity_adj      INT NOT NULL DEFAULT 0,
  debt_adj        INT NOT NULL DEFAULT 0
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- investment_type_asset_rules — which instruments suit monthly vs lumpsum
-- allowed: 'yes' | 'conditional' | 'no'
-- (Table renamed from the original "investment_type_assest_rules" typo.)
-- ---------------------------------------------------------------------------
CREATE TABLE investment_type_asset_rules (
  investment_type VARCHAR(20) NOT NULL,
  asset_id        INT         NOT NULL,
  allowed         VARCHAR(20) NOT NULL DEFAULT 'yes',
  PRIMARY KEY (investment_type, asset_id),
  CONSTRAINT fk_itar_asset
    FOREIGN KEY (asset_id) REFERENCES asset_master (asset_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_itar_allowed
    CHECK (allowed IN ('yes', 'conditional', 'no'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- risk_asset_constraints — per-risk bans and caps on specific instruments
-- rule: 'disallow' | 'limit' | 'max_5' | 'max_10' | 'allow'
-- ---------------------------------------------------------------------------
CREATE TABLE risk_asset_constraints (
  risk_level VARCHAR(20) NOT NULL,
  asset_id   INT         NOT NULL,
  rule       VARCHAR(20) NOT NULL,
  PRIMARY KEY (risk_level, asset_id),
  CONSTRAINT fk_rac_asset
    FOREIGN KEY (asset_id) REFERENCES asset_master (asset_id)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- duration_asset_constraints — horizon-specific instrument rules
-- ---------------------------------------------------------------------------
CREATE TABLE duration_asset_constraints (
  duration_bucket VARCHAR(20) NOT NULL,
  asset_id        INT         NOT NULL,
  rule            VARCHAR(20) NOT NULL,
  PRIMARY KEY (duration_bucket, asset_id),
  CONSTRAINT fk_dac_asset
    FOREIGN KEY (asset_id) REFERENCES asset_master (asset_id)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- liquidity_constraints — instruments allowed per liquidity requirement
-- ---------------------------------------------------------------------------
CREATE TABLE liquidity_constraints (
  liquidity_need VARCHAR(20) NOT NULL,
  asset_id       INT         NOT NULL,
  rule           VARCHAR(20) NOT NULL,
  PRIMARY KEY (liquidity_need, asset_id),
  CONSTRAINT fk_lc_asset
    FOREIGN KEY (asset_id) REFERENCES asset_master (asset_id)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- existing_investment_rules — how to treat an asset class the user already
-- holds heavily. action: 'reduce' | 'cap'
-- ---------------------------------------------------------------------------
CREATE TABLE existing_investment_rules (
  asset_type    VARCHAR(50) PRIMARY KEY,
  threshold_pct INT NOT NULL,
  action        VARCHAR(20) NOT NULL,
  CONSTRAINT chk_eir_action CHECK (action IN ('reduce', 'cap'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- amount_threshold_rules — instrument access by investment size
-- A row applies when investment_amount >= min_amount for that strategy.
-- allowed_assets is a comma separated asset_name list.
-- ---------------------------------------------------------------------------
CREATE TABLE amount_threshold_rules (
  investment_type VARCHAR(20)    NOT NULL,
  min_amount      BIGINT         NOT NULL,
  allowed_assets  VARCHAR(255)   NOT NULL,
  PRIMARY KEY (investment_type, min_amount)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- allocation_caps — hard ceiling per asset class, as a percent of the portfolio
-- ---------------------------------------------------------------------------
CREATE TABLE allocation_caps (
  asset_type VARCHAR(50) PRIMARY KEY,
  max_pct    INT NOT NULL,
  CONSTRAINT chk_caps_range CHECK (max_pct BETWEEN 0 AND 100)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- return_reference — indicative annual return band per asset class, in percent
-- ---------------------------------------------------------------------------
CREATE TABLE return_reference (
  asset_type VARCHAR(50) PRIMARY KEY,
  min_return INT NOT NULL,
  max_return INT NOT NULL,
  CONSTRAINT chk_return_band CHECK (min_return <= max_return)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- user_profile — one saved diagnostic run per authenticated user
-- FK to risk_base_allocation is valid because risk_level is a PK.
-- The old FK to amount_threshold_rules(investment_type) was invalid (that
-- table's PK is the composite (investment_type, min_amount)); the engine
-- validates investment_type in application code instead.
-- ---------------------------------------------------------------------------
CREATE TABLE user_profile (
  profile_id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT         NOT NULL,
  risk_level         VARCHAR(20) NOT NULL,
  investment_amount  BIGINT      NOT NULL,
  investment_type    VARCHAR(20) NOT NULL,
  duration_years     INT         NOT NULL,
  liquidity_need     VARCHAR(20) NOT NULL,
  existing_investment VARCHAR(20) NOT NULL DEFAULT 'none',
  created_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_profile_risk
    FOREIGN KEY (risk_level) REFERENCES risk_base_allocation (risk_level),
  CONSTRAINT uq_profile_user UNIQUE (user_id),
  CONSTRAINT chk_profile_duration CHECK (duration_years >= 1),
  CONSTRAINT chk_profile_amount  CHECK (investment_amount > 0)
) ENGINE = InnoDB;

CREATE INDEX idx_profile_user ON user_profile (user_id);