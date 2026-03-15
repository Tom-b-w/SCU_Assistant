# Plan 2: 学业模块实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现课表查询、DDL 追踪、选课推荐三个 P0 学业功能，并将登录认证对接真实教务系统。

**架构:** 后端在 `services/academic/` 下新增路由和业务逻辑模块，注册到 Gateway。教务系统对接通过可替换的 `JwcClient` 接口抽象，支持模拟和真实两种实现。前端新增课表周视图、DDL 看板、选课推荐三个页面。

**技术栈:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, httpx (教务爬虫), Next.js 14, TailwindCSS, shadcn/ui, TanStack Query, Vitest, pytest

**设计文档:** `docs/superpowers/specs/2026-03-15-scu-assistant-design.md`

**依赖:** Plan 1 (基础设施 + 核心骨架)

---

## 文件结构

```
backend/
├── services/
│   └── academic/
│       ├── __init__.py
│       ├── router.py              # /api/academic/* 路由
│       ├── service.py             # 课表/DDL/选课业务逻辑
│       ├── schemas.py             # Pydantic 请求/响应模型
│       ├── models.py              # SQLAlchemy ORM (schedules, deadlines)
│       └── jwc_client.py          # 教务系统对接客户端
├── shared/
│   └── models.py                  # 修改: 新增 Schedule, Deadline 模型
├── alembic/versions/
│   └── xxxx_add_academic_tables.py
└── tests/
    ├── test_academic_service.py
    ├── test_academic_router.py
    └── test_jwc_client.py

frontend/
├── src/
│   ├── app/(main)/academic/
│   │   ├── schedule/page.tsx      # 课表周视图
│   │   ├── deadline/page.tsx      # DDL 看板
│   │   └── course-select/page.tsx # 选课推荐
│   ├── components/academic/
│   │   ├── week-schedule.tsx      # 周课表组件
│   │   ├── deadline-card.tsx      # DDL 卡片
│   │   ├── deadline-form.tsx      # DDL 表单 (新增/编辑)
│   │   └── course-recommend-card.tsx # 推荐课程卡片
│   ├── lib/
│   │   └── academic-api.ts        # 学业模块 API 函数
│   └── types/
│       └── academic.ts            # 学业模块类型定义
└── __tests__/
    └── components/academic/
        └── week-schedule.test.tsx
```

---

## Chunk 1: 数据模型与教务系统对接

### Task 1: 学业模块数据模型

**文件:**
- 修改: `backend/shared/models.py`
- 创建: `backend/services/academic/__init__.py`
- 创建: `backend/services/academic/models.py`

- [ ] **步骤 1: 在 shared/models.py 中添加 Schedule 和 Deadline 模型**

```python
# 添加到 backend/shared/models.py 现有的 Base 和 User 模型之后

class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    course_name: Mapped[str] = mapped_column(String(200), nullable=False)
    teacher: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(200))
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-7
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    weeks: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    semester: Mapped[str] = mapped_column(String(20), nullable=False)


class Deadline(Base):
    __tablename__ = "deadlines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    course_name: Mapped[str | None] = mapped_column(String(200))
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

需要在文件顶部补充导入:

```python
from datetime import time
from sqlalchemy import ForeignKey, Time
from sqlalchemy.dialects.postgresql import ARRAY
```

- [ ] **步骤 2: 创建空 `backend/services/academic/__init__.py`**

- [ ] **步骤 3: 生成 Alembic 迁移**

```bash
cd backend
alembic revision --autogenerate -m "add schedules and deadlines tables"
```

- [ ] **步骤 4: 执行迁移并验证**

```bash
cd backend
alembic upgrade head
# 验证: 连接 PostgreSQL 检查 schedules 和 deadlines 表已创建
```

- [ ] **步骤 5: 提交**

```bash
git add backend/shared/models.py backend/services/academic/__init__.py backend/alembic/
git commit -m "feat(academic): 添加课表和DDL数据模型及迁移"
```

---

### Task 2: 教务系统对接客户端

**文件:**
- 创建: `backend/services/academic/jwc_client.py`
- 创建: `backend/tests/test_jwc_client.py`

- [ ] **步骤 1: 编写测试**

创建 `backend/tests/test_jwc_client.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from services.academic.jwc_client import JwcClient, MockJwcClient


@pytest.mark.asyncio
async def test_mock_client_login():
    client = MockJwcClient()
    result = await client.login("2022141461001", "password123")
    assert result is not None
    assert result["student_id"] == "2022141461001"
    assert "name" in result


@pytest.mark.asyncio
async def test_mock_client_get_schedule():
    client = MockJwcClient()
    courses = await client.get_schedule("2022141461001", "2025-2026-2")
    assert isinstance(courses, list)
    assert len(courses) > 0
    assert "course_name" in courses[0]


@pytest.mark.asyncio
async def test_mock_client_login_fail():
    client = MockJwcClient()
    result = await client.login("invalid", "wrong")
    assert result is None
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
cd backend
pytest tests/test_jwc_client.py -v
```

预期: FAIL — `ModuleNotFoundError`

- [ ] **步骤 3: 实现教务系统客户端**

创建 `backend/services/academic/jwc_client.py`:

```python
from abc import ABC, abstractmethod
from datetime import time

import httpx


class BaseJwcClient(ABC):
    """教务系统客户端抽象接口"""

    @abstractmethod
    async def login(self, student_id: str, password: str) -> dict | None:
        """验证登录，成功返回学生信息 dict，失败返回 None"""
        ...

    @abstractmethod
    async def get_schedule(self, student_id: str, semester: str) -> list[dict]:
        """获取课表数据"""
        ...


class MockJwcClient(BaseJwcClient):
    """开发环境模拟客户端"""

    async def login(self, student_id: str, password: str) -> dict | None:
        if len(student_id) < 5:
            return None
        return {
            "student_id": student_id,
            "name": f"学生{student_id[-4:]}",
            "campus": "望江",
            "major": "软件工程",
            "grade": 2022,
        }

    async def get_schedule(self, student_id: str, semester: str) -> list[dict]:
        return [
            {
                "course_name": "软件工程导论",
                "teacher": "张教授",
                "location": "基教A-301",
                "weekday": 1,
                "start_time": "08:00",
                "end_time": "09:40",
                "weeks": list(range(1, 17)),
            },
            {
                "course_name": "数据结构",
                "teacher": "李教授",
                "location": "基教B-201",
                "weekday": 3,
                "start_time": "10:00",
                "end_time": "11:40",
                "weeks": list(range(1, 17)),
            },
            {
                "course_name": "操作系统",
                "teacher": "王教授",
                "location": "基教C-101",
                "weekday": 5,
                "start_time": "14:00",
                "end_time": "15:40",
                "weeks": list(range(1, 17)),
            },
        ]


class RealJwcClient(BaseJwcClient):
    """真实教务系统客户端 (基于已有爬虫对接)"""

    def __init__(self, base_url: str = "http://jwc.scu.edu.cn"):
        self.base_url = base_url
        self.http = httpx.AsyncClient(timeout=10.0, follow_redirects=True)

    async def login(self, student_id: str, password: str) -> dict | None:
        try:
            # 对接现有教务爬虫的登录逻辑
            # 实际实现需要根据现有爬虫代码适配
            resp = await self.http.post(
                f"{self.base_url}/login",
                data={"username": student_id, "password": password},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "student_id": data.get("student_id", student_id),
                    "name": data.get("name", ""),
                    "campus": data.get("campus"),
                    "major": data.get("major"),
                    "grade": data.get("grade"),
                }
            return None
        except Exception:
            return None

    async def get_schedule(self, student_id: str, semester: str) -> list[dict]:
        try:
            resp = await self.http.get(
                f"{self.base_url}/schedule",
                params={"student_id": student_id, "semester": semester},
            )
            if resp.status_code == 200:
                return resp.json()
            return []
        except Exception:
            return []


def get_jwc_client() -> BaseJwcClient:
    """工厂函数: 根据环境返回对应客户端"""
    from shared.config import settings

    if getattr(settings, "jwc_use_mock", True):
        return MockJwcClient()
    return RealJwcClient()
```

- [ ] **步骤 4: 在 config.py 中添加配置项**

在 `backend/shared/config.py` 的 `Settings` 类中添加:

```python
    # 教务系统
    jwc_use_mock: bool = True
    jwc_base_url: str = "http://jwc.scu.edu.cn"
```

- [ ] **步骤 5: 运行测试确认通过**

```bash
cd backend
pytest tests/test_jwc_client.py -v
```

预期: 3 tests PASS

- [ ] **步骤 6: 更新认证路由使用 JwcClient**

修改 `backend/gateway/auth/router.py` 中的 `login` 函数:

```python
@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    from services.academic.jwc_client import get_jwc_client

    jwc = get_jwc_client()
    student_info = await jwc.login(body.student_id, body.password)
    if student_info is None:
        raise UnauthorizedError("学号或密码错误")

    user = await auth_service.create_or_update_user(
        student_id=student_info["student_id"],
        name=student_info["name"],
        campus=student_info.get("campus"),
        major=student_info.get("major"),
        grade=student_info.get("grade"),
    )

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    refresh_token = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )
```

- [ ] **步骤 7: 提交**

```bash
git add backend/services/academic/jwc_client.py backend/tests/test_jwc_client.py backend/shared/config.py backend/gateway/auth/router.py
git commit -m "feat(academic): 添加教务系统对接客户端并替换登录硬编码"
```

---

### Task 3: 学业模块后端 — Schemas + Service

**文件:**
- 创建: `backend/services/academic/schemas.py`
- 创建: `backend/services/academic/service.py`
- 创建: `backend/tests/test_academic_service.py`

- [ ] **步骤 1: 创建 Pydantic schemas**

创建 `backend/services/academic/schemas.py`:

```python
from datetime import datetime, time
from pydantic import BaseModel


class CourseItem(BaseModel):
    course_name: str
    teacher: str | None
    location: str | None
    start_time: str
    end_time: str
    weeks: list[int]

    model_config = {"from_attributes": True}


class ScheduleResponse(BaseModel):
    courses: list[CourseItem]


class DeadlineCreate(BaseModel):
    title: str
    course_name: str | None = None
    due_date: datetime
    priority: str = "medium"


class DeadlineUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None


class DeadlineItem(BaseModel):
    id: int
    title: str
    course_name: str | None
    due_date: datetime
    priority: str
    status: str
    source: str

    model_config = {"from_attributes": True}


class DeadlineListResponse(BaseModel):
    deadlines: list[DeadlineItem]


class CourseRecommendItem(BaseModel):
    name: str
    credits: float
    reason: str


class ConflictItem(BaseModel):
    course_a: str
    course_b: str
    conflict_type: str


class CourseRecommendResponse(BaseModel):
    required: list[CourseRecommendItem]
    elective: list[CourseRecommendItem]
    conflicts: list[ConflictItem]
```

- [ ] **步骤 2: 编写 service 测试**

创建 `backend/tests/test_academic_service.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

from services.academic.service import AcademicService


@pytest.fixture
def academic_service():
    db = AsyncMock()
    return AcademicService(db=db)


@pytest.mark.asyncio
async def test_create_deadline(academic_service):
    academic_service.db.commit = AsyncMock()
    academic_service.db.refresh = AsyncMock()
    academic_service.db.add = MagicMock()

    deadline = await academic_service.create_deadline(
        user_id=1,
        title="交作业",
        due_date=datetime(2026, 4, 1, tzinfo=timezone.utc),
        course_name="软件工程",
        priority="high",
    )
    academic_service.db.add.assert_called_once()


@pytest.mark.asyncio
async def test_get_schedule_by_date(academic_service):
    # 模拟数据库返回
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    academic_service.db.execute = AsyncMock(return_value=mock_result)

    result = await academic_service.get_schedule(user_id=1, weekday=1, semester="2025-2026-2")
    assert isinstance(result, list)
```

- [ ] **步骤 3: 运行测试确认失败**

```bash
cd backend
pytest tests/test_academic_service.py -v
```

预期: FAIL

- [ ] **步骤 4: 实现 AcademicService**

创建 `backend/services/academic/service.py`:

```python
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Schedule, Deadline


class AcademicService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ===== 课表 =====

    async def get_schedule(
        self, user_id: int, weekday: int | None = None, semester: str = "2025-2026-2"
    ) -> list[Schedule]:
        conditions = [Schedule.user_id == user_id, Schedule.semester == semester]
        if weekday is not None:
            conditions.append(Schedule.weekday == weekday)
        result = await self.db.execute(select(Schedule).where(and_(*conditions)))
        return result.scalars().all()

    async def sync_schedule_from_jwc(self, user_id: int, student_id: str, semester: str) -> int:
        """从教务系统同步课表，返回同步的课程数量"""
        from services.academic.jwc_client import get_jwc_client

        jwc = get_jwc_client()
        courses = await jwc.get_schedule(student_id, semester)

        # 删除旧数据
        from sqlalchemy import delete
        await self.db.execute(
            delete(Schedule).where(
                and_(Schedule.user_id == user_id, Schedule.semester == semester)
            )
        )

        # 写入新数据
        for c in courses:
            from datetime import time as dt_time

            schedule = Schedule(
                user_id=user_id,
                course_name=c["course_name"],
                teacher=c.get("teacher"),
                location=c.get("location"),
                weekday=c["weekday"],
                start_time=dt_time.fromisoformat(c["start_time"]),
                end_time=dt_time.fromisoformat(c["end_time"]),
                weeks=c["weeks"],
                semester=semester,
            )
            self.db.add(schedule)

        await self.db.commit()
        return len(courses)

    # ===== DDL =====

    async def get_deadlines(
        self, user_id: int, status: str | None = None
    ) -> list[Deadline]:
        conditions = [Deadline.user_id == user_id]
        if status:
            conditions.append(Deadline.status == status)
        result = await self.db.execute(
            select(Deadline)
            .where(and_(*conditions))
            .order_by(Deadline.due_date.asc())
        )
        return result.scalars().all()

    async def create_deadline(
        self,
        user_id: int,
        title: str,
        due_date: datetime,
        course_name: str | None = None,
        priority: str = "medium",
    ) -> Deadline:
        deadline = Deadline(
            user_id=user_id,
            title=title,
            course_name=course_name,
            due_date=due_date,
            priority=priority,
        )
        self.db.add(deadline)
        await self.db.commit()
        await self.db.refresh(deadline)
        return deadline

    async def update_deadline(self, deadline_id: int, user_id: int, **kwargs) -> Deadline | None:
        result = await self.db.execute(
            select(Deadline).where(
                and_(Deadline.id == deadline_id, Deadline.user_id == user_id)
            )
        )
        deadline = result.scalar_one_or_none()
        if not deadline:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(deadline, key):
                setattr(deadline, key, value)

        await self.db.commit()
        await self.db.refresh(deadline)
        return deadline

    async def delete_deadline(self, deadline_id: int, user_id: int) -> bool:
        result = await self.db.execute(
            select(Deadline).where(
                and_(Deadline.id == deadline_id, Deadline.user_id == user_id)
            )
        )
        deadline = result.scalar_one_or_none()
        if not deadline:
            return False
        await self.db.delete(deadline)
        await self.db.commit()
        return True

    # ===== 选课推荐 =====

    async def get_course_recommendations(self, user_id: int, semester: str) -> dict:
        """基于已修课程推荐下学期选课"""
        current = await self.get_schedule(user_id=user_id, semester=semester)
        current_names = {s.course_name for s in current}

        # 培养方案模拟数据 (实际应从数据库或教务系统获取)
        curriculum = {
            "required": [
                {"name": "编译原理", "credits": 3.0},
                {"name": "计算机网络", "credits": 3.0},
                {"name": "数据库系统", "credits": 3.5},
                {"name": "软件工程导论", "credits": 3.0},
                {"name": "操作系统", "credits": 3.5},
            ],
            "elective": [
                {"name": "机器学习", "credits": 3.0},
                {"name": "云计算技术", "credits": 2.0},
                {"name": "移动应用开发", "credits": 2.5},
                {"name": "信息安全", "credits": 2.0},
            ],
        }

        required = []
        for course in curriculum["required"]:
            if course["name"] not in current_names:
                required.append({
                    "name": course["name"],
                    "credits": course["credits"],
                    "reason": "培养方案必修课，尚未修读",
                })

        elective = []
        for course in curriculum["elective"]:
            if course["name"] not in current_names:
                elective.append({
                    "name": course["name"],
                    "credits": course["credits"],
                    "reason": "专业选修课，推荐修读",
                })

        # 时间冲突检测 (简化: 同 weekday 同 start_time 的课程)
        conflicts = []
        schedules = list(current)
        for i in range(len(schedules)):
            for j in range(i + 1, len(schedules)):
                if (schedules[i].weekday == schedules[j].weekday
                        and schedules[i].start_time == schedules[j].start_time):
                    conflicts.append({
                        "course_a": schedules[i].course_name,
                        "course_b": schedules[j].course_name,
                        "conflict_type": "time_overlap",
                    })

        return {"required": required, "elective": elective, "conflicts": conflicts}
```

- [ ] **步骤 5: 运行测试确认通过**

```bash
cd backend
pytest tests/test_academic_service.py -v
```

预期: PASS

- [ ] **步骤 6: 提交**

```bash
git add backend/services/academic/schemas.py backend/services/academic/service.py backend/tests/test_academic_service.py
git commit -m "feat(academic): 添加学业模块 schemas 和 service 层"
```

---

### Task 4: 学业模块后端 — API 路由

**文件:**
- 创建: `backend/services/academic/router.py`
- 创建: `backend/tests/test_academic_router.py`
- 修改: `backend/gateway/main.py`

- [ ] **步骤 1: 创建路由**

创建 `backend/services/academic/router.py`:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from services.academic.schemas import (
    CourseItem,
    CourseRecommendResponse,
    DeadlineCreate,
    DeadlineItem,
    DeadlineListResponse,
    DeadlineUpdate,
    ScheduleResponse,
)
from services.academic.service import AcademicService
from shared.database import get_db
from shared.exceptions import NotFoundError
from shared.models import User

router = APIRouter(prefix="/api/academic", tags=["academic"])


def get_academic_service(db: AsyncSession = Depends(get_db)) -> AcademicService:
    return AcademicService(db=db)


@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    weekday: int | None = Query(None, ge=1, le=7),
    semester: str = Query("2025-2026-2"),
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    courses = await svc.get_schedule(user_id=user.id, weekday=weekday, semester=semester)
    return ScheduleResponse(
        courses=[CourseItem.model_validate(c) for c in courses]
    )


@router.post("/schedule/sync", response_model=dict)
async def sync_schedule(
    semester: str = Query("2025-2026-2"),
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    count = await svc.sync_schedule_from_jwc(
        user_id=user.id, student_id=user.student_id, semester=semester
    )
    return {"synced_courses": count}


@router.get("/deadlines", response_model=DeadlineListResponse)
async def get_deadlines(
    status: str | None = Query(None),
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    deadlines = await svc.get_deadlines(user_id=user.id, status=status)
    return DeadlineListResponse(
        deadlines=[DeadlineItem.model_validate(d) for d in deadlines]
    )


@router.post("/deadlines", response_model=DeadlineItem, status_code=201)
async def create_deadline(
    body: DeadlineCreate,
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    deadline = await svc.create_deadline(
        user_id=user.id,
        title=body.title,
        due_date=body.due_date,
        course_name=body.course_name,
        priority=body.priority,
    )
    return DeadlineItem.model_validate(deadline)


@router.patch("/deadlines/{deadline_id}", response_model=DeadlineItem)
async def update_deadline(
    deadline_id: int,
    body: DeadlineUpdate,
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    deadline = await svc.update_deadline(
        deadline_id=deadline_id,
        user_id=user.id,
        **body.model_dump(exclude_none=True),
    )
    if not deadline:
        raise NotFoundError("DDL 不存在")
    return DeadlineItem.model_validate(deadline)


@router.delete("/deadlines/{deadline_id}", status_code=204)
async def delete_deadline(
    deadline_id: int,
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    deleted = await svc.delete_deadline(deadline_id=deadline_id, user_id=user.id)
    if not deleted:
        raise NotFoundError("DDL 不存在")


@router.get("/course-recommend", response_model=CourseRecommendResponse)
async def course_recommend(
    semester: str = Query("2025-2026-2"),
    user: User = Depends(get_current_user),
    svc: AcademicService = Depends(get_academic_service),
):
    result = await svc.get_course_recommendations(user_id=user.id, semester=semester)
    return CourseRecommendResponse(**result)
```

- [ ] **步骤 2: 注册路由到 Gateway**

修改 `backend/gateway/main.py`，在 `create_app` 函数中 `app.include_router(auth_router)` 之后添加:

```python
from services.academic.router import router as academic_router
app.include_router(academic_router)
```

- [ ] **步骤 3: 编写路由测试**

创建 `backend/tests/test_academic_router.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport

from gateway.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_schedule_requires_auth(client):
    response = await client.get("/api/academic/schedule")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_deadlines_requires_auth(client):
    response = await client.get("/api/academic/deadlines")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_deadline_requires_auth(client):
    response = await client.post("/api/academic/deadlines", json={
        "title": "测试", "due_date": "2026-04-01T00:00:00Z"
    })
    assert response.status_code == 401
```

- [ ] **步骤 4: 运行测试**

```bash
cd backend
pytest tests/test_academic_router.py -v
```

预期: 3 tests PASS

- [ ] **步骤 5: 提交**

```bash
git add backend/services/academic/router.py backend/gateway/main.py backend/tests/test_academic_router.py
git commit -m "feat(academic): 添加学业模块 API 路由 (课表/DDL/选课推荐)"
```

---

## Chunk 2: 前端学业模块页面

### Task 5: 前端类型定义与 API 函数

**文件:**
- 创建: `frontend/src/types/academic.ts`
- 创建: `frontend/src/lib/academic-api.ts`

- [ ] **步骤 1: 创建类型定义**

创建 `frontend/src/types/academic.ts`:

```typescript
export interface CourseItem {
  course_name: string;
  teacher: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  weeks: number[];
}

export interface ScheduleResponse {
  courses: CourseItem[];
}

export interface DeadlineItem {
  id: number;
  title: string;
  course_name: string | null;
  due_date: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  source: string;
}

export interface DeadlineCreate {
  title: string;
  course_name?: string;
  due_date: string;
  priority?: string;
}

export interface DeadlineUpdate {
  status?: string;
  priority?: string;
  due_date?: string;
}

export interface CourseRecommendItem {
  name: string;
  credits: number;
  reason: string;
}

export interface ConflictItem {
  course_a: string;
  course_b: string;
  conflict_type: string;
}

export interface CourseRecommendResponse {
  required: CourseRecommendItem[];
  elective: CourseRecommendItem[];
  conflicts: ConflictItem[];
}
```

- [ ] **步骤 2: 创建 API 函数**

创建 `frontend/src/lib/academic-api.ts`:

```typescript
import { api } from "./api";
import type {
  ScheduleResponse,
  DeadlineItem,
  DeadlineCreate,
  DeadlineUpdate,
  CourseRecommendResponse,
} from "@/types/academic";

export async function getSchedule(weekday?: number): Promise<ScheduleResponse> {
  const params = weekday ? { weekday } : {};
  const { data } = await api.get<ScheduleResponse>("/api/academic/schedule", { params });
  return data;
}

export async function syncSchedule(): Promise<{ synced_courses: number }> {
  const { data } = await api.post("/api/academic/schedule/sync");
  return data;
}

export async function getDeadlines(status?: string): Promise<{ deadlines: DeadlineItem[] }> {
  const params = status ? { status } : {};
  const { data } = await api.get("/api/academic/deadlines", { params });
  return data;
}

export async function createDeadline(body: DeadlineCreate): Promise<DeadlineItem> {
  const { data } = await api.post<DeadlineItem>("/api/academic/deadlines", body);
  return data;
}

export async function updateDeadline(id: number, body: DeadlineUpdate): Promise<DeadlineItem> {
  const { data } = await api.patch<DeadlineItem>(`/api/academic/deadlines/${id}`, body);
  return data;
}

export async function deleteDeadline(id: number): Promise<void> {
  await api.delete(`/api/academic/deadlines/${id}`);
}

export async function getCourseRecommend(): Promise<CourseRecommendResponse> {
  const { data } = await api.get<CourseRecommendResponse>("/api/academic/course-recommend");
  return data;
}
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/types/academic.ts frontend/src/lib/academic-api.ts
git commit -m "feat(academic): 添加前端学业模块类型定义和 API 函数"
```

---

### Task 6: 课表周视图页面

**文件:**
- 创建: `frontend/src/components/academic/week-schedule.tsx`
- 创建: `frontend/src/app/(main)/academic/schedule/page.tsx`

- [ ] **步骤 1: 创建周课表组件**

创建 `frontend/src/components/academic/week-schedule.tsx`:

```tsx
"use client";

import type { CourseItem } from "@/types/academic";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00",
];

const COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800",
  "bg-green-100 border-green-300 text-green-800",
  "bg-purple-100 border-purple-300 text-purple-800",
  "bg-orange-100 border-orange-300 text-orange-800",
  "bg-pink-100 border-pink-300 text-pink-800",
  "bg-teal-100 border-teal-300 text-teal-800",
];

interface WeekScheduleProps {
  courses: CourseItem[];
}

export function WeekSchedule({ courses }: WeekScheduleProps) {
  const courseColorMap = new Map<string, string>();
  let colorIndex = 0;

  const getColor = (name: string) => {
    if (!courseColorMap.has(name)) {
      courseColorMap.set(name, COLORS[colorIndex % COLORS.length]);
      colorIndex++;
    }
    return courseColorMap.get(name)!;
  };

  const getRow = (timeStr: string) => {
    const hour = parseInt(timeStr.split(":")[0]);
    return hour - 7; // 08:00 → row 1
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-8 min-w-[800px] gap-px bg-gray-200 rounded-lg overflow-hidden">
        {/* 表头 */}
        <div className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-500">
          时间
        </div>
        {WEEKDAYS.map((day) => (
          <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium">
            {day}
          </div>
        ))}

        {/* 时间格 */}
        {TIME_SLOTS.map((slot) => (
          <>
            <div key={slot} className="bg-white p-2 text-xs text-gray-400 text-center">
              {slot}
            </div>
            {WEEKDAYS.map((_, dayIdx) => {
              const course = courses.find(
                (c) =>
                  c.weekday === dayIdx + 1 &&
                  c.start_time <= slot &&
                  c.end_time > slot
              );
              const isStart = course && course.start_time === slot;
              return (
                <div key={`${slot}-${dayIdx}`} className="bg-white p-1 min-h-[48px]">
                  {isStart && (
                    <div
                      className={`rounded p-1.5 text-xs border ${getColor(course.course_name)}`}
                    >
                      <div className="font-medium">{course.course_name}</div>
                      <div className="opacity-70">{course.location}</div>
                      <div className="opacity-70">{course.teacher}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 创建课表页面**

创建 `frontend/src/app/(main)/academic/schedule/page.tsx`:

```tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { WeekSchedule } from "@/components/academic/week-schedule";
import { getSchedule, syncSchedule } from "@/lib/academic-api";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => getSchedule(),
  });

  const syncMutation = useMutation({
    mutationFn: syncSchedule,
    onMutate: () => setSyncing(true),
    onSettled: () => setSyncing(false),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      alert(`已同步 ${result.synced_courses} 门课程`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">课表</h2>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          从教务系统同步
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : data?.courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          暂无课表数据，请点击"从教务系统同步"导入
        </div>
      ) : (
        <WeekSchedule courses={data?.courses || []} />
      )}
    </div>
  );
}
```

- [ ] **步骤 3: 验证页面渲染**

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000/academic/schedule → 课表页面
```

- [ ] **步骤 4: 提交**

```bash
git add frontend/src/components/academic/week-schedule.tsx frontend/src/app/\(main\)/academic/schedule/
git commit -m "feat(academic): 添加课表周视图页面"
```

---

### Task 7: DDL 看板页面

**文件:**
- 创建: `frontend/src/components/academic/deadline-card.tsx`
- 创建: `frontend/src/components/academic/deadline-form.tsx`
- 创建: `frontend/src/app/(main)/academic/deadline/page.tsx`

- [ ] **步骤 1: 创建 DDL 卡片组件**

创建 `frontend/src/components/academic/deadline-card.tsx`:

```tsx
"use client";

import type { DeadlineItem } from "@/types/academic";
import { Button } from "@/components/ui/button";
import { Check, Trash2 } from "lucide-react";

const PRIORITY_COLORS = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

interface DeadlineCardProps {
  deadline: DeadlineItem;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}

export function DeadlineCard({ deadline, onComplete, onDelete }: DeadlineCardProps) {
  const dueDate = new Date(deadline.due_date);
  const now = new Date();
  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  return (
    <div
      className={`rounded-lg border border-l-4 bg-white p-4 shadow-sm dark:bg-gray-950 ${
        PRIORITY_COLORS[deadline.priority as keyof typeof PRIORITY_COLORS] || "border-l-gray-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">{deadline.title}</h4>
          {deadline.course_name && (
            <p className="text-sm text-gray-500">{deadline.course_name}</p>
          )}
          <p className={`text-sm ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {isOverdue ? `已逾期 ${Math.abs(daysLeft)} 天` : `剩余 ${daysLeft} 天`}
          </p>
        </div>
        <div className="flex gap-1">
          {deadline.status === "pending" && (
            <Button size="icon" variant="ghost" onClick={() => onComplete(deadline.id)}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onDelete(deadline.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2: 创建 DDL 表单组件**

创建 `frontend/src/components/academic/deadline-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeadlineCreate } from "@/types/academic";

interface DeadlineFormProps {
  onSubmit: (data: DeadlineCreate) => void;
  onCancel: () => void;
}

export function DeadlineForm({ onSubmit, onCancel }: DeadlineFormProps) {
  const [title, setTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      course_name: courseName || undefined,
      due_date: new Date(dueDate).toISOString(),
      priority,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
      <Input placeholder="DDL 标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input placeholder="课程名称（可选）" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
      <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      <select
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      >
        <option value="low">低优先级</option>
        <option value="medium">中优先级</option>
        <option value="high">高优先级</option>
      </select>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">添加</Button>
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </form>
  );
}
```

- [ ] **步骤 3: 创建 DDL 看板页面**

创建 `frontend/src/app/(main)/academic/deadline/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DeadlineCard } from "@/components/academic/deadline-card";
import { DeadlineForm } from "@/components/academic/deadline-form";
import { getDeadlines, createDeadline, updateDeadline, deleteDeadline } from "@/lib/academic-api";
import { Plus } from "lucide-react";

export default function DeadlinePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["deadlines", filter],
    queryFn: () => getDeadlines(filter),
  });

  const createMut = useMutation({
    mutationFn: createDeadline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      setShowForm(false);
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => updateDeadline(id, { status: "completed" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deadlines"] }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDeadline,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deadlines"] }),
  });

  const deadlines = data?.deadlines || [];
  const pending = deadlines.filter((d) => d.status === "pending");
  const completed = deadlines.filter((d) => d.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">DDL 追踪</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          新增 DDL
        </Button>
      </div>

      {showForm && (
        <DeadlineForm
          onSubmit={(data) => createMut.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">待完成 ({pending.length})</h3>
          {pending.map((d) => (
            <DeadlineCard
              key={d.id}
              deadline={d}
              onComplete={(id) => completeMut.mutate(id)}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
          {pending.length === 0 && (
            <p className="text-gray-400 text-sm">暂无待完成的 DDL</p>
          )}
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-400">已完成 ({completed.length})</h3>
          {completed.map((d) => (
            <DeadlineCard
              key={d.id}
              deadline={d}
              onComplete={() => {}}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 4: 验证页面渲染**

```bash
cd frontend
npm run dev
# 访问 http://localhost:3000/academic/deadline → DDL 看板
```

- [ ] **步骤 5: 提交**

```bash
git add frontend/src/components/academic/ frontend/src/app/\(main\)/academic/deadline/
git commit -m "feat(academic): 添加 DDL 看板页面 (卡片/表单/看板视图)"
```

---

### Task 8: 选课推荐页面

**文件:**
- 创建: `frontend/src/components/academic/course-recommend-card.tsx`
- 创建: `frontend/src/app/(main)/academic/course-select/page.tsx`

- [ ] **步骤 1: 创建推荐课程卡片**

创建 `frontend/src/components/academic/course-recommend-card.tsx`:

```tsx
import type { CourseRecommendItem } from "@/types/academic";

interface CourseRecommendCardProps {
  course: CourseRecommendItem;
  type: "required" | "elective";
}

export function CourseRecommendCard({ course, type }: CourseRecommendCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{course.name}</h4>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            type === "required"
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {type === "required" ? "必修" : "选修"}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{course.credits} 学分</p>
      <p className="mt-1 text-sm text-gray-400">{course.reason}</p>
    </div>
  );
}
```

- [ ] **步骤 2: 创建选课推荐页面**

创建 `frontend/src/app/(main)/academic/course-select/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { CourseRecommendCard } from "@/components/academic/course-recommend-card";
import { getCourseRecommend } from "@/lib/academic-api";
import { AlertTriangle } from "lucide-react";

export default function CourseSelectPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["course-recommend"],
    queryFn: getCourseRecommend,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">选课推荐</h2>

      {data?.conflicts && data.conflicts.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-medium">时间冲突提醒</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-yellow-700">
            {data.conflicts.map((c, i) => (
              <li key={i}>「{c.course_a}」与「{c.course_b}」时间冲突</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3">必修课（未修读）</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.required.map((c) => (
            <CourseRecommendCard key={c.name} course={c} type="required" />
          ))}
        </div>
        {data?.required.length === 0 && (
          <p className="text-gray-400 text-sm">所有必修课已修读完毕</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">推荐选修课</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.elective.map((c) => (
            <CourseRecommendCard key={c.name} course={c} type="elective" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/components/academic/course-recommend-card.tsx frontend/src/app/\(main\)/academic/course-select/
git commit -m "feat(academic): 添加选课推荐页面"
```

---

### Task 9: 前端 QueryClient Provider 配置

**文件:**
- 修改: `frontend/src/app/layout.tsx`

- [ ] **步骤 1: 创建 providers 组件**

创建 `frontend/src/components/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 分钟
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **步骤 2: 在 root layout 中包裹 Providers**

修改 `frontend/src/app/layout.tsx`，在 `<body>` 标签内用 `<Providers>` 包裹 `{children}`:

```tsx
import { Providers } from "@/components/providers";

// ... 在 return 中:
<body>
  <Providers>{children}</Providers>
</body>
```

- [ ] **步骤 3: 提交**

```bash
git add frontend/src/components/providers.tsx frontend/src/app/layout.tsx
git commit -m "feat: 添加 QueryClientProvider 全局配置"
```

---

### Task 10: 最终验证

- [ ] **步骤 1: 运行所有后端测试**

```bash
cd backend
pytest -v
```

预期: 所有测试 PASS

- [ ] **步骤 2: 运行所有前端测试**

```bash
cd frontend
npm test
```

预期: 所有测试 PASS

- [ ] **步骤 3: 端到端验证**

```bash
docker compose up -d --build
# 1. 访问 http://localhost:3000/login → 登录
# 2. 访问 /academic/schedule → 课表页面，点击同步
# 3. 访问 /academic/deadline → DDL 看板，新增/完成/删除 DDL
# 4. 访问 /academic/course-select → 选课推荐
# 5. 验证 http://localhost:8000/docs → Swagger 中出现 academic 接口
docker compose down
```
