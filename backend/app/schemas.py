"""Pydantic request/response models for the API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

RiskLevel = Literal["low", "low_medium", "medium", "medium_high", "high"]
LiquidityNeed = Literal["low", "medium", "high"]
InvestmentType = Literal["monthly", "lumpsum"]
ExistingInvestment = Literal["gold", "equity", "debt", "crypto", "none"]

RISK_LEVELS: frozenset[str] = frozenset(
    {"low", "low_medium", "medium", "medium_high", "high"}
)
LIQUIDITY_NEEDS: frozenset[str] = frozenset({"low", "medium", "high"})
INVESTMENT_TYPES: frozenset[str] = frozenset({"monthly", "lumpsum"})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class SignUpRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Minimum age 18: this product generates real investment allocations, so
    # accounts are restricted to adults. Mirrored by the frontend signup schema.
    age: int = Field(ge=18, le=100)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Name must be at least 2 characters")
        return cleaned

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        checks = (
            (any(c.isupper() for c in value), "an uppercase letter"),
            (any(c.islower() for c in value), "a lowercase letter"),
            (any(c.isdigit() for c in value), "a number"),
            (not value.isalnum(), "a special character"),
        )
        missing = [label for ok, label in checks if not ok]
        if missing:
            raise ValueError(f"Password must contain {', '.join(missing)}")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refreshToken: str = Field(min_length=1)  # noqa: N815 - matches the client contract


class TokenResponse(BaseModel):
    accessToken: str  # noqa: N815 - matches the client contract
    refreshToken: str  # noqa: N815 - matches the client contract


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    email: EmailStr
    age: int


class AuthResponse(BaseModel):
    """What /signup returns; the client then redirects to /login."""

    status: Literal["success"] = "success"
    user: UserResponse


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------
class PortfolioRequest(BaseModel):
    risk_level: str
    investment_amount: int = Field(gt=0, le=10_000_000_000)
    investment_type: str
    duration_years: int = Field(ge=1, le=100)
    liquidity_need: str
    existing_investment: str = "none"
    # The dashboard also collects age. It is not an engine input, but it must
    # match the authenticated account: one person cannot have two ages.
    age: int = Field(ge=18, le=100)

    @field_validator("risk_level", "liquidity_need", "investment_type", mode="before")
    @classmethod
    def _normalise_token(cls, value: object) -> object:
        # Tolerate "Medium" / "MEDIUM" from the client.
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("existing_investment", mode="before")
    @classmethod
    def _normalise_existing(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        cleaned = value.strip().lower()
        # Older clients sent "None"; treat anything empty-ish as "none".
        return "none" if cleaned in {"", "none", "null"} else cleaned


class PortfolioItem(BaseModel):
    asset_name: str
    asset_type: str
    allocation_pct: float
    amount: float = Field(description="Capital allocated to this instrument")
    expected_return_pct: float = Field(description="Indicative annual return, percent")
    min_return_pct: float
    max_return_pct: float


class PortfolioResponse(BaseModel):
    user_id: int
    total_investment: int
    portfolio: list[PortfolioItem]


class HistoryItem(BaseModel):
    """A previously saved configuration."""

    profile_id: int
    risk_level: str
    investment_amount: int
    investment_type: str
    duration_years: int
    liquidity_need: str
    existing_investment: str
    created_at: datetime


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down"]
    version: str