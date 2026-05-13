"""知识库管理服务"""
import hashlib
import logging

from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.rag import embedding, parser, retriever
from shared.config import settings
from shared.llm_client import LLMClient
from shared.models import Document, KnowledgeBase

logger = logging.getLogger(__name__)


async def create_kb(
    db: AsyncSession,
    user_id: int,
    name: str,
    description: str = "",
) -> KnowledgeBase:
    kb = KnowledgeBase(user_id=user_id, name=name, description=description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


async def list_kbs(db: AsyncSession, user_id: int) -> list[KnowledgeBase]:
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == user_id)
        .order_by(KnowledgeBase.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_kb(db: AsyncSession, user_id: int, kb_id: int):
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")
    retriever.delete_collection(kb_id)
    await db.execute(sa_delete(Document).where(Document.kb_id == kb_id))
    await db.delete(kb)
    await db.commit()


async def list_documents(db: AsyncSession, kb_id: int, user_id: int) -> list[Document]:
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")

    result = await db.execute(
        select(Document)
        .where(Document.kb_id == kb_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_document(db: AsyncSession, kb_id: int, doc_id: int, user_id: int) -> None:
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")

    doc = await db.get(Document, doc_id)
    if not doc or doc.kb_id != kb_id:
        raise ValueError("文档不存在")

    retriever.delete_document_chunks(kb_id, doc_id)
    await db.delete(doc)
    kb.document_count = max(0, (kb.document_count or 0) - 1)
    await db.commit()


async def upload_document(db: AsyncSession, kb_id: int, user_id: int,
                          filename: str, file_data: bytes) -> Document:
    """上传文档：解析 -> 分块 -> Embedding -> 写入向量库"""
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")

    # 去重
    file_hash = hashlib.sha256(file_data).hexdigest()
    existing = await db.execute(
        select(Document).where(Document.kb_id == kb_id, Document.file_hash == file_hash)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"文件 {filename} 已存在（内容重复）")

    # 创建文档记录
    doc = Document(kb_id=kb_id, filename=filename, file_hash=file_hash, status="processing")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    try:
        # 解析
        text = parser.parse_file(file_data, filename)
        if not text.strip():
            doc.status = "error"
            await db.commit()
            raise ValueError("文档内容为空")

        # 分块
        chunks = parser.chunk_text(text, max_chars=800, overlap=100)

        # Embedding
        embeddings = await embedding.get_embeddings(chunks)

        # 写入 ChromaDB
        await retriever.add_chunks(kb_id, chunks, embeddings, doc.id, filename)

        # 更新状态
        doc.chunk_count = len(chunks)
        doc.status = "ready"
        kb.document_count = kb.document_count + 1
        await db.commit()

        logger.info("文档 %s 处理完成: %d 个文档块", filename, len(chunks))
        return doc
    except Exception:
        doc.status = "error"
        await db.commit()
        raise


async def rag_query(db: AsyncSession, kb_id: int, user_id: int,
                    question: str, top_k: int = 5) -> dict:
    """RAG 问答：检索相关文档块 -> LLM 生成回答"""
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")

    # 生成查询 Embedding
    query_emb = (await embedding.get_embeddings([question]))[0]

    # 检索
    results = await retriever.search(kb_id, query_emb, top_k=top_k)
    if not results:
        return {
            "answer": "知识库中未找到相关内容，请尝试上传更多资料。",
            "sources": [],
            "usage": None,
        }

    return await _answer_from_results(question, results)


async def rag_query_all(
    db: AsyncSession,
    user_id: int,
    question: str,
    top_k: int = 5,
) -> dict:
    """跨用户所有知识库检索，用于 AI 对话中的知识库搜索工具。"""
    kb_result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == user_id, KnowledgeBase.document_count > 0)
        .order_by(KnowledgeBase.created_at.desc())
    )
    knowledge_bases = list(kb_result.scalars().all())
    if not knowledge_bases:
        return {
            "answer": "你还没有上传可检索的课件或文档，请先在课件问答页面上传资料。",
            "sources": [],
            "usage": None,
        }

    query_emb = (await embedding.get_embeddings([question]))[0]
    merged_results: list[dict] = []
    per_kb = max(1, min(top_k, 5))
    for kb in knowledge_bases:
        kb_results = await retriever.search(kb.id, query_emb, top_k=per_kb)
        for item in kb_results:
            item["kb_id"] = kb.id
            item["kb_name"] = kb.name
            merged_results.append(item)

    if not merged_results:
        return {
            "answer": "知识库中未找到相关内容，请尝试上传更多资料。",
            "sources": [],
            "usage": None,
        }

    merged_results.sort(
        key=lambda item: item.get("distance") if item.get("distance") is not None else 1e9
    )
    return await _answer_from_results(question, merged_results[:top_k])


async def _answer_from_results(question: str, results: list[dict]) -> dict:
    """根据检索结果构建上下文并调用 LLM 生成回答。"""
    context = "\n\n---\n\n".join(
        f"[来源: {r['metadata'].get('filename', '未知')}]\n{r['text']}" for r in results
    )
    sources = [
        {
            "filename": r["metadata"].get("filename", ""),
            "text": r["text"][:200],
            "distance": r.get("distance"),
        }
        for r in results
    ]

    # LLM 生成回答
    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        system = (
            "你是一个学习助手。根据下面提供的参考资料回答用户的问题。"
            "你只能使用参考资料中的信息作答，禁止使用外部知识、常识补充或自行推断。"
            "请在回答中标注引用来源（如 [来源: 文件名]）。"
            "如果参考资料不足以回答，请直接说明“知识库资料中没有相关内容”。"
        )
        prompt = f"参考资料：\n{context}\n\n用户问题：{question}"
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=system,
            max_tokens=2048,
        )
        return {"answer": result["text"], "sources": sources, "usage": result["usage"]}
    except Exception as e:
        logger.warning("RAG LLM 生成失败，返回检索片段作为兜底: %s", e)
        snippets = "\n\n".join(
            f"[来源: {source['filename'] or '未知'}]\n{source['text']}" for source in sources
        )
        return {
            "answer": f"已检索到相关资料，但生成摘要时出错。以下是最相关片段：\n\n{snippets}",
            "sources": sources,
            "usage": None,
        }
    finally:
        await client.close()
