-- ============================================================================
-- 00_bootstrap.sql — create the database and the least-privilege app user
--
-- This file owns the database and user lifecycle; 01-03 own the schema and
-- the data. The app connects as 'inv_app', which can only read and write rows.
-- It cannot create or drop tables, so a compromised API cannot destroy the
-- schema.
--
-- The app password is NOT stored in this repository. Set it in the session
-- before sourcing, e.g. from PowerShell:
--
--   mysql -u root -p -e "SET @app_password='choose-a-strong-password'; SOURCE sql/00_bootstrap.sql;"
--
-- The same value must then go into backend/.env as DB_PASSWORD.
--
-- WARNING: this DROPs the investment_engine database, destroying all data.
-- Run it once on a fresh machine, not as part of routine setup.
-- ============================================================================

-- Fail loudly rather than silently creating a user with an empty password.
SET @app_password = NULLIF(@app_password, '');

DROP PROCEDURE IF EXISTS assert_app_password;
DELIMITER //
CREATE PROCEDURE assert_app_password()
BEGIN
  IF @app_password IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Set @app_password before sourcing this file, e.g. mysql -u root -p -e "SET @app_password=''...''; SOURCE sql/00_bootstrap.sql;"';
  END IF;
END//
DELIMITER ;
CALL assert_app_password();
DROP PROCEDURE assert_app_password;

DROP DATABASE IF EXISTS investment_engine;
CREATE DATABASE investment_engine
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

DROP USER IF EXISTS 'inv_app'@'localhost';

-- CREATE USER cannot take a variable directly, so build the statement first.
SET @create_user = CONCAT(
  'CREATE USER ''inv_app''@''localhost'' IDENTIFIED BY ''', @app_password, ''''
);
PREPARE stmt FROM @create_user;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Row-level access only: no CREATE/ALTER/DROP, so a compromised API process
-- cannot destroy or reshape the schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON investment_engine.* TO 'inv_app'@'localhost';

FLUSH PRIVILEGES;

SELECT 'bootstrap complete — now run 01_schema.sql, 02_seed.sql, 03_views.sql' AS next_step;