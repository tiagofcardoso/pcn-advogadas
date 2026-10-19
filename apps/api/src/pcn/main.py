"""FastAPI application entrypoint and middleware assembly."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from pcn.api.v1.router import api_v1_router
from pcn.core.config import get_settings
from pcn.core.database import dispose_engine, get_session_factory
from pcn.core.errors import AppError
from pcn.core.logging import configure_logging, request_id_ctx
from pcn.core.middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from pcn.core.rate_limit import limiter
from pcn.models.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    try:
        from pcn.seed import run_seed

        await run_seed()
    except Exception:
        logging.getLogger("pcn").exception("Erro na inicialização da base de dados.")
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="App PCN Advogadas API",
        description="Plataforma de Gestão Jurídica, Kanban, Controlo de Tempos, Prazos e Notas de Honorários",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # Rate Limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    allowed_origins = set(settings.BACKEND_CORS_ORIGINS)

    def _cors_headers(request: Request) -> dict[str, str]:
        """500 responses skip CORSMiddleware; echo the Origin only if it is allow-listed."""
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") in allowed_origins:
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin",
            }
        return {}

    # Application error handling
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Full detail goes to the server log only; the client gets a correlation id.
        logging.getLogger("pcn").exception("Erro não tratado na API.")
        return JSONResponse(
            status_code=500,
            headers=_cors_headers(request),
            content={
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Ocorreu um erro interno. Tente novamente ou contacte o suporte.",
                "request_id": request_id_ctx.get(),
            },
        )

    # Middlewares (Pure ASGI order: outer to inner)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS: explicit allow-list only (empty list = no cross-origin access).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["Content-Disposition", "X-Request-ID"],
    )

    # Endpoints
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    @app.get("/healthz", tags=["Saúde do Sistema"])
    async def healthcheck() -> dict[str, Any]:
        """Public liveness probe: reveals nothing about data, versions or internals."""
        db_status = "ok"
        try:
            async with get_session_factory()() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            logging.getLogger("pcn").exception("Healthcheck: falha na base de dados.")
            db_status = "error"
        return {"status": "online", "app": settings.PROJECT_NAME, "database": db_status}

    return app


app = create_app()
