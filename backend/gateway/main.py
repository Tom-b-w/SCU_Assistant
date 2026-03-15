from fastapi import FastAPI
from sqlalchemy import text

from gateway.middleware.cors import setup_cors
from shared.cache import redis_client
from shared.database import engine
from shared.exceptions import register_error_handlers
from gateway.auth.router import router as auth_router
from services.academic.router import router as academic_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="SCU Assistant API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    setup_cors(app)
    register_error_handlers(app)
    app.include_router(auth_router)
    app.include_router(academic_router)

    @app.get("/health")
    async def health_check():
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"

        try:
            await redis_client.ping()
            redis_status = "ok"
        except Exception:
            redis_status = "error"

        status = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
        return {
            "status": status,
            "services": {"database": db_status, "redis": redis_status},
        }

    return app


app = create_app()
