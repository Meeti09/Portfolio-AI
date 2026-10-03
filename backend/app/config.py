"""Application settings, loaded from environment variables / backend/.env."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

_PLACEHOLDER_SECRETS = {"", "replace_with_a_long_random_string", "change_me"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- Application ----
    app_name: str = "investment-engine-api"
    debug: bool = False

    # ---- Database ----
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "investment_engine"
    db_user: str = "inv_app"
    db_password: str = ""
    # How to handle TLS to MySQL. Managed providers differ: Railway accepts
    # plain connections, Aiven mandates TLS with its CA certificate.
    #   PREFERRED: connector default (try TLS, fall back if unsupported)
    #   REQUIRED:  refuse to connect without TLS; set DB_SSL_CA when the
    #              provider issues its own CA certificate
    #   DISABLED:  plain TCP only
    db_ssl_mode: str = "PREFERRED"
    db_ssl_ca: str = ""

    # ---- Auth ----
    jwt_secret: str = Field(default="")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # ---- CORS ----
    # Kept as a plain string so .env can use a readable comma separated list;
    # pydantic-settings would otherwise demand a JSON array.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("db_ssl_mode")
    @classmethod
    def _normalise_ssl_mode(cls, value: str) -> str:
        mode = value.strip().upper()
        if mode not in {"PREFERRED", "REQUIRED", "DISABLED"}:
            raise ValueError(
                "DB_SSL_MODE must be one of PREFERRED, REQUIRED or DISABLED."
            )
        return mode

    @field_validator("jwt_secret")
    @classmethod
    def _reject_placeholder_secret(cls, value: str) -> str:
        if value.strip() in _PLACEHOLDER_SECRETS:
            # Refuse to boot rather than sign tokens with a public secret.
            raise ValueError(
                "JWT_SECRET is missing or still the placeholder value. "
                "Copy .env.example to .env and set a unique secret: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        if len(value) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long.")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()