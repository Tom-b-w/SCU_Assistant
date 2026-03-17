from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(code="NOT_FOUND", message=message, status=404)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(code="UNAUTHORIZED", message=message, status=401)


class RateLimitError(AppError):
    def __init__(self):
        super().__init__(
            code="RATE_LIMITED", message="Too many requests, please try later", status=429
        )


class SessionExpiredError(AppError):
    def __init__(self, message: str = "教务系统会话已过期，请重新登录"):
        super().__init__(code="SESSION_EXPIRED", message=message, status=403)


class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(code="SERVICE_UNAVAILABLE", message=message, status=503)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code, "message": exc.message, "status": exc.status}},
        )
