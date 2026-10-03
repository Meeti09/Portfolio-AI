"""Authentication endpoints: /signup, /login, /refresh-token, /logout, /me."""

from __future__ import annotations

import logging

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from mysql.connector import Error as MySQLError

from app.db import execute, fetch_one
from app.deps import get_current_user
from app.schemas import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    SignUpRequest,
    TokenResponse,
    UserResponse,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignUpRequest) -> AuthResponse:
    """Create an account. Email is unique, so a duplicate is a 409 not a 500."""
    try:
        execute(
            """
            INSERT INTO users (name, email, password_hash, age)
            VALUES (%s, %s, %s, %s)
            """,
            (
                payload.name,
                str(payload.email).lower(),
                hash_password(payload.password),
                payload.age,
            ),
        )
    except MySQLError as exc:
        if exc.errno == 1062:  # ER_DUP_ENTRY
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with that email already exists",
            ) from exc
        logger.exception("Signup failed for %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the account",
        ) from exc

    row = fetch_one(
        "SELECT user_id, name, email, age FROM users WHERE email = %s",
        (str(payload.email).lower(),),
    )
    if row is None:  # pragma: no cover - the INSERT just succeeded
        raise HTTPException(status_code=500, detail="Could not create the account")

    logger.info("Registered user %s", row["user_id"])
    return AuthResponse(user=UserResponse.model_validate(row))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    """Exchange credentials for an access + refresh token pair."""
    row = fetch_one(
        "SELECT user_id, email, password_hash FROM users WHERE email = %s",
        (str(payload.email).lower(),),
    )

    # Always run a verification so a missing account and a wrong password take
    # a similar amount of time, which avoids leaking which emails exist.
    stored_hash = row["password_hash"] if row else "$2b$12$" + "." * 53
    password_ok = verify_password(payload.password, stored_hash)

    if row is None or not password_ok:
        raise INVALID_CREDENTIALS

    return TokenResponse(
        accessToken=create_access_token(row["user_id"], row["email"]),
        refreshToken=create_refresh_token(row["user_id"]),
    )


@router.post("/refresh-token", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest) -> TokenResponse:
    """Issue a new access token from a valid refresh token.

    The axios response interceptor in the frontend calls this automatically
    after a 401 and replays the original request with the new token.
    """
    try:
        claims = decode_token(payload.refreshToken, expected_type="refresh")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    user_id = int(claims["sub"])
    row = fetch_one("SELECT user_id, email FROM users WHERE user_id = %s", (user_id,))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists",
        )

    return TokenResponse(
        accessToken=create_access_token(row["user_id"], row["email"]),
        refreshToken=create_refresh_token(row["user_id"]),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: UserResponse = Depends(get_current_user)) -> None:
    """Client-side logout.

    Access tokens are stateless and short lived, so there is no server side
    session to destroy. The client discards both tokens; the refresh token then
    expires on its own schedule.
    """


@router.get("/me", response_model=UserResponse)
def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user. Handy for restoring session on reload."""
    return current_user