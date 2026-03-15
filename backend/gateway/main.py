from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(
        title="SCU Assistant API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
