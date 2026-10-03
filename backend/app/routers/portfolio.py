"""Portfolio generation endpoints."""

from __future__ import annotations

import logging
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import execute, fetch_all, fetch_one
from app.deps import get_current_user
from app.engine import RuleError, build_allocation, duration_bucket
from app.schemas import (
    HistoryItem,
    PortfolioItem,
    PortfolioRequest,
    PortfolioResponse,
    UserResponse,
)

HTTP_422_UNPROCESSABLE_CONTENT = 422

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portfolio"])

_ALLOWED_RISK = {"low", "low_medium", "medium", "medium_high", "high"}
_ALLOWED_LIQUIDITY = {"low", "medium", "high"}
_ALLOWED_INVESTMENT_TYPE = {"monthly", "lumpsum"}
_ALLOWED_EXISTING = {"gold", "equity", "debt", "crypto", "none"}

_UPSERT_PROFILE = """
INSERT INTO user_profile
  (user_id, risk_level, investment_amount, investment_type,
   duration_years, liquidity_need, existing_investment)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
  risk_level          = VALUES(risk_level),
  investment_amount   = VALUES(investment_amount),
  investment_type     = VALUES(investment_type),
  duration_years      = VALUES(duration_years),
  liquidity_need      = VALUES(liquidity_need),
  existing_investment = VALUES(existing_investment)
"""


def _validate(payload: PortfolioRequest) -> None:
    """Reject values the rule tables cannot answer for."""
    checks = (
        (payload.risk_level, _ALLOWED_RISK, "risk_level"),
        (payload.liquidity_need, _ALLOWED_LIQUIDITY, "liquidity_need"),
        (payload.investment_type, _ALLOWED_INVESTMENT_TYPE, "investment_type"),
        (payload.existing_investment, _ALLOWED_EXISTING, "existing_investment"),
    )
    for value, allowed, field in checks:
        if value not in allowed:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unsupported {field}: {value!r}. Expected one of {sorted(allowed)}.",
            )


@router.post("/generate-portfolio", response_model=PortfolioResponse)
def generate_portfolio(
    payload: PortfolioRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> PortfolioResponse:
    """Run the allocation engine for the authenticated user.

    The saved profile is upserted, so a user always has exactly one active
    configuration rather than an ever-growing pile of orphaned rows.
    """
    _validate(payload)

    # The dashboard age is not an engine input, but it must agree with the
    # account created at signup. Rejecting here (as well as in the UI) stops a
    # request from being processed under two different ages.
    if payload.age != current_user.age:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                f"Age {payload.age} does not match the age "
                f"({current_user.age}) on this account."
            ),
        )

    try:
        allocations = build_allocation(
            risk_level=payload.risk_level,
            investment_type=payload.investment_type,
            duration_years=payload.duration_years,
            liquidity_need=payload.liquidity_need,
            investment_amount=payload.investment_amount,
            existing_investment=payload.existing_investment,
        )
    except RuleError as exc:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    if not allocations:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No instrument is eligible for this combination. "
            "Try a larger amount or a different strategy.",
        )

    execute(
        _UPSERT_PROFILE,
        (
            current_user.user_id,
            payload.risk_level,
            payload.investment_amount,
            payload.investment_type,
            payload.duration_years,
            payload.liquidity_need,
            payload.existing_investment,
        ),
    )

    logger.info(
        "Generated %d positions for user %s (%s, %d years -> %s)",
        len(allocations),
        current_user.user_id,
        payload.investment_type,
        payload.duration_years,
        duration_bucket(payload.duration_years),
    )

    return PortfolioResponse(
        user_id=current_user.user_id,
        total_investment=payload.investment_amount,
        portfolio=[PortfolioItem(**asdict(a)) for a in allocations],
    )


@router.get("/profile", response_model=PortfolioResponse)
def get_saved_profile(
    current_user: UserResponse = Depends(get_current_user),
) -> PortfolioResponse:
    """Return the user's current saved allocation without recomputing it."""
    profile = fetch_one(
        """
        SELECT user_id, investment_amount, risk_level, investment_type,
               duration_years, liquidity_need, existing_investment
        FROM user_profile WHERE user_id = %s
        """,
        (current_user.user_id,),
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No saved profile yet. Run a configuration first.",
        )

    try:
        allocations = build_allocation(
            risk_level=profile["risk_level"],
            investment_type=profile["investment_type"],
            duration_years=profile["duration_years"],
            liquidity_need=profile["liquidity_need"],
            investment_amount=profile["investment_amount"],
            existing_investment=profile["existing_investment"],
        )
    except RuleError as exc:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"The saved profile can no longer be evaluated: {exc}",
        ) from exc

    return PortfolioResponse(
        user_id=profile["user_id"],
        total_investment=profile["investment_amount"],
        portfolio=[PortfolioItem(**asdict(a)) for a in allocations],
    )


@router.get("/history", response_model=list[HistoryItem])
def list_history(
    current_user: UserResponse = Depends(get_current_user),
    limit: int = 20,
) -> list[HistoryItem]:
    """Saved configurations for this user, most recent first."""
    limit = max(1, min(limit, 100))
    rows = fetch_all(
        """
        SELECT profile_id, risk_level, investment_amount, investment_type,
               duration_years, liquidity_need, existing_investment, created_at
        FROM user_profile
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (current_user.user_id, limit),
    )
    return [HistoryItem.model_validate(row) for row in rows]