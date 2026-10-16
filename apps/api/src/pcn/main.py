"""FastAPI application entrypoint and middleware assembly."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from pcn.api.v1.router import api_v1_router
from pcn.core.config import get_settings
from pcn.core.database import dispose_engine, get_session_factory
from pcn.core.errors import AppError
from pcn.core.logging import configure_logging
from pcn.core.middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from pcn.core.rate_limit import limiter
from pcn.models.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    try:
        from pcn.seed import run_seed
        await run_seed()
    except Exception as exc:
        import logging
        logging.getLogger("pcn").warning(f"Aviso na inicialização da base de dados: {exc}")
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

    # Middlewares (Pure ASGI order: outer to inner)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.BACKEND_CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["Content-Disposition", "X-Request-ID"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"^https?://.*",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["Content-Disposition", "X-Request-ID"],
        )

    # Endpoints
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    @app.get("/healthz", tags=["Saúde do Sistema"])
    async def healthcheck() -> dict[str, str]:
        return {
            "status": "online",
            "app": settings.PROJECT_NAME,
            "environment": settings.ENVIRONMENT,
        }

    return app


app = create_app()
