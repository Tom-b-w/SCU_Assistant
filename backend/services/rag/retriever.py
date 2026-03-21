"""ChromaDB 向量检索"""
from __future__ import annotations

import chromadb
import logging

from shared.config import settings

logger = logging.getLogger(__name__)

_chroma_client: chromadb.PersistentClient | None = None


def get_chroma() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _chroma_client


def collection_name(kb_id: int) -> str:
    return f"kb_{kb_id}"


async def add_chunks(kb_id: int, chunks: list[str], embeddings: list[list[float]],
                     doc_id: int, filename: str):
    """将文档块写入 ChromaDB。"""
    chroma = get_chroma()
    col = chroma.get_or_create_collection(collection_name(kb_id))
    ids = [f"doc{doc_id}_chunk{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_idx": i}
                 for i in range(len(chunks))]
    col.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
    logger.info("KB %d: 写入 %d 个文档块", kb_id, len(chunks))


async def search(kb_id: int, query_embedding: list[float],
                 top_k: int = 5) -> list[dict]:
    """向量相似度检索，返回 top_k 个最相关文档块。"""
    chroma = get_chroma()
    try:
        col = chroma.get_collection(collection_name(kb_id))
    except Exception:
        return []
    results = col.query(query_embeddings=[query_embedding], n_results=top_k)
    items = []
    for i in range(len(results["ids"][0])):
        items.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            "distance": results["distances"][0][i] if results["distances"] else None,
        })
    return items


def delete_collection(kb_id: int):
    """删除知识库对应的 ChromaDB collection。"""
    chroma = get_chroma()
    try:
        chroma.delete_collection(collection_name(kb_id))
    except Exception:
        pass
