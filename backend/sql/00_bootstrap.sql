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
-- The same value must then go into backend/.env as DB_PASSWORD (locally) or
-- into the DB_PASSWORD environment variable (hosted).
--
-- The app user is created for @app_user_host, which defaults to 'localhost'.
-- Hosted databases (Aiven, …) are reached over the network, so use '%':
--
--   mysql -h <host> -P <port> -u avnadmin -p -e "SET @app_password='...'; SET @app_user_host='%'; SOURCE sql/00_bootstrap.sql;"
--
-- WARNING: this DROPs the investment_engine database, destroying all data.
-- Run it once on a fresh machine, not as part of routine setup.
-- ============================================================================

-- Fail loudly rather than silently creating a user with an empty password.
SET @app_password = NULLIF(@app_password, '');
SET @app_user_host = COALESCE(NULLIF(@app_user_host, ''), 'localhost');

DROP PROCEDURE IF EXISTS assert_bootstrap_vars;
DELIMITER //
CREATE PROCEDURE assert_bootstrap_vars()
BEGIN
  IF @app_password IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Set @app_password before sourcing this file, e.g. mysql -u root -p -e "SET @app_password=''...''; SOURCE sql/00_bootstrap.sql;"';
  END IF;
  -- The host is concatenated into dynamic SQL below, so only safe literal
  -- values are accepted.
  IF @app_user_host NOT IN ('localhost', '127.0.0.1', '%') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Set @app_user_host to one of localhost, 127.0.0.1 or %.';
  END IF;
END//
DELIMITER ;
CALL assert_bootstrap_vars();
DROP PROCEDURE assert_bootstrap_vars;

DROP DATABASE IF EXISTS investment_engine;
CREATE DATABASE investment_engine
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- CREATE USER / DROP USER / GRANT cannot take variables directly, so each
-- statement is built first.
SET @drop_user = CONCAT(
  'DROP USER IF EXISTS ''inv_app''@''', @app_user_host, ''''
);
PREPARE stmt FROM @drop_user;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_user = CONCAT(
  'CREATE USER ''inv_app''@''', @app_user_host,
  ''' IDENTIFIED BY ''', @app_password, ''''
);
PREPARE stmt FROM @create_user;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Row-level access only: no CREATE/ALTER/DROP, so a compromised API process
-- cannot destroy or reshape the schema.
SET @grant_access = CONCAT(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON investment_engine.* TO ''inv_app''@''',
  @app_user_host, ''''
);
PREPARE stmt FROM @grant_access;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

FLUSH PRIVILEGES;

SELECT 'bootstrap complete — now run 01_schema.sql, 02_seed.sql, 03_views.sql' AS next_step;