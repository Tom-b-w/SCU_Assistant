import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log", mode="w", encoding="utf-8"),
    ],
)

from fastapi import FastAPI
from sqlalchemy import text

from gateway.middleware.cors import setup_cors
from shared.cache import redis_client
from shared.database import engine
from shared.exceptions import register_error_handlers
from gateway.auth.router import router as auth_router
from services.academic.router import router as academic_router
from services.chat.router import router as chat_router
from services.deadline.router import router as deadline_router
from services.rag.router import router as rag_router
from services.quiz.router import router as quiz_router
from services.studyplan.router import router as studyplan_router
from services.weather.router import router as weather_router
from services.notification.router import router as notification_router
from services.briefing.router import router as briefing_router
from services.chaoxing.router import router as chaoxing_router
from services.memory.router import router as memory_router


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
    app.include_router(chat_router)
    app.include_router(deadline_router)
    app.include_router(rag_router)
    app.include_router(quiz_router)
    app.include_router(studyplan_router)
    app.include_router(weather_router)
    app.include_router(notification_router)
    app.include_router(briefing_router)
    app.include_router(chaoxing_router)
    app.include_router(memory_router)

    @app.on_event("startup")
    async def init_db():
        """SQLite 开发环境自动建表"""
        from shared.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    @app.on_event("startup")
    async def seed_data():
        """应用启动时抓取并存储通知数据"""
        from shared.database import async_session
        from services.notification.crawler import seed_notifications
        try:
            async with async_session() as session:
                await seed_notifications(session)
        except Exception as e:
            logging.getLogger(__name__).warning("Seed 通知数据失败: %s", e)

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
