# Plan 5: P1 扩展 + 打磨 + 收尾实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现 P1 优先级扩展功能（考试倒计时 + AI 复习计划、课件 RAG 问答、天气穿衣建议、校园通知聚合、Morning Briefing），并完成 UI 打磨、测试覆盖和答辩准备。

**架构:** 新增 RAG 引擎（Milvus 向量库 + text-embedding-v3）、天气服务（和风天气 API）、通知爬虫（APScheduler 定时抓取）、Morning Briefing（跨源推理聚合）。前端新增考试倒计时组件、课件上传/问答页、天气卡片、通知聚合页和 Dashboard 首页。

**技术栈:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis 7, Milvus, pymilvus, Next.js 14 (App Router), TailwindCSS 4, shadcn/ui, TanStack Query, Zustand, Vitest, pytest, APScheduler

**设计文档:** `docs/superpowers/specs/2026-03-15-scu-assistant-design.md`

**依赖:** Plan 1-4 全部完成

---

## 文件结构

```
SCU_Assistant/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   │       ├── 004_add_exam_notification_tables.py    # 考试/通知表迁移
│   │       └── 005_add_document_chunks_table.py       # RAG 文档分片表迁移
│   ├── services/
│   │   ├── academic/
│   │   │   ├── models.py                              # 新增 Exam 模型
│   │   │   ├── service.py                             # 新增考试倒计时逻辑
│   │   │   ├── router.py                              # 新增考试相关端点
│   │   │   └── schemas.py                             # 新增考试 Pydantic 模型
│   │   ├── weather/
│   │   │   ├── __init__.py
│   │   │   ├── service.py                             # 和风天气 API 调用 + 穿衣建议
│   │   │   ├── router.py                              # /api/weather/* 路由端点
│   │   │   └── schemas.py                             # 天气 Pydantic 模型
│   │   ├── notification/
│   │   │   ├── __init__.py
│   │   │   ├── models.py                              # Notification SQLAlchemy 模型
│   │   │   ├── service.py                             # 通知查询 + AI 摘要
│   │   │   ├── router.py                              # /api/notifications/* 路由端点
│   │   │   ├── schemas.py                             # 通知 Pydantic 模型
│   │   │   └── crawler.py                             # 教务通知爬虫
│   │   └── briefing/
│   │       ├── __init__.py
│   │       └── service.py                             # Morning Briefing 跨源聚合
│   ├── ai_svc/
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── engine.py                              # RAG 引擎（分片、Embedding、检索）
│   │   │   ├── milvus_client.py                       # Milvus 向量库连接
│   │   │   └── chunker.py                             # 文档分片器
│   │   └── tools.py                                   # 新增 Tool 定义（天气、通知、briefing）
│   └── tests/
│       ├── test_exam_service.py                       # 考试倒计时测试
│       ├── test_weather_service.py                    # 天气服务测试
│       ├── test_notification_service.py               # 通知服务测试
│       ├── test_rag_engine.py                         # RAG 引擎测试
│       └── test_briefing_service.py                   # Morning Briefing 测试
├── frontend/
│   ├── src/
│   │   ├── app/(main)/
│   │   │   ├── dashboard/page.tsx                     # Dashboard 首页（Morning Briefing）
│   │   │   ├── academic/
│   │   │   │   ├── exam/page.tsx                      # 考试倒计时页
│   │   │   │   └── rag/page.tsx                       # 课件 RAG 问答页
│   │   │   ├── weather/page.tsx                       # 天气 + 穿衣建议页
│   │   │   └── notification/page.tsx                  # 校园通知聚合页
│   │   ├── components/
│   │   │   ├── academic/
│   │   │   │   ├── exam-countdown.tsx                 # 考试倒计时卡片
│   │   │   │   ├── exam-list.tsx                      # 考试列表
│   │   │   │   └── rag-chat.tsx                       # RAG 问答对话组件
│   │   │   ├── weather/
│   │   │   │   ├── weather-card.tsx                   # 天气概览卡片
│   │   │   │   └── clothing-advice.tsx                # 穿衣建议组件
│   │   │   ├── notification/
│   │   │   │   ├── notification-list.tsx              # 通知列表
│   │   │   │   └── notification-card.tsx              # 通知卡片（含 AI 摘要）
│   │   │   └── dashboard/
│   │   │       ├── briefing-card.tsx                  # Morning Briefing 卡片
│   │   │       └── quick-info-grid.tsx                # 快捷信息网格
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── exam.ts                            # 考试 API 客户端
│   │   │   │   ├── weather.ts                         # 天气 API 客户端
│   │   │   │   ├── notification.ts                    # 通知 API 客户端
│   │   │   │   ├── briefing.ts                        # Briefing API 客户端
│   │   │   │   └── rag.ts                             # RAG API 客户端
│   │   │   └── hooks/
│   │   │       ├── use-exams.ts                       # TanStack Query 考试 hook
│   │   │       ├── use-weather.ts                     # TanStack Query 天气 hook
│   │   │       ├── use-notifications.ts               # TanStack Query 通知 hook
│   │   │       └── use-briefing.ts                    # TanStack Query Briefing hook
│   │   └── types/
│   │       ├── exam.ts                                # 考试 TypeScript 类型
│   │       ├── weather.ts                             # 天气 TypeScript 类型
│   │       └── notification.ts                        # 通知 TypeScript 类型
│   └── __tests__/
│       ├── components/academic/exam-countdown.test.tsx
│       ├── components/weather/weather-card.test.tsx
│       └── components/notification/notification-list.test.tsx
```

---

## Chunk 1: 考试倒计时 + AI 复习计划（Sprint 5 前半）

### Task 1: Exam 模型与数据库迁移

**文件:**
- 修改: `backend/services/academic/models.py`
- 创建: `backend/alembic/versions/004_add_exam_notification_tables.py`
- 创建: `backend/tests/test_exam_service.py`

- [ ] **步骤 1: 在 models.py 中新增 Exam 模型**

```python
from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text, Time
from shared.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_name = Column(String(200), nullable=False)
    exam_date = Column(Date, nullable=False, index=True)
    exam_time = Column(Time)
    location = Column(String(200))
    exam_type = Column(String(50), default="期末考试")  # 期末考试/期中考试/随堂测验
    notes = Column(Text)
```

- [ ] **步骤 2: 编写模型健全性测试**

创建 `backend/tests/test_exam_service.py`:

```python
from services.academic.models import Exam


def test_exam_model_tablename():
    assert Exam.__tablename__ == "exams"


def test_exam_has_expected_columns():
    columns = [c.name for c in Exam.__table__.columns]
    assert "user_id" in columns
    assert "course_name" in columns
    assert "exam_date" in columns
    assert "exam_type" in columns
```

- [ ] **步骤 3: 运行测试验证通过**

```bash
cd backend
pytest tests/test_exam_service.py -v
```

预期: PASS

- [ ] **步骤 4: 生成数据库迁移**

```bash
cd backend
alembic revision --autogenerate -m "add exams table"
```

如果手动创建，创建 `backend/alembic/versions/004_add_exam_notification_tables.py`:

```python
"""add exams table

Revision ID: 004_exams
Revises: <previous_revision_id>
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "004_exams"
down_revision = "<previous_revision_id>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exams",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("course_name", sa.String(200), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False, index=True),
        sa.Column("exam_time", sa.Time(), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("exam_type", sa.String(50), server_default="期末考试"),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("exams")
```

- [ ] **步骤 5: 运行迁移**

```bash
cd backend
alembic upgrade head
```

- [ ] **步骤 6: 提交**

```bash
git add backend/services/academic/models.py backend/alembic/versions/004_* backend/tests/test_exam_service.py
git commit -m "feat(academic): add Exam model and migration"
```

---

### Task 2: 考试服务层（CRUD + 倒计时计算）

**文件:**
- 修改: `backend/services/academic/service.py`
- 修改: `backend/services/academic/schemas.py`
- 修改: `backend/tests/test_exam_service.py`

- [ ] **步骤 1: 编写 Pydantic schema**

追加到 `backend/services/academic/schemas.py`:

```python
from datetime import date, time as time_type
from pydantic import BaseModel


class ExamCreate(BaseModel):
    course_name: str
    exam_date: date
    exam_time: time_type | None = None
    location: str | None = None
    exam_type: str = "期末考试"
    notes: str | None = None


class ExamResponse(BaseModel):
    id: int
    course_name: str
    exam_date: date
    exam_time: time_type | None
    location: str | None
    exam_type: str
    notes: str | None
    days_remaining: int

    model_config = {"from_attributes": True}
```

- [ ] **步骤 2: 编写考试服务逻辑**

追加到 `backend/services/academic/service.py`:

```python
from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from services.academic.models import Exam
from services.academic.schemas import ExamCreate, ExamResponse


async def create_exam(session: AsyncSession, user_id: int, data: ExamCreate) -> Exam:
    exam = Exam(user_id=user_id, **data.model_dump())
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    return exam


async def get_upcoming_exams(session: AsyncSession, user_id: int) -> list[ExamResponse]:
    today = date.today()
    query = (
        select(Exam)
        .where(Exam.user_id == user_id, Exam.exam_date >= today)
        .order_by(Exam.exam_date.asc())
    )
    result = await session.execute(query)
    exams = result.scalars().all()

    return [
        ExamResponse(
            **{c.name: getattr(e, c.name) for c in Exam.__table__.columns},
            days_remaining=(e.exam_date - today).days,
        )
        for e in exams
    ]


async def delete_exam(session: AsyncSession, user_id: int, exam_id: int) -> bool:
    query = select(Exam).where(Exam.id == exam_id, Exam.user_id == user_id)
    result = await session.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        return False
    await session.delete(exam)
    await session.commit()
    return True
```

- [ ] **步骤 3: 编写单元测试**

追加到 `backend/tests/test_exam_service.py`:

```python
from datetime import date, timedelta
from services.academic.schemas import ExamResponse


def test_exam_response_days_remaining():
    future = date.today() + timedelta(days=7)
    resp = ExamResponse(
        id=1,
        course_name="高等数学",
        exam_date=future,
        exam_time=None,
        location="A101",
        exam_type="期末考试",
        notes=None,
        days_remaining=7,
    )
    assert resp.days_remaining == 7
    assert resp.course_name == "高等数学"


def test_exam_response_today():
    resp = ExamResponse(
        id=2,
        course_name="线性代数",
        exam_date=date.today(),
        exam_time=None,
        location=None,
        exam_type="期中考试",
        notes=None,
        days_remaining=0,
    )
    assert resp.days_remaining == 0
```

- [ ] **步骤 4: 运行测试**

```bash
cd backend
pytest tests/test_exam_service.py -v
```

预期: PASS

- [ ] **步骤 5: 提交**

```bash
git add backend/services/academic/service.py backend/services/academic/schemas.py backend/tests/test_exam_service.py
git commit -m "feat(academic): add exam CRUD service with countdown calculation"
```

---

### Task 3: 考试 API 端点

**文件:**
- 修改: `backend/services/academic/router.py`

- [ ] **步骤 1: 新增考试相关路由**

追加到 `backend/services/academic/router.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from shared.database import get_session
from shared.auth import get_current_user
from services.academic.schemas import ExamCreate, ExamResponse
from services.academic import service as exam_service

# 假设已有 router = APIRouter(prefix="/api/academic", tags=["academic"])

@router.post("/exams", response_model=ExamResponse)
async def create_exam(
    data: ExamCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    exam = await exam_service.create_exam(session, user.id, data)
    days_remaining = (exam.exam_date - __import__("datetime").date.today()).days
    return ExamResponse(
        **{c.name: getattr(exam, c.name) for c in exam.__table__.columns},
        days_remaining=days_remaining,
    )


@router.get("/exams", response_model=list[ExamResponse])
async def list_exams(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await exam_service.get_upcoming_exams(session, user.id)


@router.delete("/exams/{exam_id}")
async def delete_exam(
    exam_id: int,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deleted = await exam_service.delete_exam(session, user.id, exam_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="考试记录未找到")
    return {"message": "已删除"}
```

- [ ] **步骤 2: 运行完整测试**

```bash
cd backend
pytest -v
```

预期: 全部 PASS

- [ ] **步骤 3: 提交**

```bash
git add backend/services/academic/router.py
git commit -m "feat(academic): add exam API endpoints (create/list/delete)"
```

---

### Task 4: AI 复习计划生成

**文件:**
- 修改: `backend/services/academic/service.py`
- 修改: `backend/services/academic/router.py`
- 修改: `backend/ai_svc/tools.py`

- [ ] **步骤 1: 新增复习计划生成函数**

追加到 `backend/services/academic/service.py`:

```python
from openai import AsyncOpenAI
from shared.config import settings


async def generate_review_plan(
    session: AsyncSession, user_id: int, exam_id: int
) -> dict:
    """调用 LLM 为指定考试生成复习计划。"""
    query = select(Exam).where(Exam.id == exam_id, Exam.user_id == user_id)
    result = await session.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        return {"error": "考试记录未找到"}

    days_left = (exam.exam_date - date.today()).days
    if days_left < 0:
        return {"error": "考试已结束"}

    client = AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )

    prompt = f"""请为以下考试生成一份详细的复习计划：
- 课程：{exam.course_name}
- 考试类型：{exam.exam_type}
- 距离考试还有 {days_left} 天
- 备注：{exam.notes or "无"}

请按天数分配复习任务，包含：
1. 每日复习重点
2. 推荐复习方法
3. 时间分配建议
输出格式为 Markdown。"""

    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": "你是四川大学的 AI 学习助手，擅长制定复习计划。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=2000,
    )

    return {
        "exam": exam.course_name,
        "days_remaining": days_left,
        "plan": response.choices[0].message.content,
    }
```

- [ ] **步骤 2: 新增 API 端点**

追加到 `backend/services/academic/router.py`:

```python
@router.post("/exams/{exam_id}/review-plan")
async def get_review_plan(
    exam_id: int,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await exam_service.generate_review_plan(session, user.id, exam_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
```

- [ ] **步骤 3: 在 AI 对话层注册考试相关 Tool**

追加到 `backend/ai_svc/tools.py`:

```python
{
    "type": "function",
    "function": {
        "name": "query_exams",
        "description": "查询用户即将到来的考试列表和倒计时",
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
        "name": "generate_review_plan",
        "description": "为指定考试生成 AI 复习计划",
        "parameters": {
            "type": "object",
            "properties": {
                "exam_id": {
                    "type": "integer",
                    "description": "考试记录的 ID",
                },
            },
            "required": ["exam_id"],
        },
    },
},
```

- [ ] **步骤 4: 提交**

```bash
git add backend/services/academic/service.py backend/services/academic/router.py backend/ai_svc/tools.py
git commit -m "feat(academic): add AI review plan generation and exam tools"
```

---

## Chunk 2: 天气穿衣建议 + 通知聚合（Sprint 5 后半）

### Task 5: 天气服务（和风天气 API）

**文件:**
- 创建: `backend/services/weather/__init__.py`
- 创建: `backend/services/weather/service.py`
- 创建: `backend/services/weather/router.py`
- 创建: `backend/services/weather/schemas.py`
- 创建: `backend/tests/test_weather_service.py`

- [ ] **步骤 1: 创建 Pydantic schema**

创建 `backend/services/weather/schemas.py`:

```python
from pydantic import BaseModel


class WeatherResponse(BaseModel):
    city: str
    temperature: int
    feels_like: int
    condition: str          # 天气状况：晴、多云、小雨等
    humidity: int
    wind_direction: str
    wind_scale: str
    clothing_advice: str    # 穿衣建议
    icon: str               # 天气图标代码
```

- [ ] **步骤 2: 创建天气服务**

创建 `backend/services/weather/service.py`:

```python
import httpx
from shared.config import settings
from shared.cache import redis_client


CLOTHING_RULES = {
    "hot": (30, 100, "今天很热，建议穿短袖短裤，注意防晒！"),
    "warm": (20, 29, "天气温暖，一件薄外套或长袖即可。"),
    "cool": (10, 19, "天气偏凉，建议穿卫衣或薄夹克。"),
    "cold": (0, 9, "天冷了，记得穿厚外套，围巾手套备上。"),
    "freezing": (-40, -1, "非常冷！羽绒服 + 保暖内衣，注意防寒。"),
}


def get_clothing_advice(temp: int) -> str:
    for _, (low, high, advice) in CLOTHING_RULES.items():
        if low <= temp <= high:
            return advice
    return "请根据实际温度选择合适的衣物。"


async def get_weather(city: str = "成都") -> dict:
    """调用和风天气 API 获取实时天气。"""
    # 先查缓存
    cache_key = f"weather:{city}"
    if redis_client:
        cached = await redis_client.get(cache_key)
        if cached:
            import json
            return json.loads(cached)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://devapi.qweather.com/v7/weather/now",
            params={
                "location": city,
                "key": settings.QWEATHER_API_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("code") != "200":
        return {"error": f"天气 API 错误: {data.get('code')}"}

    now = data["now"]
    temp = int(now["temp"])

    result = {
        "city": city,
        "temperature": temp,
        "feels_like": int(now["feelsLike"]),
        "condition": now["text"],
        "humidity": int(now["humidity"]),
        "wind_direction": now["windDir"],
        "wind_scale": now["windScale"],
        "clothing_advice": get_clothing_advice(temp),
        "icon": now["icon"],
    }

    # 缓存 30 分钟
    if redis_client:
        import json
        await redis_client.setex(cache_key, 1800, json.dumps(result, ensure_ascii=False))

    return result
```

- [ ] **步骤 3: 创建路由**

创建 `backend/services/weather/router.py`:

```python
from fastapi import APIRouter
from services.weather.service import get_weather
from services.weather.schemas import WeatherResponse

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=WeatherResponse)
async def weather(city: str = "成都"):
    result = await get_weather(city)
    if "error" in result:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=result["error"])
    return result
```

- [ ] **步骤 4: 创建 `__init__.py`**

创建 `backend/services/weather/__init__.py`:

```python
```

- [ ] **步骤 5: 注册路由到 Gateway**

添加到 `backend/gateway/main.py` 的 `create_app()` 中:

```python
from services.weather.router import router as weather_router
app.include_router(weather_router)
```

- [ ] **步骤 6: 编写单元测试**

创建 `backend/tests/test_weather_service.py`:

```python
from services.weather.service import get_clothing_advice


def test_hot_weather():
    assert "短袖" in get_clothing_advice(35)


def test_warm_weather():
    assert "薄外套" in get_clothing_advice(22)


def test_cool_weather():
    assert "卫衣" in get_clothing_advice(15)


def test_cold_weather():
    assert "厚外套" in get_clothing_advice(5)


def test_freezing_weather():
    assert "羽绒服" in get_clothing_advice(-5)
```

- [ ] **步骤 7: 运行测试**

```bash
cd backend
pytest tests/test_weather_service.py -v
```

预期: PASS

- [ ] **步骤 8: 在 AI 工具中注册天气查询**

追加到 `backend/ai_svc/tools.py`:

```python
{
    "type": "function",
    "function": {
        "name": "query_weather",
        "description": "查询指定城市的实时天气和穿衣建议，默认查询成都",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名称，默认成都",
                },
            },
            "required": [],
        },
    },
},
```

- [ ] **步骤 9: 提交**

```bash
git add backend/services/weather/ backend/gateway/main.py backend/tests/test_weather_service.py backend/ai_svc/tools.py
git commit -m "feat(weather): add weather service with clothing advice and AI tool"
```

---

### Task 6: 通知模型与爬虫

**文件:**
- 创建: `backend/services/notification/__init__.py`
- 创建: `backend/services/notification/models.py`
- 创建: `backend/services/notification/crawler.py`
- 创建: `backend/alembic/versions/005_add_notifications_table.py`
- 创建: `backend/tests/test_notification_service.py`

- [ ] **步骤 1: 创建 Notification 模型**

创建 `backend/services/notification/models.py`:

```python
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func
from shared.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    source = Column(String(100), nullable=False, index=True)  # 教务处/学工部/研究生院
    url = Column(String(1000))
    content = Column(Text)
    summary = Column(Text)  # AI 生成的摘要
    published_at = Column(DateTime(timezone=True))
    crawled_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **步骤 2: 创建 `__init__.py`**

创建 `backend/services/notification/__init__.py`:

```python
```

- [ ] **步骤 3: 生成迁移**

```bash
cd backend
alembic revision --autogenerate -m "add notifications table"
```

- [ ] **步骤 4: 运行迁移**

```bash
cd backend
alembic upgrade head
```

- [ ] **步骤 5: 编写爬虫**

创建 `backend/services/notification/crawler.py`:

```python
"""
教务通知爬虫 — 抓取四川大学教务处通知公告。

实际部署时通过 APScheduler 定时触发，每 30 分钟执行一次。
"""
import httpx
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from services.notification.models import Notification
from openai import AsyncOpenAI
from shared.config import settings


async def crawl_notifications(session: AsyncSession, source: str = "教务处") -> int:
    """
    抓取通知并存入数据库。返回新增通知数量。

    注意：此函数为框架代码，实际解析逻辑需根据目标网站 HTML 结构适配。
    开发阶段使用 Mock 数据验证流程。
    """
    # TODO: 替换为实际爬虫逻辑
    # async with httpx.AsyncClient() as client:
    #     resp = await client.get("https://jwc.scu.edu.cn/...", timeout=30)
    #     entries = parse_html(resp.text)

    # Mock 数据（开发阶段使用）
    entries = [
        {
            "title": "关于 2025-2026 学年第二学期期末考试安排的通知",
            "url": "https://jwc.scu.edu.cn/notice/example1",
            "content": "各学院：期末考试将于第 17-18 周进行...",
            "published_at": datetime.now(),
            "source": source,
        },
    ]

    new_count = 0
    for entry in entries:
        # 去重：按 URL 检查
        existing = await session.execute(
            select(Notification).where(Notification.url == entry["url"])
        )
        if existing.scalar_one_or_none():
            continue

        # 生成 AI 摘要
        summary = await _generate_summary(entry["title"], entry.get("content", ""))

        notification = Notification(
            title=entry["title"],
            source=entry["source"],
            url=entry["url"],
            content=entry.get("content"),
            summary=summary,
            published_at=entry.get("published_at"),
        )
        session.add(notification)
        new_count += 1

    await session.commit()
    return new_count


async def _generate_summary(title: str, content: str) -> str:
    """调用 LLM 生成通知摘要。"""
    if not content:
        return title

    client = AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )

    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "你是通知摘要助手。请用一句话概括以下通知的核心内容，不超过 50 字。",
            },
            {"role": "user", "content": f"标题：{title}\n内容：{content}"},
        ],
        temperature=0.3,
        max_tokens=100,
    )

    return response.choices[0].message.content.strip()
```

- [ ] **步骤 6: 编写测试**

创建 `backend/tests/test_notification_service.py`:

```python
from services.notification.models import Notification


def test_notification_model_tablename():
    assert Notification.__tablename__ == "notifications"


def test_notification_has_expected_columns():
    columns = [c.name for c in Notification.__table__.columns]
    assert "title" in columns
    assert "source" in columns
    assert "url" in columns
    assert "summary" in columns
    assert "published_at" in columns
```

- [ ] **步骤 7: 运行测试**

```bash
cd backend
pytest tests/test_notification_service.py -v
```

预期: PASS

- [ ] **步骤 8: 提交**

```bash
git add backend/services/notification/ backend/alembic/versions/005_* backend/tests/test_notification_service.py
git commit -m "feat(notification): add notification model, crawler, and AI summary"
```

---

### Task 7: 通知服务层与 API

**文件:**
- 创建: `backend/services/notification/service.py`
- 创建: `backend/services/notification/schemas.py`
- 创建: `backend/services/notification/router.py`

- [ ] **步骤 1: 创建 schema**

创建 `backend/services/notification/schemas.py`:

```python
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    title: str
    source: str
    url: str | None
    summary: str | None
    published_at: datetime | None

    model_config = {"from_attributes": True}
```

- [ ] **步骤 2: 创建服务层**

创建 `backend/services/notification/service.py`:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from services.notification.models import Notification


async def get_notifications(
    session: AsyncSession,
    source: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Notification]:
    query = select(Notification).order_by(Notification.published_at.desc())

    if source:
        query = query.where(Notification.source == source)

    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())
```

- [ ] **步骤 3: 创建路由**

创建 `backend/services/notification/router.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from shared.database import get_session
from services.notification.schemas import NotificationResponse
from services.notification import service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    source: str | None = None,
    limit: int = 20,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
):
    return await service.get_notifications(session, source, limit, offset)
```

- [ ] **步骤 4: 注册路由到 Gateway**

添加到 `backend/gateway/main.py` 的 `create_app()` 中:

```python
from services.notification.router import router as notification_router
app.include_router(notification_router)
```

- [ ] **步骤 5: 提交**

```bash
git add backend/services/notification/service.py backend/services/notification/schemas.py backend/services/notification/router.py backend/gateway/main.py
git commit -m "feat(notification): add notification service and API endpoints"
```

---

## Chunk 3: RAG 课件问答引擎（Sprint 5 末尾）

### Task 8: Milvus 连接与文档分片器

**文件:**
- 创建: `backend/ai_svc/rag/__init__.py`
- 创建: `backend/ai_svc/rag/milvus_client.py`
- 创建: `backend/ai_svc/rag/chunker.py`
- 创建: `backend/tests/test_rag_engine.py`

- [ ] **步骤 1: 创建 `__init__.py`**

创建 `backend/ai_svc/rag/__init__.py`:

```python
```

- [ ] **步骤 2: 创建 Milvus 客户端**

创建 `backend/ai_svc/rag/milvus_client.py`:

```python
"""
Milvus 向量库客户端 — 管理文档向量的存储和检索。

集合结构：
- doc_id: VARCHAR(64) — 文档唯一标识
- chunk_id: VARCHAR(64) — 分片唯一标识
- user_id: INT64 — 所属用户
- text: VARCHAR(2000) — 分片文本
- embedding: FLOAT_VECTOR(1024) — text-embedding-v3 输出维度
"""
from pymilvus import (
    Collection,
    CollectionSchema,
    DataType,
    FieldSchema,
    connections,
    utility,
)
from shared.config import settings

COLLECTION_NAME = "document_chunks"
EMBEDDING_DIM = 1024  # text-embedding-v3


def connect_milvus():
    connections.connect(
        alias="default",
        host=settings.MILVUS_HOST,
        port=settings.MILVUS_PORT,
    )


def get_or_create_collection() -> Collection:
    if utility.has_collection(COLLECTION_NAME):
        return Collection(COLLECTION_NAME)

    fields = [
        FieldSchema("chunk_id", DataType.VARCHAR, max_length=64, is_primary=True),
        FieldSchema("doc_id", DataType.VARCHAR, max_length=64),
        FieldSchema("user_id", DataType.INT64),
        FieldSchema("text", DataType.VARCHAR, max_length=2000),
        FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM),
    ]
    schema = CollectionSchema(fields, description="课件文档分片向量")
    collection = Collection(COLLECTION_NAME, schema)

    # 创建 IVF_FLAT 索引
    collection.create_index(
        field_name="embedding",
        index_params={
            "index_type": "IVF_FLAT",
            "metric_type": "COSINE",
            "params": {"nlist": 128},
        },
    )

    return collection
```

- [ ] **步骤 3: 创建文档分片器**

创建 `backend/ai_svc/rag/chunker.py`:

```python
"""
文档分片器 — 按段落 + 滑动窗口切分文档。

分片策略（与设计文档一致）：
- chunk_size: 512 tokens (约 800 中文字符)
- overlap: 64 tokens (约 100 中文字符)
"""


def chunk_text(
    text: str,
    chunk_size: int = 800,
    overlap: int = 100,
) -> list[str]:
    """
    将长文本切分为重叠的小片段。

    优先按段落边界切分；单段过长时使用滑动窗口。
    """
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 1 <= chunk_size:
            current_chunk = f"{current_chunk}\n{para}" if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # 如果单段超长，滑动窗口切分
            if len(para) > chunk_size:
                start = 0
                while start < len(para):
                    end = start + chunk_size
                    chunks.append(para[start:end])
                    start = end - overlap
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    return chunks
```

- [ ] **步骤 4: 编写测试**

创建 `backend/tests/test_rag_engine.py`:

```python
from ai_svc.rag.chunker import chunk_text


def test_short_text_single_chunk():
    text = "这是一段短文。"
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == "这是一段短文。"


def test_paragraphs_split():
    text = "段落一。" + "\n\n" + "段落二。"
    chunks = chunk_text(text, chunk_size=10)
    assert len(chunks) == 2


def test_long_paragraph_sliding_window():
    text = "字" * 2000
    chunks = chunk_text(text, chunk_size=800, overlap=100)
    assert len(chunks) > 1
    # 验证重叠
    for i in range(len(chunks) - 1):
        overlap_text = chunks[i][-100:]
        assert chunks[i + 1].startswith(overlap_text)


def test_empty_text():
    assert chunk_text("") == []
    assert chunk_text("   ") == []
```

- [ ] **步骤 5: 运行测试**

```bash
cd backend
pytest tests/test_rag_engine.py -v
```

预期: PASS

- [ ] **步骤 6: 提交**

```bash
git add backend/ai_svc/rag/ backend/tests/test_rag_engine.py
git commit -m "feat(rag): add Milvus client and document chunker"
```

---

### Task 9: RAG 引擎核心（Embedding + 检索 + 生成）

**文件:**
- 创建: `backend/ai_svc/rag/engine.py`

- [ ] **步骤 1: 实现 RAG 引擎**

创建 `backend/ai_svc/rag/engine.py`:

```python
"""
RAG 引擎 — 文档上传、向量化、检索、问答。

流程：
1. 上传: 文本 → 分片 → Embedding → 存入 Milvus
2. 查询: 问题 → Query Embedding → 向量检索 Top-K → 拼接上下文 → LLM 生成回答
"""
import uuid
from openai import AsyncOpenAI
from pymilvus import Collection
from ai_svc.rag.chunker import chunk_text
from ai_svc.rag.milvus_client import get_or_create_collection, COLLECTION_NAME
from shared.config import settings


async def get_embedding(text: str) -> list[float]:
    """调用 text-embedding-v3 获取文本向量。"""
    client = AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )
    response = await client.embeddings.create(
        model="text-embedding-v3",
        input=text,
    )
    return response.data[0].embedding


async def upload_document(user_id: int, doc_name: str, text: str) -> dict:
    """上传文档：分片 → Embedding → 存入 Milvus。"""
    chunks = chunk_text(text)
    if not chunks:
        return {"error": "文档内容为空"}

    doc_id = str(uuid.uuid4())[:8]
    collection = get_or_create_collection()

    chunk_ids = []
    doc_ids = []
    user_ids = []
    texts = []
    embeddings = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{doc_id}_{i}"
        embedding = await get_embedding(chunk)

        chunk_ids.append(chunk_id)
        doc_ids.append(doc_id)
        user_ids.append(user_id)
        texts.append(chunk[:2000])  # Milvus VARCHAR 限制
        embeddings.append(embedding)

    collection.insert([chunk_ids, doc_ids, user_ids, texts, embeddings])
    collection.flush()

    return {
        "doc_id": doc_id,
        "doc_name": doc_name,
        "chunks_count": len(chunks),
    }


async def query_documents(user_id: int, question: str, top_k: int = 5) -> dict:
    """RAG 问答：检索相关分片 → LLM 生成回答。"""
    query_embedding = await get_embedding(question)
    collection = get_or_create_collection()
    collection.load()

    results = collection.search(
        data=[query_embedding],
        anns_field="embedding",
        param={"metric_type": "COSINE", "params": {"nprobe": 16}},
        limit=top_k,
        expr=f"user_id == {user_id}",
        output_fields=["text", "doc_id"],
    )

    if not results or not results[0]:
        return {
            "answer": "未找到相关课件内容，请先上传课件文档。",
            "sources": [],
        }

    # 拼接检索到的上下文
    context_parts = []
    sources = []
    for hit in results[0]:
        context_parts.append(hit.entity.get("text"))
        sources.append({
            "doc_id": hit.entity.get("doc_id"),
            "score": round(hit.score, 4),
        })

    context = "\n---\n".join(context_parts)

    # LLM 生成回答
    client = AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )

    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "你是四川大学的 AI 课件助手。根据以下课件内容回答用户的问题。\n"
                    "如果课件中没有相关信息，请如实说明。\n\n"
                    f"课件内容：\n{context}"
                ),
            },
            {"role": "user", "content": question},
        ],
        temperature=0.3,
        max_tokens=1500,
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": sources,
    }
```

- [ ] **步骤 2: 在 ai-svc 中添加 RAG 端点**

追加到 `backend/ai_svc/app.py`（ai-svc 的 FastAPI 应用）:

```python
from fastapi import UploadFile, File, Form, Depends
from ai_svc.rag.engine import upload_document, query_documents
from shared.auth import get_current_user


@app.post("/api/rag/upload")
async def rag_upload(
    file: UploadFile = File(...),
    doc_name: str = Form(...),
    user=Depends(get_current_user),
):
    content = await file.read()
    text = content.decode("utf-8")
    return await upload_document(user.id, doc_name, text)


@app.post("/api/rag/query")
async def rag_query(
    question: str,
    user=Depends(get_current_user),
):
    return await query_documents(user.id, question)
```

- [ ] **步骤 3: Docker Compose 添加 Milvus**

在 `docker-compose.yml` 中添加 Milvus 服务:

```yaml
  milvus:
    image: milvusdb/milvus:v2.4.0
    container_name: scu-milvus
    ports:
      - "19530:19530"
    volumes:
      - milvus_data:/var/lib/milvus
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    depends_on:
      - etcd
      - minio

  etcd:
    image: quay.io/coreos/etcd:v3.5.11
    container_name: scu-etcd
    environment:
      ETCD_AUTO_COMPACTION_MODE: revision
      ETCD_AUTO_COMPACTION_RETENTION: "1000"
      ETCD_QUOTA_BACKEND_BYTES: "4294967296"
    volumes:
      - etcd_data:/etcd

  minio:
    image: minio/minio:latest
    container_name: scu-minio
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/data
    command: server /data
```

在 `volumes` 部分添加:

```yaml
volumes:
  milvus_data:
  etcd_data:
  minio_data:
```

- [ ] **步骤 4: 添加环境变量**

在 `backend/.env.example` 中追加:

```
MILVUS_HOST=localhost
MILVUS_PORT=19530
QWEATHER_API_KEY=your_qweather_key_here
```

- [ ] **步骤 5: 提交**

```bash
git add backend/ai_svc/rag/engine.py backend/ai_svc/app.py docker-compose.yml backend/.env.example
git commit -m "feat(rag): add RAG engine with Milvus vector search and document Q&A"
```

---

## Chunk 4: Morning Briefing + 跨源推理（Sprint 6 前半）

### Task 10: Morning Briefing 服务

**文件:**
- 创建: `backend/services/briefing/__init__.py`
- 创建: `backend/services/briefing/service.py`
- 创建: `backend/tests/test_briefing_service.py`

- [ ] **步骤 1: 创建 `__init__.py`**

创建 `backend/services/briefing/__init__.py`:

```python
```

- [ ] **步骤 2: 实现 Briefing 服务**

创建 `backend/services/briefing/service.py`:

```python
"""
Morning Briefing 服务 — 聚合多源信息，通过 LLM 生成个性化每日简报。

数据来源：
- 今日课表（academic service）
- 临近 DDL（academic service）
- 考试倒计时（academic service）
- 天气 + 穿衣建议（weather service）
- 食堂营业状态（food service）
- 最新通知（notification service）
"""
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI
from shared.config import settings


async def generate_briefing(session: AsyncSession, user_id: int) -> dict:
    """生成用户的 Morning Briefing。"""
    from services.academic import service as academic_svc
    from services.weather.service import get_weather

    # 并行收集多源数据
    today = date.today()
    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday = weekday_names[today.weekday()]

    # 收集数据
    schedule = await academic_svc.get_schedule_by_day(session, user_id, today.weekday())
    deadlines = await academic_svc.get_upcoming_deadlines(session, user_id)
    exams = await academic_svc.get_upcoming_exams(session, user_id)
    weather = await get_weather("成都")

    # 构建数据摘要
    data_summary = f"""今天是 {today.strftime('%Y年%m月%d日')} {weekday}。

【天气】
{weather.get('condition', '未知')}，气温 {weather.get('temperature', '?')}°C，
体感 {weather.get('feels_like', '?')}°C。
穿衣建议：{weather.get('clothing_advice', '无')}

【今日课程】
"""
    if schedule:
        for course in schedule:
            data_summary += f"- {course.course_name} {course.start_time}-{course.end_time} @ {course.location}\n"
    else:
        data_summary += "今天没有课程，好好休息！\n"

    data_summary += "\n【临近 DDL】\n"
    if deadlines:
        for dl in deadlines[:5]:
            days = (dl.due_date - today).days
            data_summary += f"- {dl.title}（还剩 {days} 天）\n"
    else:
        data_summary += "暂无待办 DDL。\n"

    data_summary += "\n【考试倒计时】\n"
    if exams:
        for exam in exams[:3]:
            data_summary += f"- {exam.course_name} {exam.exam_type}（还剩 {exam.days_remaining} 天）\n"
    else:
        data_summary += "近期没有考试。\n"

    # LLM 生成个性化简报
    client = AsyncOpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )

    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "你是四川大学智能校园助手，正在为学生生成每日 Morning Briefing。\n"
                    "请根据以下数据生成一段温馨、简洁的个性化早间问候，包含今日要点提醒。\n"
                    "语气亲切活泼，像一个关心同学的学姐/学长。控制在 200 字以内。"
                ),
            },
            {"role": "user", "content": data_summary},
        ],
        temperature=0.8,
        max_tokens=500,
    )

    return {
        "date": today.isoformat(),
        "weekday": weekday,
        "briefing": response.choices[0].message.content,
        "data": {
            "weather": weather,
            "schedule_count": len(schedule) if schedule else 0,
            "deadline_count": len(deadlines) if deadlines else 0,
            "exam_count": len(exams) if exams else 0,
        },
    }
```

- [ ] **步骤 3: 添加 Briefing API 端点**

在 Gateway 中注册一个 briefing 路由。追加到 `backend/services/briefing/` 一个 `router.py`:

创建 `backend/services/briefing/router.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from shared.database import get_session
from shared.auth import get_current_user
from services.briefing.service import generate_briefing

router = APIRouter(prefix="/api/briefing", tags=["briefing"])


@router.get("")
async def get_briefing(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await generate_briefing(session, user.id)
```

添加到 `backend/gateway/main.py` 的 `create_app()` 中:

```python
from services.briefing.router import router as briefing_router
app.include_router(briefing_router)
```

- [ ] **步骤 4: 编写测试**

创建 `backend/tests/test_briefing_service.py`:

```python
from datetime import date


def test_weekday_names():
    """验证星期映射正确。"""
    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    # 2026-03-15 是周日
    d = date(2026, 3, 15)
    assert weekday_names[d.weekday()] == "周日"


def test_briefing_data_structure():
    """验证 briefing 返回数据结构。"""
    result = {
        "date": "2026-03-15",
        "weekday": "周日",
        "briefing": "早上好！今天天气不错...",
        "data": {
            "weather": {"temperature": 20},
            "schedule_count": 3,
            "deadline_count": 2,
            "exam_count": 1,
        },
    }
    assert "briefing" in result
    assert result["data"]["schedule_count"] == 3
```

- [ ] **步骤 5: 运行测试**

```bash
cd backend
pytest tests/test_briefing_service.py -v
```

预期: PASS

- [ ] **步骤 6: 提交**

```bash
git add backend/services/briefing/ backend/gateway/main.py backend/tests/test_briefing_service.py
git commit -m "feat(briefing): add Morning Briefing service with cross-source aggregation"
```

---

## Chunk 5: 前端 P1 页面（Sprint 6 后半）

### Task 11: 前端类型定义与 API 客户端

**文件:**
- 创建: `frontend/src/lib/types/exam.ts`
- 创建: `frontend/src/lib/types/weather.ts`
- 创建: `frontend/src/lib/types/notification.ts`
- 创建: `frontend/src/lib/api/exam.ts`
- 创建: `frontend/src/lib/api/weather.ts`
- 创建: `frontend/src/lib/api/notification.ts`
- 创建: `frontend/src/lib/api/briefing.ts`
- 创建: `frontend/src/lib/api/rag.ts`

- [ ] **步骤 1: 创建类型定义**

创建 `frontend/src/lib/types/exam.ts`:

```typescript
export interface Exam {
  id: number;
  course_name: string;
  exam_date: string;
  exam_time: string | null;
  location: string | null;
  exam_type: string;
  notes: string | null;
  days_remaining: number;
}

export interface ExamCreate {
  course_name: string;
  exam_date: string;
  exam_time?: string;
  location?: string;
  exam_type?: string;
  notes?: string;
}

export interface ReviewPlan {
  exam: string;
  days_remaining: number;
  plan: string;
}
```

创建 `frontend/src/lib/types/weather.ts`:

```typescript
export interface Weather {
  city: string;
  temperature: number;
  feels_like: number;
  condition: string;
  humidity: number;
  wind_direction: string;
  wind_scale: string;
  clothing_advice: string;
  icon: string;
}
```

创建 `frontend/src/lib/types/notification.ts`:

```typescript
export interface Notification {
  id: number;
  title: string;
  source: string;
  url: string | null;
  summary: string | null;
  published_at: string | null;
}
```

- [ ] **步骤 2: 创建 API 客户端函数**

创建 `frontend/src/lib/api/exam.ts`:

```typescript
import { apiClient } from "./client";
import type { Exam, ExamCreate, ReviewPlan } from "../types/exam";

export async function getExams(): Promise<Exam[]> {
  const { data } = await apiClient.get("/api/academic/exams");
  return data;
}

export async function createExam(exam: ExamCreate): Promise<Exam> {
  const { data } = await apiClient.post("/api/academic/exams", exam);
  return data;
}

export async function deleteExam(id: number): Promise<void> {
  await apiClient.delete(`/api/academic/exams/${id}`);
}

export async function getReviewPlan(examId: number): Promise<ReviewPlan> {
  const { data } = await apiClient.post(`/api/academic/exams/${examId}/review-plan`);
  return data;
}
```

创建 `frontend/src/lib/api/weather.ts`:

```typescript
import { apiClient } from "./client";
import type { Weather } from "../types/weather";

export async function getWeather(city = "成都"): Promise<Weather> {
  const { data } = await apiClient.get("/api/weather", { params: { city } });
  return data;
}
```

创建 `frontend/src/lib/api/notification.ts`:

```typescript
import { apiClient } from "./client";
import type { Notification } from "../types/notification";

export async function getNotifications(
  source?: string,
  limit = 20,
  offset = 0,
): Promise<Notification[]> {
  const { data } = await apiClient.get("/api/notifications", {
    params: { source, limit, offset },
  });
  return data;
}
```

创建 `frontend/src/lib/api/briefing.ts`:

```typescript
import { apiClient } from "./client";

export interface BriefingData {
  date: string;
  weekday: string;
  briefing: string;
  data: {
    weather: Record<string, unknown>;
    schedule_count: number;
    deadline_count: number;
    exam_count: number;
  };
}

export async function getBriefing(): Promise<BriefingData> {
  const { data } = await apiClient.get("/api/briefing");
  return data;
}
```

创建 `frontend/src/lib/api/rag.ts`:

```typescript
import { apiClient } from "./client";

export interface RagUploadResult {
  doc_id: string;
  doc_name: string;
  chunks_count: number;
}

export interface RagQueryResult {
  answer: string;
  sources: Array<{ doc_id: string; score: number }>;
}

export async function uploadDocument(file: File, docName: string): Promise<RagUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_name", docName);
  const { data } = await apiClient.post("/api/rag/upload", formData);
  return data;
}

export async function queryRag(question: string): Promise<RagQueryResult> {
  const { data } = await apiClient.post("/api/rag/query", null, {
    params: { question },
  });
  return data;
}
```

- [ ] **步骤 3: 创建 TanStack Query hooks**

创建 `frontend/src/lib/hooks/use-exams.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExams, createExam, deleteExam } from "../api/exam";
import type { ExamCreate } from "../types/exam";

export function useExams() {
  return useQuery({ queryKey: ["exams"], queryFn: getExams });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExamCreate) => createExam(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}
```

创建 `frontend/src/lib/hooks/use-weather.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getWeather } from "../api/weather";

export function useWeather(city = "成都") {
  return useQuery({
    queryKey: ["weather", city],
    queryFn: () => getWeather(city),
    staleTime: 30 * 60 * 1000, // 30 分钟
  });
}
```

创建 `frontend/src/lib/hooks/use-notifications.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "../api/notification";

export function useNotifications(source?: string) {
  return useQuery({
    queryKey: ["notifications", source],
    queryFn: () => getNotifications(source),
  });
}
```

创建 `frontend/src/lib/hooks/use-briefing.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getBriefing } from "../api/briefing";

export function useBriefing() {
  return useQuery({
    queryKey: ["briefing"],
    queryFn: getBriefing,
    staleTime: 60 * 60 * 1000, // 1 小时
  });
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/lib/types/ frontend/src/lib/api/ frontend/src/lib/hooks/
git commit -m "feat(frontend): add P1 types, API clients, and query hooks"
```

---

### Task 12: 考试倒计时页面

**文件:**
- 创建: `frontend/src/components/academic/exam-countdown.tsx`
- 创建: `frontend/src/components/academic/exam-list.tsx`
- 创建: `frontend/src/app/(main)/academic/exam/page.tsx`

- [ ] **步骤 1: 创建考试倒计时卡片组件**

创建 `frontend/src/components/academic/exam-countdown.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Exam } from "@/lib/types/exam";

interface ExamCountdownProps {
  exam: Exam;
  onGenerateReviewPlan?: (examId: number) => void;
}

export function ExamCountdown({ exam, onGenerateReviewPlan }: ExamCountdownProps) {
  const urgencyColor =
    exam.days_remaining <= 3
      ? "bg-red-500"
      : exam.days_remaining <= 7
        ? "bg-orange-400"
        : "bg-green-500";

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${urgencyColor}`} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{exam.course_name}</CardTitle>
          <Badge variant="outline">{exam.exam_type}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <p>{exam.exam_date} {exam.exam_time || ""}</p>
            {exam.location && <p>{exam.location}</p>}
          </div>
          <div className="text-center">
            <span className={`text-3xl font-bold ${exam.days_remaining <= 3 ? "text-red-500" : ""}`}>
              {exam.days_remaining}
            </span>
            <p className="text-xs text-muted-foreground">天</p>
          </div>
        </div>
        {onGenerateReviewPlan && (
          <button
            onClick={() => onGenerateReviewPlan(exam.id)}
            className="mt-3 w-full text-sm text-primary hover:underline"
          >
            生成 AI 复习计划
          </button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 2: 创建考试列表组件**

创建 `frontend/src/components/academic/exam-list.tsx`:

```tsx
"use client";

import { ExamCountdown } from "./exam-countdown";
import type { Exam } from "@/lib/types/exam";

interface ExamListProps {
  exams: Exam[];
  onGenerateReviewPlan?: (examId: number) => void;
}

export function ExamList({ exams, onGenerateReviewPlan }: ExamListProps) {
  if (exams.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        近期没有考试安排，放松一下吧！
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {exams.map((exam) => (
        <ExamCountdown
          key={exam.id}
          exam={exam}
          onGenerateReviewPlan={onGenerateReviewPlan}
        />
      ))}
    </div>
  );
}
```

- [ ] **步骤 3: 创建考试页面**

创建 `frontend/src/app/(main)/academic/exam/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ExamList } from "@/components/academic/exam-list";
import { useExams } from "@/lib/hooks/use-exams";
import { getReviewPlan } from "@/lib/api/exam";

export default function ExamPage() {
  const { data: exams, isLoading } = useExams();
  const [reviewPlan, setReviewPlan] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const handleGenerateReviewPlan = async (examId: number) => {
    setPlanLoading(true);
    try {
      const result = await getReviewPlan(examId);
      setReviewPlan(result.plan);
    } catch {
      setReviewPlan("生成复习计划失败，请稍后重试。");
    } finally {
      setPlanLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">考试倒计时</h1>

      <ExamList
        exams={exams || []}
        onGenerateReviewPlan={handleGenerateReviewPlan}
      />

      {planLoading && (
        <div className="mt-4 p-4 border rounded-lg animate-pulse">
          AI 正在生成复习计划...
        </div>
      )}

      {reviewPlan && !planLoading && (
        <div className="mt-4 p-4 border rounded-lg prose prose-sm max-w-none">
          <h2 className="text-lg font-semibold mb-2">AI 复习计划</h2>
          <div dangerouslySetInnerHTML={{ __html: reviewPlan }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/components/academic/ frontend/src/app/\(main\)/academic/exam/
git commit -m "feat(frontend): add exam countdown page with AI review plan"
```

---

### Task 13: 天气页面 + 通知聚合页

**文件:**
- 创建: `frontend/src/components/weather/weather-card.tsx`
- 创建: `frontend/src/components/weather/clothing-advice.tsx`
- 创建: `frontend/src/app/(main)/weather/page.tsx`
- 创建: `frontend/src/components/notification/notification-card.tsx`
- 创建: `frontend/src/components/notification/notification-list.tsx`
- 创建: `frontend/src/app/(main)/notification/page.tsx`

- [ ] **步骤 1: 创建天气组件**

创建 `frontend/src/components/weather/weather-card.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Weather } from "@/lib/types/weather";

interface WeatherCardProps {
  weather: Weather;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-4xl">{weather.temperature}°C</span>
          <span className="text-lg text-muted-foreground">{weather.condition}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">体感温度：</span>{weather.feels_like}°C
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">湿度：</span>{weather.humidity}%
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">风向：</span>{weather.wind_direction} {weather.wind_scale}级
        </p>
      </CardContent>
    </Card>
  );
}
```

创建 `frontend/src/components/weather/clothing-advice.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClothingAdviceProps {
  advice: string;
}

export function ClothingAdvice({ advice }: ClothingAdviceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">穿衣建议</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base">{advice}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 2: 创建天气页面**

创建 `frontend/src/app/(main)/weather/page.tsx`:

```tsx
"use client";

import { WeatherCard } from "@/components/weather/weather-card";
import { ClothingAdvice } from "@/components/weather/clothing-advice";
import { useWeather } from "@/lib/hooks/use-weather";

export default function WeatherPage() {
  const { data: weather, isLoading } = useWeather();

  if (isLoading) {
    return <div className="p-6">加载天气数据中...</div>;
  }

  if (!weather) {
    return <div className="p-6">无法获取天气数据</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">成都天气</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <WeatherCard weather={weather} />
        <ClothingAdvice advice={weather.clothing_advice} />
      </div>
    </div>
  );
}
```

- [ ] **步骤 3: 创建通知组件**

创建 `frontend/src/components/notification/notification-card.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Notification } from "@/lib/types/notification";

interface NotificationCardProps {
  notification: Notification;
}

export function NotificationCard({ notification }: NotificationCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base line-clamp-2">{notification.title}</CardTitle>
          <Badge variant="secondary">{notification.source}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {notification.summary && (
          <p className="text-sm text-muted-foreground mb-2">{notification.summary}</p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{notification.published_at?.split("T")[0]}</span>
          {notification.url && (
            <a
              href={notification.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              查看原文
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

创建 `frontend/src/components/notification/notification-list.tsx`:

```tsx
"use client";

import { NotificationCard } from "./notification-card";
import type { Notification } from "@/lib/types/notification";

interface NotificationListProps {
  notifications: Notification[];
}

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂无通知
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} />
      ))}
    </div>
  );
}
```

- [ ] **步骤 4: 创建通知页面**

创建 `frontend/src/app/(main)/notification/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { NotificationList } from "@/components/notification/notification-list";
import { useNotifications } from "@/lib/hooks/use-notifications";

const SOURCES = ["全部", "教务处", "学工部", "研究生院"];

export default function NotificationPage() {
  const [source, setSource] = useState<string | undefined>(undefined);
  const { data: notifications, isLoading } = useNotifications(source);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">校园通知</h1>

      <div className="flex gap-2">
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => setSource(s === "全部" ? undefined : s)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              (s === "全部" && !source) || s === source
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div>加载中...</div>
      ) : (
        <NotificationList notifications={notifications || []} />
      )}
    </div>
  );
}
```

- [ ] **步骤 5: 提交**

```bash
git add frontend/src/components/weather/ frontend/src/app/\(main\)/weather/ frontend/src/components/notification/ frontend/src/app/\(main\)/notification/
git commit -m "feat(frontend): add weather page and notification aggregation page"
```

---

### Task 14: Dashboard 首页（Morning Briefing）

**文件:**
- 创建: `frontend/src/components/dashboard/briefing-card.tsx`
- 创建: `frontend/src/components/dashboard/quick-info-grid.tsx`
- 创建: `frontend/src/app/(main)/dashboard/page.tsx`

- [ ] **步骤 1: 创建 Briefing 卡片**

创建 `frontend/src/components/dashboard/briefing-card.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BriefingCardProps {
  weekday: string;
  date: string;
  briefing: string;
}

export function BriefingCard({ weekday, date, briefing }: BriefingCardProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-xl">
          早上好！今天是 {date} {weekday}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base leading-relaxed whitespace-pre-line">{briefing}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 2: 创建快捷信息网格**

创建 `frontend/src/components/dashboard/quick-info-grid.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickInfoItem {
  label: string;
  value: string | number;
  icon?: string;
}

interface QuickInfoGridProps {
  items: QuickInfoItem[];
}

export function QuickInfoGrid({ items }: QuickInfoGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{item.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **步骤 3: 创建 Dashboard 页面**

创建 `frontend/src/app/(main)/dashboard/page.tsx`:

```tsx
"use client";

import { BriefingCard } from "@/components/dashboard/briefing-card";
import { QuickInfoGrid } from "@/components/dashboard/quick-info-grid";
import { useBriefing } from "@/lib/hooks/use-briefing";
import { useWeather } from "@/lib/hooks/use-weather";

export default function DashboardPage() {
  const { data: briefing, isLoading: briefingLoading } = useBriefing();
  const { data: weather } = useWeather();

  if (briefingLoading) {
    return <div className="p-6">正在生成今日简报...</div>;
  }

  const quickItems = [
    {
      label: "今日课程",
      value: briefing?.data.schedule_count ?? "-",
    },
    {
      label: "待办 DDL",
      value: briefing?.data.deadline_count ?? "-",
    },
    {
      label: "临近考试",
      value: briefing?.data.exam_count ?? "-",
    },
    {
      label: "当前气温",
      value: weather ? `${weather.temperature}°C` : "-",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {briefing && (
        <BriefingCard
          weekday={briefing.weekday}
          date={briefing.date}
          briefing={briefing.briefing}
        />
      )}

      <QuickInfoGrid items={quickItems} />
    </div>
  );
}
```

- [ ] **步骤 4: 更新侧边栏导航**

在 `frontend/src/components/layout/sidebar.tsx` 中，将 Dashboard 添加为第一个导航项:

```typescript
// 添加到导航数组最前面:
{
  title: "首页",
  items: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  ],
},
```

同时添加 P1 新页面的导航:

```typescript
// 在学业模块下新增:
{ label: "考试倒计时", href: "/academic/exam", icon: "Timer" },
{ label: "课件问答", href: "/academic/rag", icon: "FileQuestion" },

// 新增天气和通知:
{
  title: "生活",
  items: [
    { label: "天气穿衣", href: "/weather", icon: "CloudSun" },
    { label: "校园通知", href: "/notification", icon: "Bell" },
  ],
},
```

- [ ] **步骤 5: 提交**

```bash
git add frontend/src/components/dashboard/ frontend/src/app/\(main\)/dashboard/ frontend/src/components/layout/sidebar.tsx
git commit -m "feat(frontend): add Dashboard with Morning Briefing and navigation updates"
```

---

## Chunk 6: RAG 问答前端 + 组件测试（Sprint 6 末）

### Task 15: RAG 课件问答页面

**文件:**
- 创建: `frontend/src/components/academic/rag-chat.tsx`
- 创建: `frontend/src/app/(main)/academic/rag/page.tsx`

- [ ] **步骤 1: 创建 RAG 问答组件**

创建 `frontend/src/components/academic/rag-chat.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { uploadDocument, queryRag, type RagQueryResult } from "@/lib/api/rag";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ doc_id: string; score: number }>;
}

export function RagChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadDocument(file, file.name);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `课件「${result.doc_name}」上传成功，共分为 ${result.chunks_count} 个片段。现在可以对它提问了！`,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "上传失败，请检查文件格式后重试。" },
      ]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const result: RagQueryResult = await queryRag(question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "查询失败，请稍后重试。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            上传课件文档后，可以对其内容进行问答
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    参考来源：{msg.sources.map((s) => `[${s.doc_id}]`).join(" ")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <Card>
              <CardContent className="p-3 text-sm animate-pulse">
                正在从课件中检索回答...
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="border-t p-4 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "上传中..." : "上传课件"}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="对课件提问..."
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          发送
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 创建 RAG 页面**

创建 `frontend/src/app/(main)/academic/rag/page.tsx`:

```tsx
"use client";

import { RagChat } from "@/components/academic/rag-chat";

export default function RagPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold">课件 RAG 问答</h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传课件文档（txt/md），AI 将基于课件内容回答你的问题
        </p>
      </div>
      <div className="flex-1 mt-4">
        <RagChat />
      </div>
    </div>
  );
}
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/components/academic/rag-chat.tsx frontend/src/app/\(main\)/academic/rag/
git commit -m "feat(frontend): add RAG document Q&A page"
```

---

### Task 16: 前端组件测试

**文件:**
- 创建: `frontend/__tests__/components/academic/exam-countdown.test.tsx`
- 创建: `frontend/__tests__/components/weather/weather-card.test.tsx`
- 创建: `frontend/__tests__/components/notification/notification-list.test.tsx`

- [ ] **步骤 1: 考试倒计时组件测试**

创建 `frontend/__tests__/components/academic/exam-countdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ExamCountdown } from "@/components/academic/exam-countdown";

const mockExam = {
  id: 1,
  course_name: "高等数学",
  exam_date: "2026-06-20",
  exam_time: "09:00",
  location: "A101",
  exam_type: "期末考试",
  notes: null,
  days_remaining: 5,
};

describe("ExamCountdown", () => {
  it("渲染课程名称", () => {
    render(<ExamCountdown exam={mockExam} />);
    expect(screen.getByText("高等数学")).toBeDefined();
  });

  it("显示倒计时天数", () => {
    render(<ExamCountdown exam={mockExam} />);
    expect(screen.getByText("5")).toBeDefined();
  });

  it("显示考试类型标签", () => {
    render(<ExamCountdown exam={mockExam} />);
    expect(screen.getByText("期末考试")).toBeDefined();
  });
});
```

- [ ] **步骤 2: 天气卡片组件测试**

创建 `frontend/__tests__/components/weather/weather-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WeatherCard } from "@/components/weather/weather-card";

const mockWeather = {
  city: "成都",
  temperature: 22,
  feels_like: 20,
  condition: "多云",
  humidity: 65,
  wind_direction: "东南风",
  wind_scale: "2",
  clothing_advice: "天气温暖，一件薄外套或长袖即可。",
  icon: "101",
};

describe("WeatherCard", () => {
  it("渲染温度", () => {
    render(<WeatherCard weather={mockWeather} />);
    expect(screen.getByText("22°C")).toBeDefined();
  });

  it("渲染天气状况", () => {
    render(<WeatherCard weather={mockWeather} />);
    expect(screen.getByText("多云")).toBeDefined();
  });
});
```

- [ ] **步骤 3: 通知列表组件测试**

创建 `frontend/__tests__/components/notification/notification-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NotificationList } from "@/components/notification/notification-list";

describe("NotificationList", () => {
  it("空列表显示提示", () => {
    render(<NotificationList notifications={[]} />);
    expect(screen.getByText("暂无通知")).toBeDefined();
  });

  it("渲染通知标题", () => {
    const notifications = [
      {
        id: 1,
        title: "关于期末考试安排的通知",
        source: "教务处",
        url: null,
        summary: "期末考试 17-18 周进行",
        published_at: "2026-06-01T10:00:00",
      },
    ];
    render(<NotificationList notifications={notifications} />);
    expect(screen.getByText("关于期末考试安排的通知")).toBeDefined();
  });
});
```

- [ ] **步骤 4: 运行前端测试**

```bash
cd frontend
npx vitest run
```

预期: 全部 PASS

- [ ] **步骤 5: 提交**

```bash
git add frontend/__tests__/
git commit -m "test(frontend): add component tests for exam, weather, notification"
```

---

## Chunk 7: 打磨与收尾（Sprint 7, W15-16）

### Task 17: UI 打磨与响应式适配

**文件:**
- 修改: 各页面组件（根据实际情况）
- 修改: `frontend/src/app/globals.css`

- [ ] **步骤 1: 检查并修复各页面的移动端适配**

逐一检查以下页面在移动端（375px 宽度）的显示效果:
- Dashboard
- 课表页
- DDL 看板
- 食堂导览
- 校车时刻
- 考试倒计时
- 天气
- 通知
- Chat 对话

确保:
- 所有 grid 布局在移动端降为单列
- 侧边栏可折叠/抽屉式
- 表格水平滚动
- 按钮触摸区域 >= 44px

- [ ] **步骤 2: 添加加载状态骨架屏**

为主要数据页面添加 Skeleton 加载状态:

```tsx
// 使用 shadcn/ui 的 Skeleton 组件
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/
git commit -m "style(frontend): polish UI and add responsive mobile support"
```

---

### Task 18: 端到端测试与测试覆盖率

**文件:**
- 修改: `backend/pyproject.toml`
- 修改: `frontend/vitest.config.ts`

- [ ] **步骤 1: 配置后端测试覆盖率**

在 `backend/pyproject.toml` 中添加 pytest 覆盖率配置:

```toml
[tool.pytest.ini_options]
addopts = "--cov=services --cov=ai_svc --cov=shared --cov-report=html --cov-report=term-missing"
testpaths = ["tests"]
```

- [ ] **步骤 2: 运行后端测试并检查覆盖率**

```bash
cd backend
pip install pytest-cov
pytest --cov --cov-report=term-missing
```

目标: 核心业务逻辑覆盖率 >= 70%

- [ ] **步骤 3: 配置前端覆盖率**

在 `frontend/vitest.config.ts` 中启用覆盖率:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/components/**", "src/lib/**"],
    },
  },
});
```

- [ ] **步骤 4: 运行前端测试并检查覆盖率**

```bash
cd frontend
npx vitest run --coverage
```

- [ ] **步骤 5: 提交**

```bash
git add backend/pyproject.toml frontend/vitest.config.ts
git commit -m "test: configure coverage reporting for backend and frontend"
```

---

### Task 19: 文档完善

**文件:**
- 修改: `README.md`
- 创建: `docs/user-guide.md`（用户手册）
- 创建: `docs/api-docs.md`（API 文档汇总）

- [ ] **步骤 1: 更新 README.md**

确保 README 包含:
- 项目简介
- 技术栈概览
- 快速启动指南（docker-compose up）
- 开发环境搭建
- 项目结构说明
- 团队成员

- [ ] **步骤 2: 编写用户手册**

创建 `docs/user-guide.md`:
- 各功能模块使用说明
- 截图示例
- 常见问题 FAQ

- [ ] **步骤 3: 编写 API 文档汇总**

创建 `docs/api-docs.md`:
- 所有 API 端点列表
- 请求/响应示例
- 认证说明

- [ ] **步骤 4: 提交**

```bash
git add README.md docs/
git commit -m "docs: add user guide, API docs, and update README"
```

---

### Task 20: 答辩准备

- [ ] **步骤 1: 准备答辩 PPT 大纲**

PPT 建议结构:
1. 项目背景与目标（1 页）
2. 技术架构图（1 页）
3. 功能演示（3-5 页，含截图/GIF）
4. AI 能力展示（RAG、对话、Morning Briefing）（2 页）
5. 团队分工与协作流程（1 页）
6. 技术亮点与挑战（1 页）
7. 总结与展望（1 页）

- [ ] **步骤 2: 准备演示环境**

```bash
docker-compose up -d
cd backend && alembic upgrade head
cd backend && python -m seed.load_seeds
```

确保演示数据完整，所有功能可正常运行。

- [ ] **步骤 3: 编写演示脚本**

按以下顺序演示:
1. 登录 → Dashboard（Morning Briefing）
2. 课表查询 → DDL 看板
3. 食堂导览 → "今天吃什么"
4. 考试倒计时 → 生成 AI 复习计划
5. 上传课件 → RAG 问答
6. AI 对话（自然语言查询课表、天气、食堂）
7. 校园通知聚合
