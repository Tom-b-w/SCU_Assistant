# AI 模块实施计划（谭博文 — AI 组）

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SCU Assistant 构建完整的 AI 能力层，包括 RAG 文档问答、智能出题、复习计划生成、用户记忆，参考 DeepTutor 的双循环推理架构。

**Architecture:** 在现有 FastAPI 后端上新增 `services/rag/` 模块，使用 ChromaDB 作为向量数据库（纯 Python，无需额外基础设施），PyMuPDF 解析 PDF/PPT，通过 LLM API 生成 Embedding 和回答。重构现有 chat service，将 PowerShell+curl 调用替换为 httpx 异步客户端，并增强 Function Calling 工具链。

**Tech Stack:** FastAPI, httpx, ChromaDB, PyMuPDF, python-pptx, tiktoken, Pydantic

---

## 文件结构

```
backend/
├── services/
│   ├── chat/
│   │   ├── service.py          # [修改] 重构 LLM 调用为 httpx
│   │   ├── tools.py            # [修改] 新增 RAG 搜索、出题等工具
│   │   ├── schemas.py          # [修改] 新增 ChatHistory 等 schema
│   │   └── router.py           # [修改] 新增历史记录端点
│   ├── rag/                    # [新增] RAG 服务模块
│   │   ├── __init__.py
│   │   ├── service.py          # 知识库管理（创建/删除/查询）
│   │   ├── parser.py           # 文档解析（PDF/PPT → 文本块）
│   │   ├── embedding.py        # Embedding 生成（调用 LLM API）
│   │   ├── retriever.py        # 向量检索 + 上下文构建
│   │   ├── router.py           # RAG API 端点
│   │   └── schemas.py          # Pydantic 模型
│   ├── quiz/                   # [新增] 智能出题模块
│   │   ├── __init__.py
│   │   ├── service.py          # 出题逻辑（基于 RAG 检索 + LLM 生成）
│   │   ├── router.py           # 出题 API 端点
│   │   └── schemas.py
│   └── studyplan/              # [新增] 复习计划模块
│       ├── __init__.py
│       ├── service.py          # 复习计划生成逻辑
│       ├── router.py
│       └── schemas.py
├── shared/
│   ├── config.py               # [修改] 新增 RAG/Embedding 配置
│   ├── models.py               # [修改] 新增 KnowledgeBase, ChatHistory, UserMemory 模型
│   └── llm_client.py           # [新增] 统一 LLM 客户端（替代 curl 调用）
└── tests/
    ├── test_llm_client.py      # [新增]
    ├── test_rag_parser.py      # [新增]
    ├── test_rag_service.py     # [新增]
    └── test_quiz_service.py    # [新增]
```

---

## Chunk 1: LLM 客户端重构 + 基础设施

### Task 1: 统一 LLM 客户端

**Files:**
- Create: `backend/shared/llm_client.py`
- Modify: `backend/shared/config.py`
- Test: `backend/tests/test_llm_client.py`

- [ ] **Step 1: 新增 Embedding 配置到 config.py**

在 `backend/shared/config.py` 的 `Settings` 类中新增：

```python
# Embedding 配置
embedding_model: str = "text-embedding-3-small"
embedding_api_key: str = ""        # 留空则复用 llm_api_key
embedding_base_url: str = ""       # 留空则复用 llm_base_url

# ChromaDB 配置
chroma_persist_dir: str = "./data/chroma"
```

- [ ] **Step 2: 创建 llm_client.py — 写测试**

```python
# backend/tests/test_llm_client.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.shared.llm_client import LLMClient

@pytest.mark.asyncio
async def test_chat_completion_returns_text():
    client = LLMClient(
        api_key="test-key",
        base_url="https://fake.api",
        model="test-model",
    )
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "content": [{"type": "text", "text": "Hello!"}],
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }
    with patch.object(client._http, "post", new_callable=AsyncMock, return_value=mock_response):
        result = await client.chat([{"role": "user", "content": "Hi"}])
    assert result["text"] == "Hello!"
    assert result["usage"]["input_tokens"] == 10

@pytest.mark.asyncio
async def test_chat_completion_with_tools():
    client = LLMClient(api_key="k", base_url="https://fake", model="m")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "content": [{"type": "tool_use", "id": "t1", "name": "get_schedule", "input": {}}],
        "stop_reason": "tool_use",
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }
    with patch.object(client._http, "post", new_callable=AsyncMock, return_value=mock_response):
        result = await client.chat(
            [{"role": "user", "content": "今天有什么课"}],
            tools=[{"name": "get_schedule", "description": "...", "input_schema": {}}],
        )
    assert result["stop_reason"] == "tool_use"
    assert result["tool_calls"][0]["name"] == "get_schedule"
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd E:/SCU_Assistant/backend && python -m pytest tests/test_llm_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.shared.llm_client'`

- [ ] **Step 4: 实现 llm_client.py**

```python
# backend/shared/llm_client.py
"""统一 LLM 客户端 — 替代 PowerShell+curl 调用"""
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)

class LLMClient:
    """Anthropic Messages API 异步客户端"""

    def __init__(self, api_key: str, base_url: str, model: str,
                 auth_token: str = "", timeout: float = 180.0):
        self.model = model
        self._api_key = api_key
        self._auth_token = auth_token
        headers = {"content-type": "application/json", "anthropic-version": "2023-06-01"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        else:
            headers["x-api-key"] = api_key
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        tools: list[dict] | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        """调用 Anthropic Messages API，返回标准化结果。"""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            payload["system"] = system
        if tools:
            payload["tools"] = tools

        resp = await self._http.post("/v1/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()

        # 标准化返回
        result: dict[str, Any] = {
            "text": "",
            "tool_calls": [],
            "stop_reason": data.get("stop_reason", "end_turn"),
            "usage": data.get("usage", {}),
            "raw": data,
        }
        for block in data.get("content", []):
            if block["type"] == "text":
                result["text"] += block["text"]
            elif block["type"] == "tool_use":
                result["tool_calls"].append({
                    "id": block["id"],
                    "name": block["name"],
                    "input": block.get("input", {}),
                })
        return result

    async def embedding(
        self,
        texts: list[str],
        model: str | None = None,
    ) -> list[list[float]]:
        """调用 OpenAI 兼容的 Embedding API。"""
        payload = {
            "model": model or "text-embedding-3-small",
            "input": texts,
        }
        resp = await self._http.post("/v1/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]

    async def close(self):
        await self._http.aclose()
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd E:/SCU_Assistant/backend && python -m pytest tests/test_llm_client.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/shared/llm_client.py backend/shared/config.py backend/tests/test_llm_client.py
git commit -m "feat(ai): 新增统一 LLM 客户端，替代 PowerShell+curl 调用"
```

---

### Task 2: 重构 chat service 使用新客户端

**Files:**
- Modify: `backend/services/chat/service.py`
- Modify: `backend/services/chat/tools.py`

- [ ] **Step 1: 重构 service.py — 使用 LLMClient**

将 `chat_completion()` 函数中的 PowerShell/curl 调用替换为 `LLMClient.chat()`：

```python
# backend/services/chat/service.py
import json
import logging
from backend.shared.llm_client import LLMClient
from backend.shared.config import settings
from .tools import TOOLS_DEFINITION, execute_tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "你是「小川」，四川大学智能校园助手。你可以帮助同学查询课表、成绩、DDL 等信息。"
    "回答时请亲切友好，适当使用 emoji。如果涉及学术信息不确定时，建议同学通过教务系统确认。"
)

def _get_llm_client() -> LLMClient:
    return LLMClient(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        auth_token=settings.llm_auth_token,
    )

async def chat_completion(messages: list[dict], user_info: dict,
                          db=None, redis_client=None) -> dict:
    """AI 对话主函数（支持 Function Calling）"""
    if not settings.llm_api_key and not settings.llm_auth_token:
        return {"reply": "AI 服务未配置，请联系管理员。", "usage": None}

    client = _get_llm_client()
    try:
        # 构建工具列表
        tools = None
        student_id = user_info.get("student_id")
        user_id = user_info.get("user_id")
        if student_id and db and redis_client:
            tools = TOOLS_DEFINITION

        # 第一轮：可能触发工具调用
        api_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
        result = await client.chat(api_messages, system=SYSTEM_PROMPT, tools=tools)
        total_usage = result["usage"]

        # 如果需要执行工具
        if result["stop_reason"] == "tool_use" and result["tool_calls"]:
            tool_call = result["tool_calls"][0]
            tool_result = await execute_tool(
                tool_call["name"], tool_call["input"],
                student_id, user_id, redis_client, db,
            )
            # 第二轮：将工具结果交给 LLM 生成最终回答
            api_messages.append({"role": "assistant", "content": result["raw"]["content"]})
            api_messages.append({
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_call["id"],
                             "content": tool_result}],
            })
            result2 = await client.chat(api_messages, system=SYSTEM_PROMPT)
            # 合并 token 用量
            if result2["usage"]:
                total_usage = {
                    "input_tokens": total_usage.get("input_tokens", 0) + result2["usage"].get("input_tokens", 0),
                    "output_tokens": total_usage.get("output_tokens", 0) + result2["usage"].get("output_tokens", 0),
                }
            return {"reply": result2["text"], "usage": total_usage}

        return {"reply": result["text"], "usage": total_usage}
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        return {"reply": "抱歉，AI 服务暂时不可用，请稍后再试。", "usage": None}
    finally:
        await client.close()
```

- [ ] **Step 2: 验证现有聊天功能正常**

手动测试：启动服务后调用 `POST /api/chat/completions`，确认对话和工具调用都正常。

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat/service.py
git commit -m "refactor(chat): 使用 LLMClient 替代 PowerShell+curl 调用"
```

---

### Task 3: 新增数据库模型

**Files:**
- Modify: `backend/shared/models.py`
- Create: `backend/alembic/versions/xxxx_add_rag_models.py` (via alembic)

- [ ] **Step 1: 在 models.py 中新增 KnowledgeBase、Document、ChatHistory、UserMemory 模型**

在 `backend/shared/models.py` 末尾新增：

```python
class KnowledgeBase(Base):
    """知识库"""
    __tablename__ = "knowledge_bases"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    document_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Document(Base):
    """知识库文档"""
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    kb_id = Column(Integer, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False)      # SHA-256 去重
    chunk_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")       # pending / processing / ready / error
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ChatHistory(Base):
    """对话历史"""
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, index=True)  # UUID
    role = Column(String(20), nullable=False)             # user / assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserMemory(Base):
    """用户记忆（偏好、习惯）"""
    __tablename__ = "user_memories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False)         # taste / campus / study_habit / ...
    key = Column(String(200), nullable=False)
    value = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint("user_id", "category", "key"),)
```

- [ ] **Step 2: 生成 Alembic 迁移**

Run: `cd E:/SCU_Assistant/backend && alembic revision --autogenerate -m "add_rag_and_memory_models"`

- [ ] **Step 3: 执行迁移**

Run: `cd E:/SCU_Assistant/backend && alembic upgrade head`

- [ ] **Step 4: Commit**

```bash
git add backend/shared/models.py backend/alembic/versions/
git commit -m "feat(models): 新增知识库、文档、对话历史、用户记忆数据模型"
```

---

## Chunk 2: RAG 文档问答管线

### Task 4: 文档解析器

**Files:**
- Create: `backend/services/rag/__init__.py`
- Create: `backend/services/rag/parser.py`
- Test: `backend/tests/test_rag_parser.py`

- [ ] **Step 1: 安装依赖**

```bash
cd E:/SCU_Assistant/backend
pip install PyMuPDF python-pptx chromadb tiktoken
```

并在 `pyproject.toml` 的 `dependencies` 中添加：
```
"PyMuPDF>=1.24.0",
"python-pptx>=1.0.0",
"chromadb>=0.5.0",
"tiktoken>=0.7.0",
```

- [ ] **Step 2: 写解析器测试**

```python
# backend/tests/test_rag_parser.py
import pytest
from backend.services.rag.parser import chunk_text, parse_pdf_bytes, parse_pptx_bytes

def test_chunk_text_splits_by_size():
    text = "Hello world. " * 100  # ~1300 chars
    chunks = chunk_text(text, max_chars=500, overlap=50)
    assert len(chunks) >= 2
    assert all(len(c) <= 550 for c in chunks)  # max_chars + overlap tolerance

def test_chunk_text_empty():
    assert chunk_text("") == []
    assert chunk_text("   ") == []

def test_chunk_text_short():
    chunks = chunk_text("Short text.")
    assert chunks == ["Short text."]
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd E:/SCU_Assistant/backend && python -m pytest tests/test_rag_parser.py -v`

- [ ] **Step 4: 实现 parser.py**

```python
# backend/services/rag/parser.py
"""文档解析：PDF/PPT → 文本块"""
import io
import logging
from typing import BinaryIO

logger = logging.getLogger(__name__)


def chunk_text(text: str, max_chars: int = 800, overlap: int = 100) -> list[str]:
    """将长文本按段落/句子边界切分为重叠块。"""
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + max_chars
        if end >= len(text):
            chunks.append(text[start:].strip())
            break
        # 尝试在句号/换行处断句
        best = -1
        for sep in ["\n\n", "\n", "。", ". ", "；", "！", "？"]:
            pos = text.rfind(sep, start + max_chars // 2, end)
            if pos > best:
                best = pos + len(sep)
        if best <= start:
            best = end
        chunks.append(text[start:best].strip())
        start = best - overlap
    return [c for c in chunks if c]


def parse_pdf_bytes(data: bytes, filename: str = "") -> str:
    """解析 PDF 文件字节流，返回全文文本。"""
    import fitz  # PyMuPDF
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages)


def parse_pptx_bytes(data: bytes, filename: str = "") -> str:
    """解析 PPTX 文件字节流，返回全文文本。"""
    from pptx import Presentation
    prs = Presentation(io.BytesIO(data))
    slides_text = []
    for i, slide in enumerate(prs.slides, 1):
        parts = [f"[Slide {i}]"]
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    t = para.text.strip()
                    if t:
                        parts.append(t)
            if shape.has_table:
                for row in shape.table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells)
                    if row_text.strip("| "):
                        parts.append(row_text)
        slides_text.append("\n".join(parts))
    return "\n\n".join(slides_text)


def parse_file(data: bytes, filename: str) -> str:
    """根据文件扩展名选择解析器。"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return parse_pdf_bytes(data, filename)
    elif ext in ("pptx", "ppt"):
        return parse_pptx_bytes(data, filename)
    elif ext in ("txt", "md"):
        return data.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"不支持的文件类型: .{ext}")
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd E:/SCU_Assistant/backend && python -m pytest tests/test_rag_parser.py -v`

- [ ] **Step 6: Commit**

```bash
git add backend/services/rag/ backend/tests/test_rag_parser.py backend/pyproject.toml
git commit -m "feat(rag): 新增文档解析器，支持 PDF/PPT/TXT 解析与文本分块"
```

---

### Task 5: Embedding 服务 + ChromaDB 向量存储

**Files:**
- Create: `backend/services/rag/embedding.py`
- Create: `backend/services/rag/retriever.py`

- [ ] **Step 1: 实现 embedding.py**

```python
# backend/services/rag/embedding.py
"""Embedding 生成 — 调用 OpenAI 兼容 API"""
import logging
from backend.shared.llm_client import LLMClient
from backend.shared.config import settings

logger = logging.getLogger(__name__)

async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """为文本列表生成 embedding 向量。"""
    api_key = settings.embedding_api_key or settings.llm_api_key
    base_url = settings.embedding_base_url or settings.llm_base_url
    if not api_key:
        raise RuntimeError("Embedding API key 未配置")
    client = LLMClient(api_key=api_key, base_url=base_url, model=settings.embedding_model)
    try:
        # 分批处理，每批最多 20 条
        all_embeddings: list[list[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = await client.embedding(batch, model=settings.embedding_model)
            all_embeddings.extend(embeddings)
        return all_embeddings
    finally:
        await client.close()
```

- [ ] **Step 2: 实现 retriever.py**

```python
# backend/services/rag/retriever.py
"""ChromaDB 向量检索"""
import chromadb
import logging
from backend.shared.config import settings

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
    logger.info(f"KB {kb_id}: 写入 {len(chunks)} 个文档块")


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
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/rag/embedding.py backend/services/rag/retriever.py
git commit -m "feat(rag): 新增 Embedding 服务与 ChromaDB 向量检索"
```

---

### Task 6: RAG 知识库管理服务 + API

**Files:**
- Create: `backend/services/rag/service.py`
- Create: `backend/services/rag/schemas.py`
- Create: `backend/services/rag/router.py`
- Modify: `backend/gateway/main.py`

- [ ] **Step 1: 实现 schemas.py**

```python
# backend/services/rag/schemas.py
from pydantic import BaseModel
from datetime import datetime

class KBCreate(BaseModel):
    name: str
    description: str = ""

class KBResponse(BaseModel):
    id: int
    name: str
    description: str
    document_count: int
    created_at: datetime

class DocumentResponse(BaseModel):
    id: int
    filename: str
    chunk_count: int
    status: str
    created_at: datetime

class RAGQuery(BaseModel):
    question: str
    top_k: int = 5

class RAGAnswer(BaseModel):
    answer: str
    sources: list[dict]
    usage: dict | None = None
```

- [ ] **Step 2: 实现 service.py**

```python
# backend/services/rag/service.py
"""知识库管理服务"""
import hashlib
import logging
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from backend.shared.models import KnowledgeBase, Document
from backend.shared.config import settings
from . import parser, embedding, retriever
from backend.shared.llm_client import LLMClient

logger = logging.getLogger(__name__)

async def create_kb(db: AsyncSession, user_id: int, name: str, description: str = "") -> KnowledgeBase:
    kb = KnowledgeBase(user_id=user_id, name=name, description=description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb

async def list_kbs(db: AsyncSession, user_id: int) -> list[KnowledgeBase]:
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user_id).order_by(KnowledgeBase.created_at.desc())
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

async def upload_document(db: AsyncSession, kb_id: int, user_id: int,
                          filename: str, file_data: bytes) -> Document:
    """上传文档：解析 → 分块 → Embedding → 写入向量库"""
    # 校验知识库归属
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

        logger.info(f"文档 {filename} 处理完成: {len(chunks)} 个文档块")
        return doc
    except Exception as e:
        doc.status = "error"
        await db.commit()
        raise

async def rag_query(db: AsyncSession, kb_id: int, user_id: int,
                    question: str, top_k: int = 5) -> dict:
    """RAG 问答：检索相关文档块 → LLM 生成回答"""
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb or kb.user_id != user_id:
        raise ValueError("知识库不存在")

    # 生成查询 Embedding
    query_emb = (await embedding.get_embeddings([question]))[0]

    # 检索
    results = await retriever.search(kb_id, query_emb, top_k=top_k)
    if not results:
        return {"answer": "知识库中未找到相关内容，请尝试上传更多资料。", "sources": [], "usage": None}

    # 构建上下文
    context = "\n\n---\n\n".join(
        f"[来源: {r['metadata'].get('filename', '未知')}]\n{r['text']}" for r in results
    )

    # LLM 生成回答
    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        system = (
            "你是一个学习助手。根据下面提供的参考资料回答用户的问题。"
            "请在回答中标注引用来源（如 [来源: 文件名]）。"
            "如果参考资料中没有相关内容，请如实说明。"
        )
        prompt = f"参考资料：\n{context}\n\n用户问题：{question}"
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=system,
            max_tokens=2048,
        )
        sources = [{"filename": r["metadata"].get("filename", ""), "text": r["text"][:200],
                     "distance": r.get("distance")} for r in results]
        return {"answer": result["text"], "sources": sources, "usage": result["usage"]}
    finally:
        await client.close()
```

- [ ] **Step 3: 实现 router.py**

```python
# backend/services/rag/router.py
"""RAG 知识库 API"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.shared.database import get_db
from backend.gateway.auth.dependencies import get_current_user
from . import service, schemas

router = APIRouter(prefix="/api/rag", tags=["RAG"])

@router.post("/kb", response_model=schemas.KBResponse, status_code=201)
async def create_knowledge_base(
    body: schemas.KBCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kb = await service.create_kb(db, user.id, body.name, body.description)
    return kb

@router.get("/kb", response_model=list[schemas.KBResponse])
async def list_knowledge_bases(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_kbs(db, user.id)

@router.delete("/kb/{kb_id}", status_code=204)
async def delete_knowledge_base(
    kb_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await service.delete_kb(db, user.id, kb_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

@router.post("/kb/{kb_id}/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "请选择文件")
    allowed = (".pdf", ".pptx", ".ppt", ".txt", ".md")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(400, f"仅支持 {', '.join(allowed)} 格式")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(400, "文件大小不能超过 50MB")
    try:
        doc = await service.upload_document(db, kb_id, user.id, file.filename, data)
        return doc
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.post("/kb/{kb_id}/query", response_model=schemas.RAGAnswer)
async def query_knowledge_base(
    kb_id: int,
    body: schemas.RAGQuery,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.rag_query(db, kb_id, user.id, body.question, body.top_k)
    except ValueError as e:
        raise HTTPException(404, str(e))
```

- [ ] **Step 4: 在 gateway/main.py 中注册路由**

在 `backend/gateway/main.py` 中添加：
```python
from backend.services.rag.router import router as rag_router
app.include_router(rag_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/rag/ backend/gateway/main.py
git commit -m "feat(rag): 完整 RAG 管线 — 知识库管理、文档上传、向量检索、LLM 问答"
```

---

## Chunk 3: 智能出题 + 复习计划

### Task 7: 智能出题服务

**Files:**
- Create: `backend/services/quiz/__init__.py`
- Create: `backend/services/quiz/service.py`
- Create: `backend/services/quiz/schemas.py`
- Create: `backend/services/quiz/router.py`

- [ ] **Step 1: 实现 schemas.py**

```python
# backend/services/quiz/schemas.py
from pydantic import BaseModel

class QuizRequest(BaseModel):
    kb_id: int
    topic: str = ""               # 可选：指定出题范围
    count: int = 5                # 题目数量
    difficulty: str = "medium"    # easy / medium / hard
    question_type: str = "mixed"  # choice / short_answer / essay / mixed

class QuizQuestion(BaseModel):
    question: str
    question_type: str
    options: list[str] | None = None   # 选择题选项
    answer: str
    explanation: str
    source: str = ""                    # 来源文件

class QuizResponse(BaseModel):
    questions: list[QuizQuestion]
    topic: str
    usage: dict | None = None
```

- [ ] **Step 2: 实现 service.py**

```python
# backend/services/quiz/service.py
"""智能出题 — 基于 RAG 检索 + LLM 生成"""
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.shared.llm_client import LLMClient
from backend.shared.config import settings
from backend.services.rag import embedding, retriever

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = """你是一位专业的大学考试出题老师。根据提供的学习资料生成高质量的考试题目。

要求：
1. 题目必须基于提供的参考资料内容
2. 严格按照指定的题目类型和难度出题
3. 每道题必须包含标准答案和详细解析
4. 返回 JSON 格式，结构如下：

```json
{
  "questions": [
    {
      "question": "题目内容",
      "question_type": "choice|short_answer|essay",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "标准答案",
      "explanation": "解析说明",
      "source": "来源内容摘要"
    }
  ]
}
```

注意：选择题必须有 4 个选项（A/B/C/D），简答题和论述题不需要 options 字段。"""


async def generate_quiz(db: AsyncSession, kb_id: int, user_id: int,
                        topic: str, count: int, difficulty: str,
                        question_type: str) -> dict:
    """从知识库生成测试题"""
    # 用 topic 或通用查询检索相关内容
    query = topic if topic else "核心知识点 重要概念 关键内容"
    query_emb = (await embedding.get_embeddings([query]))[0]
    results = await retriever.search(kb_id, query_emb, top_k=10)

    if not results:
        return {"questions": [], "topic": topic, "usage": None}

    context = "\n\n---\n\n".join(
        f"[{r['metadata'].get('filename', '')}]\n{r['text']}" for r in results
    )

    prompt = (
        f"参考资料：\n{context}\n\n"
        f"请根据以上资料出 {count} 道{difficulty}难度的题目。"
        f"题目类型：{question_type}。"
        f"{'主题范围：' + topic if topic else '覆盖资料的核心知识点。'}\n"
        f"请直接返回 JSON，不要加 markdown 代码块标记。"
    )

    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=QUIZ_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        )
        # 解析 JSON
        text = result["text"].strip()
        # 移除可能的 markdown 代码块
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        data = json.loads(text)
        return {
            "questions": data.get("questions", []),
            "topic": topic or "综合",
            "usage": result["usage"],
        }
    except json.JSONDecodeError:
        logger.error(f"出题 JSON 解析失败: {result['text'][:200]}")
        return {"questions": [], "topic": topic, "usage": result["usage"]}
    finally:
        await client.close()
```

- [ ] **Step 3: 实现 router.py**

```python
# backend/services/quiz/router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.shared.database import get_db
from backend.gateway.auth.dependencies import get_current_user
from . import service, schemas

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])

@router.post("/generate", response_model=schemas.QuizResponse)
async def generate_quiz(
    body: schemas.QuizRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await service.generate_quiz(
            db, body.kb_id, user.id,
            body.topic, body.count, body.difficulty, body.question_type,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
```

- [ ] **Step 4: 注册路由到 main.py**

```python
from backend.services.quiz.router import router as quiz_router
app.include_router(quiz_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/quiz/ backend/gateway/main.py
git commit -m "feat(quiz): 智能出题服务 — 基于 RAG 检索 + LLM 生成考试题目"
```

---

### Task 8: AI 复习计划生成

**Files:**
- Create: `backend/services/studyplan/__init__.py`
- Create: `backend/services/studyplan/service.py`
- Create: `backend/services/studyplan/schemas.py`
- Create: `backend/services/studyplan/router.py`

- [ ] **Step 1: 实现 schemas.py**

```python
# backend/services/studyplan/schemas.py
from pydantic import BaseModel
from datetime import date

class ExamInfo(BaseModel):
    subject: str
    exam_date: date
    difficulty: str = "medium"    # easy / medium / hard
    notes: str = ""               # 额外说明

class StudyPlanRequest(BaseModel):
    exams: list[ExamInfo]
    daily_hours: float = 4.0      # 每日可用学习时间
    start_date: date | None = None  # 默认今天

class DayPlan(BaseModel):
    date: str
    tasks: list[dict]             # [{subject, task, hours, priority}]

class StudyPlanResponse(BaseModel):
    plan: list[DayPlan]
    summary: str
    usage: dict | None = None
```

- [ ] **Step 2: 实现 service.py**

```python
# backend/services/studyplan/service.py
"""AI 复习计划生成"""
import json
import logging
from datetime import date, timedelta
from backend.shared.llm_client import LLMClient
from backend.shared.config import settings

logger = logging.getLogger(__name__)

PLAN_SYSTEM_PROMPT = """你是一位经验丰富的学习规划师。根据学生的考试安排和可用时间，生成科学合理的逐日复习计划。

规划原则：
1. 越临近考试的科目，安排越密集的复习
2. 难度高的科目分配更多时间
3. 每天安排不同科目交替学习，避免疲劳
4. 考前一天以复盘和轻量练习为主
5. 合理安排休息时间

返回 JSON 格式：
```json
{
  "plan": [
    {
      "date": "2026-04-01",
      "tasks": [
        {"subject": "高等数学", "task": "复习第3章极限与连续", "hours": 2.0, "priority": "high"},
        {"subject": "数据结构", "task": "刷链表相关习题", "hours": 1.5, "priority": "medium"}
      ]
    }
  ],
  "summary": "整体规划说明..."
}
```"""


async def generate_study_plan(exams: list[dict], daily_hours: float,
                              start_date: date | None = None) -> dict:
    """生成逐日复习计划"""
    if not start_date:
        start_date = date.today()

    exams_text = "\n".join(
        f"- {e['subject']}：考试日期 {e['exam_date']}，难度 {e.get('difficulty', 'medium')}"
        f"{'，备注: ' + e['notes'] if e.get('notes') else ''}"
        for e in exams
    )

    prompt = (
        f"今天是 {start_date}，以下是我的考试安排：\n{exams_text}\n\n"
        f"我每天可以学习 {daily_hours} 小时。\n"
        f"请为我生成从今天到最后一门考试前的逐日复习计划。\n"
        f"请直接返回 JSON，不要加 markdown 代码块标记。"
    )

    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=PLAN_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.5,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        data = json.loads(text)
        return {
            "plan": data.get("plan", []),
            "summary": data.get("summary", ""),
            "usage": result["usage"],
        }
    except json.JSONDecodeError:
        logger.error(f"复习计划 JSON 解析失败: {result['text'][:200]}")
        return {"plan": [], "summary": "生成失败，请重试", "usage": result["usage"]}
    finally:
        await client.close()
```

- [ ] **Step 3: 实现 router.py**

```python
# backend/services/studyplan/router.py
from fastapi import APIRouter, Depends
from backend.gateway.auth.dependencies import get_current_user
from . import service, schemas

router = APIRouter(prefix="/api/studyplan", tags=["StudyPlan"])

@router.post("/generate", response_model=schemas.StudyPlanResponse)
async def generate_plan(
    body: schemas.StudyPlanRequest,
    user=Depends(get_current_user),
):
    exams = [e.model_dump() for e in body.exams]
    result = await service.generate_study_plan(exams, body.daily_hours, body.start_date)
    return result
```

- [ ] **Step 4: 注册路由**

```python
from backend.services.studyplan.router import router as studyplan_router
app.include_router(studyplan_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/studyplan/ backend/gateway/main.py
git commit -m "feat(studyplan): AI 复习计划生成 — 根据考试安排生成逐日计划"
```

---

## Chunk 4: 增强 Function Calling + 用户记忆

### Task 9: 新增 RAG 搜索工具到 Function Calling

**Files:**
- Modify: `backend/services/chat/tools.py`

- [ ] **Step 1: 在 tools.py 中新增 RAG 搜索和出题工具定义**

在 `TOOLS_DEFINITION` 列表中新增：

```python
{
    "name": "search_knowledge_base",
    "description": "在用户的课件知识库中搜索问题的答案。当用户提到课件、PPT、教材、复习资料时使用此工具。",
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "要搜索的问题"},
        },
        "required": ["question"],
    },
},
{
    "name": "generate_quiz",
    "description": "根据用户的课件知识库生成练习题。当用户说'出几道题'、'模拟考试'时使用。",
    "input_schema": {
        "type": "object",
        "properties": {
            "topic": {"type": "string", "description": "出题主题，可选"},
            "count": {"type": "integer", "description": "题目数量，默认5"},
        },
        "required": [],
    },
},
```

- [ ] **Step 2: 在 execute_tool 中实现新工具的执行逻辑**

```python
elif tool_name == "search_knowledge_base":
    from backend.services.rag.service import rag_query
    # 查询用户的第一个知识库
    from backend.shared.models import KnowledgeBase
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user_id).limit(1)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        return json.dumps({"error": "你还没有创建知识库，请先上传课件"}, ensure_ascii=False)
    answer = await rag_query(db, kb.id, user_id, tool_args.get("question", ""))
    return json.dumps(answer, ensure_ascii=False)

elif tool_name == "generate_quiz":
    from backend.services.quiz.service import generate_quiz
    from backend.shared.models import KnowledgeBase
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user_id).limit(1)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        return json.dumps({"error": "你还没有创建知识库，请先上传课件"}, ensure_ascii=False)
    quiz = await generate_quiz(
        db, kb.id, user_id,
        tool_args.get("topic", ""),
        tool_args.get("count", 5), "medium", "mixed",
    )
    return json.dumps(quiz, ensure_ascii=False)
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat/tools.py
git commit -m "feat(chat): Function Calling 新增 RAG 搜索和智能出题工具"
```

---

### Task 10: 用户记忆系统

**Files:**
- Create: `backend/services/memory/__init__.py`
- Create: `backend/services/memory/service.py`
- Modify: `backend/services/chat/service.py`

- [ ] **Step 1: 实现记忆服务**

```python
# backend/services/memory/service.py
"""用户记忆系统 — 从对话中提取和检索用户偏好"""
import json
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from backend.shared.models import UserMemory
from backend.shared.llm_client import LLMClient
from backend.shared.config import settings

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """分析下面的对话，提取用户透露的个人偏好或信息。
仅提取明确提到的信息，不要推测。如果没有新信息，返回空列表。

返回 JSON 数组格式：
[{"category": "分类", "key": "关键词", "value": "值"}]

分类包括: taste(口味偏好), campus(校区), major(专业), study_habit(学习习惯), schedule_pref(时间偏好)

对话内容：
{conversation}

请直接返回 JSON 数组，不要加其他内容。"""


async def extract_memories(conversation: str) -> list[dict]:
    """从对话中提取用户偏好"""
    if not settings.llm_api_key and not settings.llm_auth_token:
        return []
    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": EXTRACT_PROMPT.format(conversation=conversation)}],
            max_tokens=512, temperature=0.3,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        return json.loads(text) if text.startswith("[") else []
    except Exception as e:
        logger.debug(f"记忆提取失败: {e}")
        return []
    finally:
        await client.close()


async def save_memories(db: AsyncSession, user_id: int, memories: list[dict]):
    """保存提取的记忆到数据库（upsert）"""
    for mem in memories:
        stmt = insert(UserMemory).values(
            user_id=user_id,
            category=mem["category"],
            key=mem["key"],
            value=mem["value"],
        ).on_conflict_do_update(
            index_elements=["user_id", "category", "key"],
            set_={"value": mem["value"]},
        )
        await db.execute(stmt)
    await db.commit()


async def get_user_context(db: AsyncSession, user_id: int) -> str:
    """获取用户记忆作为上下文注入"""
    result = await db.execute(
        select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.updated_at.desc()).limit(20)
    )
    memories = result.scalars().all()
    if not memories:
        return ""
    lines = [f"- {m.category}/{m.key}: {m.value}" for m in memories]
    return "已知用户信息：\n" + "\n".join(lines)
```

- [ ] **Step 2: 在 chat service 中集成用户记忆**

修改 `backend/services/chat/service.py` 的 `chat_completion` 函数：

1. 在发送消息前，调用 `get_user_context()` 获取用户偏好，拼接到 system prompt 中
2. 在收到回复后，异步调用 `extract_memories()` + `save_memories()` 提取新记忆

```python
# 在 chat_completion 函数开头添加：
from backend.services.memory.service import get_user_context, extract_memories, save_memories

# 在构建 system prompt 时：
user_context = await get_user_context(db, user_id) if db else ""
system = SYSTEM_PROMPT
if user_context:
    system += f"\n\n{user_context}"

# 在返回回复后（异步，不阻塞响应）：
import asyncio
async def _bg_extract(messages_text, db, user_id):
    try:
        memories = await extract_memories(messages_text)
        if memories:
            await save_memories(db, user_id, memories)
    except Exception:
        pass

# 收到最终回复后触发（不 await）：
conversation_text = "\n".join(f"{m['role']}: {m['content']}" for m in messages[-4:])
asyncio.create_task(_bg_extract(conversation_text, db, user_id))
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/memory/ backend/services/chat/service.py
git commit -m "feat(memory): 用户记忆系统 — 对话中自动提取偏好并注入上下文"
```

---

### Task 11: 最终集成与路由注册

**Files:**
- Modify: `backend/gateway/main.py`

- [ ] **Step 1: 确保所有新路由已注册**

```python
# backend/gateway/main.py 中确保包含：
from backend.services.rag.router import router as rag_router
from backend.services.quiz.router import router as quiz_router
from backend.services.studyplan.router import router as studyplan_router

app.include_router(rag_router)
app.include_router(quiz_router)
app.include_router(studyplan_router)
```

- [ ] **Step 2: 更新 .env.example 新增配置项**

```env
# Embedding 配置
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=

# ChromaDB
CHROMA_PERSIST_DIR=./data/chroma
```

- [ ] **Step 3: 确保 data/chroma 目录在 .gitignore**

在项目根目录 `.gitignore` 中添加：
```
data/
```

- [ ] **Step 4: 全量测试**

Run: `cd E:/SCU_Assistant/backend && python -m pytest tests/ -v`

- [ ] **Step 5: Final Commit**

```bash
git add .
git commit -m "feat(ai): AI 模块集成完成 — RAG 问答、智能出题、复习计划、用户记忆"
```

---

## API 端点总览

完成后新增的 API 端点：

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/rag/kb` | 创建知识库 |
| GET | `/api/rag/kb` | 列出知识库 |
| DELETE | `/api/rag/kb/{id}` | 删除知识库 |
| POST | `/api/rag/kb/{id}/upload` | 上传文档到知识库 |
| POST | `/api/rag/kb/{id}/query` | RAG 问答 |
| POST | `/api/quiz/generate` | 智能出题 |
| POST | `/api/studyplan/generate` | 生成复习计划 |

增强的 Function Calling 工具：
- `search_knowledge_base` — 在对话中触发 RAG 搜索
- `generate_quiz` — 在对话中触发出题
