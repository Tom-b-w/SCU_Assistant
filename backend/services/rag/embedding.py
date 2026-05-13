"""Embedding 生成 -- 调用 OpenAI 兼容 API"""
import hashlib
import logging
import math
import re

from shared.config import settings
from shared.llm_client import LLMClient

logger = logging.getLogger(__name__)

LOCAL_EMBEDDING_DIM = 1536


def _remote_embedding_enabled() -> bool:
    """仅在显式配置或 base_url 明显兼容 embedding API 时尝试远程 embedding。"""
    base_url = settings.embedding_base_url or settings.llm_base_url
    explicit_embedding_config = bool(settings.embedding_api_key or settings.embedding_base_url)
    compatible_base_url = any(
        marker in base_url.lower()
        for marker in ("dashscope.aliyuncs.com", "api.openai.com", "api.deepseek.com", "openai")
    )
    return explicit_embedding_config or compatible_base_url


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    tokens = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]", text)

    compact = re.sub(r"\s+", "", text)
    for i in range(len(compact) - 1):
        pair = compact[i:i + 2]
        if pair.strip():
            tokens.append(pair)

    return tokens


def _local_embedding(text: str) -> list[float]:
    """本地哈希 embedding 兜底，保证无外部 embedding API 时 RAG 仍可检索。"""
    vector = [0.0] * LOCAL_EMBEDDING_DIM
    for token in _tokenize(text):
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big")
        index = value % LOCAL_EMBEDDING_DIM
        sign = 1.0 if (value >> 11) & 1 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(item * item for item in vector))
    if norm == 0:
        return vector
    return [item / norm for item in vector]


def _local_embeddings(texts: list[str]) -> list[list[float]]:
    return [_local_embedding(text) for text in texts]


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """为文本列表生成 embedding 向量。"""
    if not texts:
        return []

    auth_token = settings.embedding_api_key or settings.llm_auth_token
    base_url = settings.embedding_base_url or settings.llm_base_url
    if not auth_token or not _remote_embedding_enabled():
        logger.info("Embedding API 未显式配置，使用本地哈希 embedding 兜底")
        return _local_embeddings(texts)

    client = LLMClient(
        api_key="",
        base_url=base_url,
        model=settings.embedding_model,
        auth_token=auth_token,
        timeout=30.0,
    )
    try:
        all_embeddings: list[list[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = await client.embedding(batch, model=settings.embedding_model)
            all_embeddings.extend(embeddings)
        return all_embeddings
    except Exception as e:
        logger.warning("远程 Embedding API 不可用，回退到本地哈希 embedding: %s", e)
        return _local_embeddings(texts)
    finally:
        await client.close()
