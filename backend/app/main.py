"""FastAPI application factory and global error handling."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mysql.connector import Error as MySQLError

from app import __version__
from app.config import get_settings
from app.db import DatabaseUnavailable, ping
from app.routers import auth, portfolio
from app.schemas import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Rule-driven portfolio allocation engine. Reference data lives in "
            "MySQL; the allocation arithmetic lives in app/engine.py."
        ),
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        # An HTTPS page (e.g. the Vercel deployment) calling this API over
        # plain HTTP on localhost is a public-to-private request. Browsers
        # preflight it and silently drop the call without this opt-in — the UI
        # then reports a bare "Network error" while the API is healthy.
        allow_private_network=True,
    )

    @application.exception_handler(DatabaseUnavailable)
    async def _db_unavailable_handler(
        _request: Request, _exc: DatabaseUnavailable
    ) -> JSONResponse:
        logger.error("Database unavailable: %s", _exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Database is unavailable. Please try again shortly."},
        )

    @application.exception_handler(MySQLError)
    async def _mysql_error_handler(_request: Request, exc: MySQLError) -> JSONResponse:
        # Log the detail, return something generic. Stack traces and SQL text
        # must not reach the client.
        logger.exception("Unhandled database error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "A database error occurred."},
        )

    application.include_router(auth.router)
    application.include_router(portfolio.router)

    @application.get("/health", response_model=HealthResponse, tags=["meta"])
    def health() -> HealthResponse:
        """Liveness probe that also reports database reachability."""
        database_up = ping()
        return HealthResponse(
            status="ok" if database_up else "degraded",
            database="up" if database_up else "down",
            version=__version__,
        )

    @application.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": __version__,
            "docs": "/docs",
        }

    return application


app = create_app()