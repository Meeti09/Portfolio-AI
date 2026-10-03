"""MySQL connection pooling and query helpers."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import mysql.connector
from mysql.connector import Error as MySQLError
from mysql.connector.pooling import MySQLConnectionPool, PooledMySQLConnection

from app.config import BACKEND_DIR, get_settings

logger = logging.getLogger(__name__)

_pool: MySQLConnectionPool | None = None


class DatabaseUnavailable(RuntimeError):
    """Raised when the pool cannot hand out a connection."""


def _connect_kwargs() -> dict[str, Any]:
    """Connection arguments, honouring the configured TLS mode."""
    settings = get_settings()
    kwargs: dict[str, Any] = {
        "host": settings.db_host,
        "port": settings.db_port,
        "database": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password,
        "autocommit": False,
        "charset": "utf8mb4",
        "collation": "utf8mb4_unicode_ci",
    }
    if settings.db_ssl_mode == "DISABLED":
        kwargs["ssl_disabled"] = True
    elif settings.db_ssl_mode == "REQUIRED" and settings.db_ssl_ca:
        # Relative paths resolve against backend/, so the Render blueprint can
        # use DB_SSL_CA=certs/aiven-ca.pem after the provider CA is committed
        # there. A CA certificate is public key material, not a secret.
        ca_path = Path(settings.db_ssl_ca)
        if not ca_path.is_absolute():
            ca_path = BACKEND_DIR / ca_path
        kwargs["ssl_ca"] = str(ca_path)
        kwargs["ssl_verify_cert"] = True
    return kwargs


def get_pool() -> MySQLConnectionPool:
    """Lazily build the process wide connection pool."""
    global _pool
    if _pool is None:
        try:
            _pool = MySQLConnectionPool(
                pool_name="investment_engine_pool",
                pool_size=10,
                pool_reset_session=True,
                **_connect_kwargs(),
            )
        except MySQLError as exc:
            logger.error("Could not create the MySQL connection pool: %s", exc)
            raise DatabaseUnavailable(
                "Database is unreachable. Check backend/.env and that MySQL is running."
            ) from exc
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close_all_connections()
        _pool = None


@contextmanager
def get_connection() -> Iterator[PooledMySQLConnection]:
    """Yield a pooled connection, committing on success and rolling back on error."""
    try:
        conn = get_pool().get_connection()
    except MySQLError as exc:
        logger.error("Failed to check out a connection from the pool: %s", exc)
        raise DatabaseUnavailable("Could not obtain a database connection.") from exc

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor(dictionary: bool = False) -> Iterator[Any]:
    """Yield a cursor from a pooled connection, handling commit/rollback/close."""
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=dictionary)
        try:
            yield cursor
        finally:
            cursor.close()


def fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """Run a SELECT and return all rows as dicts."""
    with get_cursor(dictionary=True) as cursor:
        cursor.execute(sql, params)
        return list(cursor.fetchall())


def fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    """Run a SELECT and return the first row as a dict, or None."""
    with get_cursor(dictionary=True) as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()


def execute(sql: str, params: tuple[Any, ...] = ()) -> int:
    """Run an INSERT/UPDATE/DELETE and return affected row count."""
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(sql, params)
            return cursor.rowcount
        finally:
            cursor.close()


def ping() -> bool:
    """Return True when the database answers a trivial query."""
    try:
        with get_cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone()[0] == 1
    except (MySQLError, DatabaseUnavailable):
        return False