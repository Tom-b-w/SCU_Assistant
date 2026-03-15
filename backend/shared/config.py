from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/scu_assistant"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string-here"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # LLM
    llm_api_key: str = ""
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"

    # 教务系统
    jwc_use_mock: bool = True
    jwc_base_url: str = "http://zhjw.scu.edu.cn"

    # Rate Limiting
    rate_limit_per_minute: int = 60
    chat_rate_limit_per_minute: int = 20

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
