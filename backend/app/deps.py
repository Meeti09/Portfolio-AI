"""Shared FastAPI dependencies."""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import fetch_one
from app.schemas import UserResponse
from app.security import decode_token

# auto_error=False so we can raise our own 403 with a consistent body instead
# of FastAPI's bare 403 for a missing header.
bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserResponse:
    """Resolve the caller's user from a valid access token.

    Raises:
        HTTPException 401 when the header is missing, the token is invalid or
            expired, or the account has since been deleted.
    """
    if credentials is None or not credentials.credentials:
        raise _UNAUTHENTICATED

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    row = fetch_one(
        "SELECT user_id, name, email, age FROM users WHERE user_id = %s",
        (int(payload["sub"]),),
    )
    if row is None:
        raise _UNAUTHENTICATED

    return UserResponse.model_validate(row)


def get_refresh_user_id(refresh_token: str) -> int:
    """Validate a refresh token and return the user id it belongs to."""
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc
    return int(payload["sub"])