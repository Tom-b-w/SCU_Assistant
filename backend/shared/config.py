import os
from pathlib import Path

from pydantic_settings import BaseSettings


def _find_env_file() -> str:
    """按优先级查找 env 文件: .env > .env.dev"""
    base_dir = Path(__file__).resolve().parent.parent  # backend/
    for name in (".env", ".env.dev"):
        path = base_dir / name
        if path.exists():
            return str(path)
    return ".env"


class Settings(BaseSettings):
    # Database — 默认使用 SQLite，无需 Docker
    database_url: str = "sqlite+aiosqlite:///./dev_scu.db"

    # Redis — 默认使用内存缓存，无需 Docker
    redis_url: str = "memory://"

    # JWT
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string-here"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # LLM (Anthropic-compatible API)
    llm_api_key: str = ""
    llm_base_url: str = "https://api3.xhub.chat"
    llm_auth_token: str = ""
    llm_model: str = "claude-sonnet-4-20250514"

    # 教务系统
    jwc_use_mock: bool = True
    jwc_base_url: str = "http://zhjw.scu.edu.cn"

    # Embedding 配置
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: str = ""        # 留空则复用 llm_api_key
    embedding_base_url: str = ""       # 留空则复用 llm_base_url

    # ChromaDB 配置
    chroma_persist_dir: str = "./data/chroma"

    # 和风天气 API
    qweather_api_key: str = ""

    # 学习通
    chaoxing_encrypt_key: str = ""

    # Rate Limiting
    rate_limit_per_minute: int = 60
    chat_rate_limit_per_minute: int = 20

    model_config = {"env_file": _find_env_file(), "extra": "ignore"}


settings = Settings()
