# Plan 4: AI 对话层实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 搭建 AI 对话服务（ai-svc），实现基于 LLM Function Calling 的自然语言意图路由、流式对话 UI、用户记忆系统，将所有 P0 功能接入对话。

**架构:** ai-svc 作为独立 FastAPI 进程部署，通过 OpenAI 兼容接口调用通义千问 qwen-plus。Gateway 将 `/api/chat` 请求代理到 ai-svc。ai-svc 内部包含 LLM Gateway（统一封装）、Intent Router（Tool 定义 + 调用）、Memory Manager（偏好提取与注入）三个模块。前端通过 SSE 实现流式对话。

**技术栈:** Python 3.12, FastAPI, openai SDK (兼容模式), SSE (sse-starlette), PostgreSQL, Next.js 14, TailwindCSS, shadcn/ui

**设计文档:** `docs/superpowers/specs/2026-03-15-scu-assistant-design.md`

**依赖:** Plan 1 (基础设施), Plan 2 (学业模块), Plan 3 (吃喝+校园模块)

---

## 文件结构

```
backend/
├── services/ai/
│   ├── __init__.py
│   ├── main.py                    # ai-svc FastAPI 应用入口
│   ├── llm_gateway.py             # LLM API 统一封装
│   ├── intent_router.py           # 意图路由 (Tool 定义 + 调用)
│   ├── tools.py                   # 所有 P0 功能的 Tool 定义
│   ├── memory.py                  # 用户记忆管理
│   ├── schemas.py                 # 请求/响应模型
│   └── chat_service.py            # 对话业务逻辑
├── shared/
│   └── models.py                  # 修改: 新增 Conversation, Message, UserMemory
├── alembic/versions/
│   └── xxxx_add_chat_tables.py
└── tests/
    ├── test_llm_gateway.py
    ├── test_intent_router.py
    └── test_memory.py

frontend/
├── src/
│   ├── app/(main)/chat/
│   │   └── page.tsx               # 对话主页面
│   ├── components/chat/
│   │   ├── chat-input.tsx         # 消息输入框
│   │   ├── chat-message.tsx       # 消息气泡
│   │   ├── chat-sidebar.tsx       # 历史对话列表
│   │   └── chat-stream.tsx        # 流式渲染组件
│   └── lib/
│       └── chat-api.ts            # 对话 API + SSE 处理

docker-compose.yml                 # 修改: 新增 ai-svc 服务
```

---

## Chunk 1: 数据模型与 LLM Gateway

### Task 1: 对话相关数据模型

**文件:**
- 修改: `backend/shared/models.py`

- [ ] **步骤 1: 添加 Conversation、Message、UserMemory 模型**

在 `backend/shared/models.py` 末尾追加:

```python
class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user/assistant/system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_calls: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserMemory(Base):
    __tablename__ = "user_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # taste/campus/academic/behavior
    confidence: Mapped[float] = mapped_column(default=1.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

需要在文件顶部补充导入:

```python
from sqlalchemy import Text
```

- [ ] **步骤 2: 生成并执行迁移**

```bash
cd backend
alembic revision --autogenerate -m "add conversations messages and user_memories tables"
alembic upgrade head
```

- [ ] **步骤 3: 提交**

```bash
git add backend/shared/models.py backend/alembic/
git commit -m "feat(ai): 添加对话、消息、用户记忆数据模型"
```

---

### Task 2: AI 服务配置与 LLM Gateway

**文件:**
- 修改: `backend/shared/config.py`
- 创建: `backend/services/ai/__init__.py`
- 创建: `backend/services/ai/llm_gateway.py`
- 创建: `backend/tests/test_llm_gateway.py`

- [ ] **步骤 1: 添加 AI 配置项**

在 `backend/shared/config.py` 的 Settings 类中添加:

```python
    # LLM
    llm_api_key: str = ""
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"
    llm_timeout: int = 30
```

在 `backend/.env.example` 中添加:

```env
LLM_API_KEY=your-dashscope-api-key
LLM_MODEL=qwen-plus
```

- [ ] **步骤 2: 安装 openai SDK**

在 `backend/pyproject.toml` 的 dependencies 中添加:

```toml
    "openai>=1.50.0",
    "sse-starlette>=2.1.0",
```

```bash
cd backend
pip install -e ".[dev]"
```

- [ ] **步骤 3: 编写 LLM Gateway 测试**

创建 `backend/tests/test_llm_gateway.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from services.ai.llm_gateway import LLMGateway


@pytest.fixture
def gateway():
    return LLMGateway()


def test_gateway_initialization(gateway):
    assert gateway.model == "qwen-plus"


def test_build_messages(gateway):
    messages = gateway.build_messages(
        system_prompt="你是 SCU 助手",
        user_message="明天有什么课？",
        history=[
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "你好！"},
        ],
    )
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert messages[2]["role"] == "assistant"
    assert messages[3]["role"] == "user"
    assert messages[3]["content"] == "明天有什么课？"
```

- [ ] **步骤 4: 运行测试确认失败**

```bash
cd backend
pytest tests/test_llm_gateway.py -v
```

预期: FAIL

- [ ] **步骤 5: 实现 LLM Gateway**

创建 `backend/services/ai/__init__.py` (空文件)

创建 `backend/services/ai/llm_gateway.py`:

```python
from openai import AsyncOpenAI

from shared.config import settings


class LLMGateway:
    """通义千问 API 统一封装 (OpenAI 兼容模式)"""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=settings.llm_timeout,
        )
        self.model = settings.llm_model

    def build_messages(
        self,
        system_prompt: str,
        user_message: str,
        history: list[dict] | None = None,
    ) -> list[dict]:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return messages

    async def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        stream: bool = False,
    ):
        """调用 LLM，支持普通和流式两种模式"""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await self.client.chat.completions.create(**kwargs)
        return response

    async def chat_stream(self, messages: list[dict], tools: list[dict] | None = None):
        """流式调用 LLM，yield 每个 chunk"""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        stream = await self.client.chat.completions.create(**kwargs)
        async for chunk in stream:
            yield chunk
```

- [ ] **步骤 6: 运行测试确认通过**

```bash
cd backend
pytest tests/test_llm_gateway.py -v
```

预期: PASS

- [ ] **步骤 7: 提交**

```bash
git add backend/services/ai/ backend/shared/config.py backend/pyproject.toml backend/tests/test_llm_gateway.py
git commit -m "feat(ai): 添加 LLM Gateway (通义千问 OpenAI 兼容模式)"
```

---

### Task 3: Tool 定义与意图路由

**文件:**
- 创建: `backend/services/ai/tools.py`
- 创建: `backend/services/ai/intent_router.py`
- 创建: `backend/tests/test_intent_router.py`

- [ ] **步骤 1: 定义所有 P0 功能的 Tools**

创建 `backend/services/ai/tools.py`:

```python
"""所有 P0 功能的 Tool 定义 (OpenAI Function Calling 格式)"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_schedule",
            "description": "查询用户的课表信息。支持按星期几查询或查看全部课表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "weekday": {
                        "type": "integer",
                        "description": "星期几 (1=周一, 7=周日)。不指定则返回全部。",
                        "minimum": 1,
                        "maximum": 7,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_deadlines",
            "description": "查询用户的 DDL（截止日期）列表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "筛选状态: pending(待完成) 或 completed(已完成)",
                        "enum": ["pending", "completed"],
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_canteen",
            "description": "查询食堂营业状态或搜索食堂窗口。",
            "parameters": {
                "type": "object",
                "properties": {
                    "campus": {
                        "type": "string",
                        "description": "校区: 望江、江安、华西",
                    },
                    "category": {
                        "type": "string",
                        "description": "美食品类关键词，如: 麻辣烫、面、饺子",
                    },
                    "query_type": {
                        "type": "string",
                        "description": "查询类型",
                        "enum": ["status", "window", "recommend"],
                    },
                },
                "required": ["query_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_bus",
            "description": "查询校车时刻表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_campus": {
                        "type": "string",
                        "description": "出发校区: 望江、江安、华西",
                    },
                    "to_campus": {
                        "type": "string",
                        "description": "目的校区: 望江、江安、华西",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_calendar",
            "description": "查询校历信息，如当前第几周、学期起止日期、放假安排。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_deadline",
            "description": "为用户添加一个新的 DDL。",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "DDL 标题"},
                    "course_name": {"type": "string", "description": "关联课程名称"},
                    "due_date": {"type": "string", "description": "截止日期，ISO 8601 格式"},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "优先级",
                    },
                },
                "required": ["title", "due_date"],
            },
        },
    },
]
```

- [ ] **步骤 2: 编写意图路由测试**

创建 `backend/tests/test_intent_router.py`:

```python
import pytest
from services.ai.tools import TOOLS
from services.ai.intent_router import IntentRouter


def test_tools_are_valid():
    """验证所有 Tool 定义格式正确"""
    assert len(TOOLS) > 0
    for tool in TOOLS:
        assert tool["type"] == "function"
        assert "name" in tool["function"]
        assert "description" in tool["function"]
        assert "parameters" in tool["function"]


def test_get_tool_names():
    router = IntentRouter(db=None, user_id=1)
    names = router.get_tool_names()
    assert "query_schedule" in names
    assert "query_canteen" in names
    assert "query_bus" in names


@pytest.mark.asyncio
async def test_execute_calendar_tool():
    """测试无需数据库的 Tool 调用"""
    router = IntentRouter(db=None, user_id=1)
    result = await router.execute_tool("query_calendar", {})
    assert "current_week" in result or "error" in result
```

- [ ] **步骤 3: 运行测试确认失败**

```bash
cd backend
pytest tests/test_intent_router.py -v
```

预期: FAIL

- [ ] **步骤 4: 实现意图路由器**

创建 `backend/services/ai/intent_router.py`:

```python
import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from services.ai.tools import TOOLS


class IntentRouter:
    """基于 LLM Function Calling 的意图路由器"""

    def __init__(self, db: AsyncSession | None, user_id: int):
        self.db = db
        self.user_id = user_id

    def get_tools(self) -> list[dict]:
        return TOOLS

    def get_tool_names(self) -> list[str]:
        return [t["function"]["name"] for t in TOOLS]

    async def execute_tool(self, tool_name: str, arguments: dict) -> str:
        """执行指定 Tool，返回结果字符串"""
        try:
            handler = getattr(self, f"_handle_{tool_name}", None)
            if handler is None:
                return json.dumps({"error": f"未知功能: {tool_name}"}, ensure_ascii=False)
            result = await handler(**arguments)
            return json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            return json.dumps({"error": f"执行失败: {str(e)}"}, ensure_ascii=False)

    async def _handle_query_schedule(self, weekday: int | None = None) -> dict:
        if self.db is None:
            return {"error": "数据库不可用"}
        from services.academic.service import AcademicService
        svc = AcademicService(self.db)
        courses = await svc.get_schedule(user_id=self.user_id, weekday=weekday)
        return {
            "courses": [
                {
                    "course_name": c.course_name,
                    "teacher": c.teacher,
                    "location": c.location,
                    "weekday": c.weekday,
                    "start_time": str(c.start_time),
                    "end_time": str(c.end_time),
                }
                for c in courses
            ]
        }

    async def _handle_query_deadlines(self, status: str | None = None) -> dict:
        if self.db is None:
            return {"error": "数据库不可用"}
        from services.academic.service import AcademicService
        svc = AcademicService(self.db)
        deadlines = await svc.get_deadlines(user_id=self.user_id, status=status)
        return {
            "deadlines": [
                {
                    "title": d.title,
                    "course_name": d.course_name,
                    "due_date": str(d.due_date),
                    "priority": d.priority,
                    "status": d.status,
                }
                for d in deadlines
            ]
        }

    async def _handle_add_deadline(
        self, title: str, due_date: str, course_name: str | None = None, priority: str = "medium"
    ) -> dict:
        if self.db is None:
            return {"error": "数据库不可用"}
        from services.academic.service import AcademicService
        svc = AcademicService(self.db)
        deadline = await svc.create_deadline(
            user_id=self.user_id,
            title=title,
            due_date=datetime.fromisoformat(due_date),
            course_name=course_name,
            priority=priority,
        )
        return {"success": True, "title": deadline.title, "due_date": str(deadline.due_date)}

    async def _handle_query_canteen(
        self, query_type: str, campus: str | None = None, category: str | None = None
    ) -> dict:
        if self.db is None:
            return {"error": "数据库不可用"}
        from services.food.service import FoodService
        svc = FoodService(self.db)
        if query_type == "status":
            canteens = await svc.get_canteens(campus=campus)
            return {"canteens": [{"name": c.name, "campus": c.campus, "is_open": svc.is_open(c)} for c in canteens]}
        elif query_type == "window":
            windows = await svc.search_windows(campus=campus, category=category)
            return {"windows": [{"name": w.name, "canteen": w.canteen_name, "category": w.category} for w in windows]}
        elif query_type == "recommend":
            rec = await svc.recommend(campus=campus)
            return rec
        return {"error": "未知查询类型"}

    async def _handle_query_bus(
        self, from_campus: str | None = None, to_campus: str | None = None
    ) -> dict:
        if self.db is None:
            return {"error": "数据库不可用"}
        from services.campus.service import CampusService
        svc = CampusService(self.db)
        schedules = await svc.get_bus_schedules(from_campus=from_campus, to_campus=to_campus)
        return {
            "schedules": [
                {
                    "route": s.route,
                    "departure_campus": s.departure_campus,
                    "arrival_campus": s.arrival_campus,
                    "departure_time": str(s.departure_time),
                }
                for s in schedules
            ]
        }

    async def _handle_query_calendar(self) -> dict:
        from services.campus.service import CampusService
        return CampusService.get_calendar_info()
```

- [ ] **步骤 5: 运行测试确认通过**

```bash
cd backend
pytest tests/test_intent_router.py -v
```

预期: PASS (至少前 2 个，calendar 可能需要适配)

- [ ] **步骤 6: 提交**

```bash
git add backend/services/ai/tools.py backend/services/ai/intent_router.py backend/tests/test_intent_router.py
git commit -m "feat(ai): 添加 Tool 定义和意图路由器"
```

---

## Chunk 2: 对话服务与用户记忆

### Task 4: 用户记忆管理

**文件:**
- 创建: `backend/services/ai/memory.py`
- 创建: `backend/tests/test_memory.py`

- [ ] **步骤 1: 编写记忆管理测试**

创建 `backend/tests/test_memory.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

from services.ai.memory import MemoryManager


@pytest.fixture
def memory_mgr():
    db = AsyncMock()
    return MemoryManager(db=db, user_id=1)


def test_build_memory_prompt_empty(memory_mgr):
    prompt = memory_mgr.build_memory_prompt([])
    assert prompt == ""


def test_build_memory_prompt_with_data(memory_mgr):
    memories = [
        MagicMock(key="口味", value="不吃辣", category="taste"),
        MagicMock(key="校区", value="江安", category="campus"),
    ]
    prompt = memory_mgr.build_memory_prompt(memories)
    assert "不吃辣" in prompt
    assert "江安" in prompt


def test_parse_extraction_result(memory_mgr):
    llm_output = '[{"key":"口味","value":"喜欢面食","category":"taste"}]'
    result = memory_mgr.parse_extraction_result(llm_output)
    assert len(result) == 1
    assert result[0]["key"] == "口味"
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
cd backend
pytest tests/test_memory.py -v
```

- [ ] **步骤 3: 实现 MemoryManager**

创建 `backend/services/ai/memory.py`:

```python
import json

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import UserMemory


class MemoryManager:
    """用户记忆管理: 加载、提取、存储"""

    MAX_MEMORIES_PER_USER = 50

    def __init__(self, db: AsyncSession, user_id: int):
        self.db = db
        self.user_id = user_id

    async def load_memories(self) -> list[UserMemory]:
        """加载用户所有记忆"""
        result = await self.db.execute(
            select(UserMemory)
            .where(UserMemory.user_id == self.user_id)
            .order_by(UserMemory.confidence.desc())
        )
        return result.scalars().all()

    def build_memory_prompt(self, memories: list) -> str:
        """将记忆列表转换为 System Prompt 片段"""
        if not memories:
            return ""
        lines = ["以下是关于该用户的已知信息，请据此提供个性化回答:"]
        for m in memories:
            lines.append(f"- {m.key}: {m.value}")
        return "\n".join(lines)

    def get_extraction_prompt(self, conversation_text: str) -> str:
        """生成记忆提取的 prompt"""
        return f"""从以下对话中提取用户的关键偏好和信息。
仅提取明确表达的偏好，不要猜测。
输出 JSON 数组，每项包含 key、value、category 字段。
category 可选值: taste(口味偏好)、campus(校区信息)、academic(学业信息)、behavior(行为习惯)

如果没有可提取的信息，返回空数组 []。

对话内容:
{conversation_text}

输出 (JSON 数组):"""

    def parse_extraction_result(self, llm_output: str) -> list[dict]:
        """解析 LLM 返回的记忆提取结果"""
        try:
            # 尝试从 LLM 输出中提取 JSON
            text = llm_output.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text)
        except (json.JSONDecodeError, IndexError):
            return []

    async def save_memories(self, extracted: list[dict]) -> int:
        """保存提取的记忆，同 key 覆盖旧值"""
        saved = 0
        for item in extracted:
            key = item.get("key", "")
            value = item.get("value", "")
            category = item.get("category", "")
            if not key or not value:
                continue

            # 查找是否已存在同 key 的记忆
            result = await self.db.execute(
                select(UserMemory).where(
                    and_(UserMemory.user_id == self.user_id, UserMemory.key == key)
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.value = value
                existing.category = category
                existing.confidence = max(existing.confidence, 0.8)
            else:
                # 检查是否超出上限
                count_result = await self.db.execute(
                    select(func.count()).where(UserMemory.user_id == self.user_id)
                )
                count = count_result.scalar()
                if count >= self.MAX_MEMORIES_PER_USER:
                    # 删除最旧最低置信度的记忆
                    oldest = await self.db.execute(
                        select(UserMemory)
                        .where(UserMemory.user_id == self.user_id)
                        .order_by(UserMemory.confidence.asc(), UserMemory.updated_at.asc())
                        .limit(1)
                    )
                    old_mem = oldest.scalar_one_or_none()
                    if old_mem:
                        await self.db.delete(old_mem)

                new_mem = UserMemory(
                    user_id=self.user_id,
                    key=key,
                    value=value,
                    category=category,
                )
                self.db.add(new_mem)

            saved += 1

        await self.db.commit()
        return saved
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
cd backend
pytest tests/test_memory.py -v
```

预期: PASS

- [ ] **步骤 5: 提交**

```bash
git add backend/services/ai/memory.py backend/tests/test_memory.py
git commit -m "feat(ai): 添加用户记忆管理 (加载/提取/存储)"
```

---

### Task 5: 对话服务与 SSE 接口

**文件:**
- 创建: `backend/services/ai/schemas.py`
- 创建: `backend/services/ai/chat_service.py`
- 创建: `backend/services/ai/main.py`

- [ ] **步骤 1: 创建 schemas**

创建 `backend/services/ai/schemas.py`:

```python
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


class ConversationItem(BaseModel):
    id: int
    title: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageItem(BaseModel):
    id: int
    role: str
    content: str
    tool_calls: dict | None
    created_at: str

    model_config = {"from_attributes": True}
```

- [ ] **步骤 2: 创建对话服务**

创建 `backend/services/ai/chat_service.py`:

```python
import json

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from services.ai.intent_router import IntentRouter
from services.ai.llm_gateway import LLMGateway
from services.ai.memory import MemoryManager
from shared.models import Conversation, Message


SYSTEM_PROMPT = """你是 SCU Assistant，四川大学智能校园助手。你可以帮助同学查询课表、追踪 DDL、了解食堂信息、查询校车时刻和校历。

回答要求:
- 使用中文，语气友好自然
- 回答简洁明了，信息准确
- 如果工具返回了数据，基于数据回答，不要编造信息
- 如果无法处理用户的问题，友好地引导用户使用其他功能

{memory_prompt}"""


class ChatService:
    def __init__(self, db: AsyncSession, user_id: int):
        self.db = db
        self.user_id = user_id
        self.llm = LLMGateway()
        self.router = IntentRouter(db=db, user_id=user_id)
        self.memory = MemoryManager(db=db, user_id=user_id)

    async def get_or_create_conversation(self, conversation_id: int | None = None) -> Conversation:
        if conversation_id:
            result = await self.db.execute(
                select(Conversation).where(
                    and_(Conversation.id == conversation_id, Conversation.user_id == self.user_id)
                )
            )
            conv = result.scalar_one_or_none()
            if conv:
                return conv

        conv = Conversation(user_id=self.user_id)
        self.db.add(conv)
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def get_history(self, conversation_id: int, limit: int = 20) -> list[dict]:
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = list(reversed(result.scalars().all()))
        return [{"role": m.role, "content": m.content} for m in messages]

    async def save_message(self, conversation_id: int, role: str, content: str, tool_calls: dict | None = None):
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
        )
        self.db.add(msg)
        await self.db.commit()

    async def chat(self, message: str, conversation_id: int | None = None):
        """处理用户消息，返回 AI 回答 (非流式)"""
        conv = await self.get_or_create_conversation(conversation_id)
        await self.save_message(conv.id, "user", message)

        # 加载记忆和历史
        memories = await self.memory.load_memories()
        memory_prompt = self.memory.build_memory_prompt(memories)
        system_prompt = SYSTEM_PROMPT.format(memory_prompt=memory_prompt)
        history = await self.get_history(conv.id)

        messages = self.llm.build_messages(system_prompt, message, history[:-1])  # 排除刚保存的

        # 第一次调用: 可能触发 Tool
        response = await self.llm.chat(messages, tools=self.router.get_tools())
        choice = response.choices[0]

        # 如果 LLM 请求调用 Tool
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            tool_results = []
            for tool_call in choice.message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                result = await self.router.execute_tool(func_name, func_args)
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": result,
                })

            # 将 Tool 结果传回 LLM 生成最终回答
            messages.append(choice.message.model_dump())
            messages.extend(tool_results)
            final_response = await self.llm.chat(messages)
            answer = final_response.choices[0].message.content
        else:
            answer = choice.message.content or "抱歉，我暂时无法回答这个问题。"

        await self.save_message(conv.id, "assistant", answer)

        # 更新对话标题 (首次消息时)
        if not conv.title:
            conv.title = message[:50]
            await self.db.commit()

        return {"conversation_id": conv.id, "message": answer}

    async def get_conversations(self, page: int = 1, limit: int = 20) -> dict:
        offset = (page - 1) * limit
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.user_id == self.user_id)
            .order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        convs = result.scalars().all()
        return {"conversations": convs}

    async def get_messages(self, conversation_id: int, page: int = 1, limit: int = 20) -> dict:
        offset = (page - 1) * limit
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        msgs = result.scalars().all()
        return {"messages": msgs}
```

- [ ] **步骤 3: 创建 ai-svc 入口**

创建 `backend/services/ai/main.py`:

```python
import json

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from gateway.auth.dependencies import get_current_user
from services.ai.chat_service import ChatService
from services.ai.schemas import ChatRequest, ConversationItem, MessageItem
from shared.database import get_db
from shared.exceptions import register_error_handlers
from shared.models import User

app = FastAPI(title="SCU Assistant AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)


def get_chat_service(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatService:
    return ChatService(db=db, user_id=user.id)


@app.post("/api/chat")
async def chat(
    body: ChatRequest,
    svc: ChatService = Depends(get_chat_service),
):
    """非流式对话 (MVP 版本，后续升级为 SSE 流式)"""
    result = await svc.chat(message=body.message, conversation_id=body.conversation_id)
    return result


@app.post("/api/chat/stream")
async def chat_stream(
    body: ChatRequest,
    svc: ChatService = Depends(get_chat_service),
):
    """SSE 流式对话"""
    async def event_generator():
        conv = await svc.get_or_create_conversation(body.conversation_id)
        await svc.save_message(conv.id, "user", body.message)

        memories = await svc.memory.load_memories()
        memory_prompt = svc.memory.build_memory_prompt(memories)

        from services.ai.chat_service import SYSTEM_PROMPT
        system_prompt = SYSTEM_PROMPT.format(memory_prompt=memory_prompt)
        history = await svc.get_history(conv.id)
        messages = svc.llm.build_messages(system_prompt, body.message, history[:-1])

        # 先非流式调用检查是否需要 Tool
        response = await svc.llm.chat(messages, tools=svc.router.get_tools())
        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            # 处理 Tool 调用
            yield {"event": "tool_call", "data": json.dumps(
                {"tools": [tc.function.name for tc in choice.message.tool_calls]},
                ensure_ascii=False,
            )}

            tool_results = []
            for tool_call in choice.message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                result = await svc.router.execute_tool(func_name, func_args)
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": result,
                })

            messages.append(choice.message.model_dump())
            messages.extend(tool_results)

            # 流式返回最终回答
            full_content = ""
            async for chunk in svc.llm.chat_stream(messages):
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    full_content += text
                    yield {"event": "text_delta", "data": json.dumps(
                        {"content": text}, ensure_ascii=False
                    )}
        else:
            # 无 Tool 调用，直接流式返回
            full_content = choice.message.content or ""
            for i in range(0, len(full_content), 10):
                yield {"event": "text_delta", "data": json.dumps(
                    {"content": full_content[i:i+10]}, ensure_ascii=False
                )}

        await svc.save_message(conv.id, "assistant", full_content)

        if not conv.title:
            conv.title = body.message[:50]
            await svc.db.commit()

        yield {"event": "done", "data": json.dumps(
            {"conversation_id": conv.id}, ensure_ascii=False
        )}

    return EventSourceResponse(event_generator())


@app.get("/api/chat/conversations")
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    svc: ChatService = Depends(get_chat_service),
):
    return await svc.get_conversations(page=page, limit=limit)


@app.get("/api/chat/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    svc: ChatService = Depends(get_chat_service),
):
    return await svc.get_messages(conversation_id=conversation_id, page=page, limit=limit)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-svc"}
```

- [ ] **步骤 4: 更新 Docker Compose 添加 ai-svc**

在 `docker-compose.yml` 的 `services` 下添加:

```yaml
  ai-svc:
    build: ./backend
    ports:
      - "8005:8005"
    command: uvicorn services.ai.main:app --host 0.0.0.0 --port 8005
    env_file:
      - ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

- [ ] **步骤 5: 在 Gateway 中代理 /api/chat 到 ai-svc**

在 `backend/gateway/main.py` 中添加 chat 路由代理:

```python
import httpx

@app.api_route("/api/chat{path:path}", methods=["GET", "POST"])
async def proxy_chat(request: Request, path: str = ""):
    """将 /api/chat 请求代理到 ai-svc"""
    target_url = f"http://localhost:8005/api/chat{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
            content=await request.body(),
            params=request.query_params,
            timeout=60.0,
        )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=dict(resp.headers),
        )
```

需要在文件顶部添加:

```python
from fastapi import Request
from fastapi.responses import Response
```

- [ ] **步骤 6: 提交**

```bash
git add backend/services/ai/ backend/gateway/main.py docker-compose.yml
git commit -m "feat(ai): 添加对话服务、SSE 流式接口、Gateway 代理"
```

---

## Chunk 3: 前端对话 UI

### Task 6: 前端对话 API 与 SSE 处理

**文件:**
- 创建: `frontend/src/lib/chat-api.ts`
- 创建: `frontend/src/types/chat.ts`

- [ ] **步骤 1: 创建对话类型**

创建 `frontend/src/types/chat.ts`:

```typescript
export interface ChatMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Record<string, unknown> | null;
  created_at?: string;
  isStreaming?: boolean;
}

export interface ConversationItem {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **步骤 2: 创建对话 API 与 SSE 处理**

创建 `frontend/src/lib/chat-api.ts`:

```typescript
import { api } from "./api";
import type { ConversationItem } from "@/types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function sendMessage(
  message: string,
  conversationId?: number
): Promise<{ conversation_id: number; message: string }> {
  const { data } = await api.post("/api/chat", {
    message,
    conversation_id: conversationId,
  });
  return data;
}

export async function sendMessageStream(
  message: string,
  conversationId: number | undefined,
  onDelta: (text: string) => void,
  onToolCall: (tools: string[]) => void,
  onDone: (conversationId: number) => void,
  onError: (error: string) => void,
) {
  const { useAuthStore } = await import("@/stores/auth-store");
  const token = useAuthStore.getState().accessToken;

  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });

    if (!response.ok) {
      onError("请求失败");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          const eventType = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            if (data.content) onDelta(data.content);
            if (data.tools) onToolCall(data.tools);
            if (data.conversation_id) onDone(data.conversation_id);
          } catch {}
        }
      }
    }
  } catch (e) {
    onError("网络错误，请重试");
  }
}

export async function getConversations(
  page = 1,
  limit = 20
): Promise<{ conversations: ConversationItem[] }> {
  const { data } = await api.get("/api/chat/conversations", {
    params: { page, limit },
  });
  return data;
}

export async function getMessages(conversationId: number, page = 1, limit = 20) {
  const { data } = await api.get(
    `/api/chat/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );
  return data;
}
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/types/chat.ts frontend/src/lib/chat-api.ts
git commit -m "feat(chat): 添加对话 API 函数和 SSE 流式处理"
```

---

### Task 7: 对话 UI 组件

**文件:**
- 创建: `frontend/src/components/chat/chat-message.tsx`
- 创建: `frontend/src/components/chat/chat-input.tsx`
- 创建: `frontend/src/components/chat/chat-sidebar.tsx`

- [ ] **步骤 1: 创建消息气泡组件**

创建 `frontend/src/components/chat/chat-message.tsx`:

```tsx
import type { ChatMessage } from "@/types/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? "bg-blue-100" : "bg-gray-100"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.isStreaming && (
          <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 创建输入框组件**

创建 `frontend/src/components/chat/chat-input.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t bg-white p-4 dark:bg-gray-950">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={handleKeyDown}
        placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
        className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
        rows={1}
        disabled={disabled}
      />
      <Button size="icon" onClick={handleSubmit} disabled={disabled || !input.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **步骤 3: 创建历史对话侧边栏**

创建 `frontend/src/components/chat/chat-sidebar.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { getConversations } from "@/lib/chat-api";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  currentId?: number;
  onSelect: (id: number) => void;
  onNew: () => void;
}

export function ChatSidebar({ currentId, onSelect, onNew }: ChatSidebarProps) {
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(),
    staleTime: 30 * 1000,
  });

  return (
    <div className="hidden md:flex md:w-64 md:flex-col border-r bg-gray-50 dark:bg-gray-900">
      <div className="p-3">
        <Button variant="outline" className="w-full" onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          新对话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {data?.conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              currentId === conv.id
                ? "bg-white shadow-sm dark:bg-gray-800"
                : "hover:bg-white/50 dark:hover:bg-gray-800/50"
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{conv.title || "新对话"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/components/chat/
git commit -m "feat(chat): 添加消息气泡、输入框、历史侧边栏组件"
```

---

### Task 8: 对话主页面

**文件:**
- 创建: `frontend/src/app/(main)/chat/page.tsx`

- [ ] **步骤 1: 创建对话页面**

创建 `frontend/src/app/(main)/chat/page.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatMessageBubble } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { sendMessageStream, getMessages } from "@/lib/chat-api";
import type { ChatMessage } from "@/types/chat";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = useCallback(async (convId: number) => {
    setConversationId(convId);
    const { messages: msgs } = await getMessages(convId);
    setMessages(
      msgs.map((m: any) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }))
    );
  }, []);

  const handleNewConversation = () => {
    setConversationId(undefined);
    setMessages([]);
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    await sendMessageStream(
      text,
      conversationId,
      // onDelta
      (delta) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + delta,
            };
          }
          return updated;
        });
      },
      // onToolCall
      (tools) => {
        // 可以显示 "正在查询课表..." 等提示
      },
      // onDone
      (newConvId) => {
        setConversationId(newConvId);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });
        setIsLoading(false);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      },
      // onError
      (error) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: error,
            isStreaming: false,
          };
          return updated;
        });
        setIsLoading(false);
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      <ChatSidebar
        currentId={conversationId}
        onSelect={loadConversation}
        onNew={handleNewConversation}
      />
      <div className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-lg font-medium">SCU Assistant</p>
              <p className="text-sm mt-1">试试问我: "明天有什么课？" 或 "江安哪里有麻辣烫？"</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessageBubble key={i} message={msg} />
            ))
          )}
        </div>
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 验证页面渲染**

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000/chat → 对话页面，左侧历史列表，右侧对话区
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/app/\(main\)/chat/
git commit -m "feat(chat): 添加对话主页面 (流式渲染 + 历史侧边栏)"
```

---

### Task 9: 最终验证

- [ ] **步骤 1: 运行所有后端测试**

```bash
cd backend
pytest -v
```

预期: 所有测试 PASS

- [ ] **步骤 2: Docker Compose 端到端验证**

```bash
docker compose up -d --build
# 1. 登录
# 2. 访问 /chat
# 3. 发送 "明天有什么课？" → 触发 query_schedule Tool → 返回课表信息
# 4. 发送 "江安哪个食堂开着？" → 触发 query_canteen Tool → 返回食堂状态
# 5. 发送 "下一班去江安的校车几点？" → 触发 query_bus Tool → 返回校车信息
# 6. 发送 "帮我添加一个DDL，下周五交编译原理作业" → 触发 add_deadline Tool
# 7. 验证对话历史保存和加载
docker compose down
```

- [ ] **步骤 3: 前端构建验证**

```bash
cd frontend
npm run build
```

预期: 构建成功
