"""Embedding 生成 -- 调用 OpenAI 兼容 API"""
import logging

from shared.llm_client import LLMClient
from shared.config import settings

logger = logging.getLogger(__name__)


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """为文本列表生成 embedding 向量。"""
    auth_token = settings.embedding_api_key or settings.llm_auth_token
    base_url = settings.embedding_base_url or settings.llm_base_url
    if not auth_token:
        raise RuntimeError("Embedding API key 未配置")
    client = LLMClient(api_key="", base_url=base_url, model=settings.embedding_model, auth_token=auth_token)
    try:
        all_embeddings: list[list[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = await client.embedding(batch, model=settings.embedding_model)
            all_embeddings.extend(embeddings)
        return all_embeddings
    finally:
        await client.close()
