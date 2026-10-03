"""Unit tests for password hashing and JWT handling. No database required."""

from __future__ import annotations

import time

import jwt
import pytest

from app.config import get_settings
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

PASSWORD = "Str0ng!Pass"


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def test_hash_is_not_the_plaintext() -> None:
    assert PASSWORD not in hash_password(PASSWORD)


def test_hash_round_trips() -> None:
    assert verify_password(PASSWORD, hash_password(PASSWORD)) is True


def test_wrong_password_is_rejected() -> None:
    assert verify_password("Wr0ng!Pass", hash_password(PASSWORD)) is False


def test_same_password_hashes_differently_each_time() -> None:
    """Distinct salts mean identical passwords must not share a digest."""
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


def test_malformed_hash_fails_closed() -> None:
    """A corrupt digest must read as a failed login, not raise a 500."""
    assert verify_password(PASSWORD, "not-a-bcrypt-hash") is False
    assert verify_password(PASSWORD, "") is False


def test_unicode_password_works() -> None:
    password = "P@ssw0rd\u20b9\u20b9"
    assert verify_password(password, hash_password(password)) is True


def test_very_long_password_does_not_crash() -> None:
    """bcrypt truncates at 72 bytes; this must not raise."""
    password = "A1!" + "x" * 500
    assert verify_password(password, hash_password(password)) is True


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def test_access_token_round_trips() -> None:
    token = create_access_token(42, "user@example.com")
    claims = decode_token(token, expected_type="access")
    assert int(claims["sub"]) == 42
    assert claims["email"] == "user@example.com"
    assert claims["type"] == "access"


def test_refresh_token_round_trips() -> None:
    token = create_refresh_token(42)
    claims = decode_token(token, expected_type="refresh")
    assert int(claims["sub"]) == 42


def test_tokens_are_unique_per_issue() -> None:
    """Distinct jti means two logins produce two different tokens."""
    assert create_access_token(1, "a@b.c") != create_access_token(1, "a@b.c")


def test_access_token_is_not_accepted_as_refresh() -> None:
    """Otherwise a stolen short-lived token could mint long-lived access."""
    token = create_access_token(1, "a@b.c")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token, expected_type="refresh")


def test_refresh_token_is_not_accepted_as_access() -> None:
    token = create_refresh_token(1)
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token, expected_type="access")


def test_token_signed_with_another_secret_is_rejected() -> None:
    settings = get_settings()
    forged = jwt.encode(
        {"sub": "1", "type": "access", "exp": int(time.time()) + 600},
        "a-completely-different-secret-value-32-chars",
        algorithm="HS256",
    )
    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(forged, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def test_garbage_token_is_rejected() -> None:
    with pytest.raises(jwt.PyJWTError):
        decode_token("not.a.jwt", expected_type="access")


def test_expired_token_is_rejected() -> None:
    settings = get_settings()
    expired = jwt.encode(
        {
            "sub": "1",
            "type": "access",
            "exp": int(time.time()) - 10,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired, expected_type="access")


def test_none_algorithm_token_is_rejected() -> None:
    """The classic JWT bypass: alg=none with no signature."""
    unsigned = jwt.encode({"sub": "1", "type": "access"}, key="", algorithm="none")
    with pytest.raises(jwt.PyJWTError):
        decode_token(unsigned, expected_type="access")


def test_non_numeric_subject_is_rejected() -> None:
    settings = get_settings()
    bad = jwt.encode(
        {
            "sub": "not-a-number",
            "type": "access",
            "exp": int(time.time()) + 600,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(bad, expected_type="access")


# ---------------------------------------------------------------------------
# Configuration guards
# ---------------------------------------------------------------------------
def test_settings_reject_a_placeholder_secret() -> None:
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(jwt_secret="replace_with_a_long_random_string")


def test_settings_reject_a_short_secret() -> None:
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="at least 32 characters"):
        Settings(jwt_secret="tooshort")


def test_cors_origins_split_on_commas() -> None:
    settings = get_settings()
    assert all(" " not in origin for origin in settings.cors_origin_list)
    assert settings.cors_origin_list == [
        origin.strip() for origin in settings.cors_origins.split(",")
    ]


def test_ssl_mode_defaults_to_preferred() -> None:
    from app.config import Settings

    assert Settings(
        jwt_secret="a" * 32, db_ssl_mode="preferred"
    ).db_ssl_mode == "PREFERRED"


def test_ssl_mode_rejects_unknown_values() -> None:
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="DB_SSL_MODE"):
        Settings(jwt_secret="a" * 32, db_ssl_mode="sometimes")


def test_connect_kwargs_honour_disabled_tls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import db
    from app.config import get_settings

    monkeypatch.setenv("DB_SSL_MODE", "DISABLED")
    get_settings.cache_clear()
    try:
        assert db._connect_kwargs()["ssl_disabled"] is True
    finally:
        get_settings.cache_clear()


def test_connect_kwargs_default_to_connector_tls() -> None:
    from app import db

    kwargs = db._connect_kwargs()
    assert "ssl_disabled" not in kwargs
    assert "ssl_ca" not in kwargs


def test_connect_kwargs_resolve_a_relative_ca_against_backend_dir(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import db
    from app.config import BACKEND_DIR, get_settings

    monkeypatch.setenv("DB_SSL_MODE", "REQUIRED")
    monkeypatch.setenv("DB_SSL_CA", "certs/aiven-ca.pem")
    get_settings.cache_clear()
    try:
        kwargs = db._connect_kwargs()
        assert kwargs["ssl_ca"] == str(BACKEND_DIR / "certs/aiven-ca.pem")
        assert kwargs["ssl_verify_cert"] is True
    finally:
        get_settings.cache_clear()