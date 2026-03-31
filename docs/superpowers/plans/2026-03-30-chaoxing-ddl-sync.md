# 学习通 DDL 自动同步 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现学习通扫码登录 + 自动抓取课程作业截止日期，同步到现有 DDL 模块

**Architecture:** 后端新增 `services/chaoxing/` 模块，通过学习通移动端 API 实现 QR 码登录和作业抓取。用户在前端扫码后，后端保存加密 session，定时或手动触发抓取作业 DDL，写入现有 Deadline 表。前端新增扫码绑定入口和一键同步按钮。

**Tech Stack:** FastAPI, httpx, cryptography (Fernet加密), Alembic, React/TypeScript

---

## File Structure

### Backend (新建)
| File | Responsibility |
|------|---------------|
| `backend/services/chaoxing/__init__.py` | Package init |
| `backend/services/chaoxing/client.py` | 学习通 API 客户端：QR登录、课程列表、作业列表 |
| `backend/services/chaoxing/service.py` | 业务逻辑：session 管理、DDL 同步 |
| `backend/services/chaoxing/router.py` | API 端点：QR码获取、登录状态轮询、手动同步 |
| `backend/services/chaoxing/schemas.py` | Pydantic 请求/响应模型 |
| `backend/services/chaoxing/crypto.py` | Cookie 加密/解密工具 |

### Backend (修改)
| File | Change |
|------|--------|
| `backend/shared/models.py` | 新增 ChaoxingSession 模型 |
| `backend/shared/config.py` | 新增 CHAOXING_ENCRYPT_KEY 配置 |
| `backend/gateway/main.py` | 注册 chaoxing router |
| `backend/pyproject.toml` | 添加 cryptography 依赖 |

### Database
| File | Responsibility |
|------|---------------|
| `backend/alembic/versions/f1a2b3c4d5e6_create_chaoxing_sessions.py` | ChaoxingSession 表迁移 |

### Frontend (新建)
| File | Responsibility |
|------|---------------|
| `frontend/src/lib/chaoxing.ts` | 学习通 API 客户端 |
| `frontend/src/components/chaoxing/qr-login-modal.tsx` | 扫码登录弹窗组件 |

### Frontend (修改)
| File | Change |
|------|--------|
| `frontend/src/app/(main)/academic/deadline/page.tsx` | 添加"从学习通同步"按钮 |

---

## Chunk 1: Backend 基础设施

### Task 1: 数据模型 & 迁移

**Files:**
- Modify: `backend/shared/models.py`
- Modify: `backend/shared/config.py`
- Modify: `backend/pyproject.toml`
- Create: `backend/alembic/versions/f1a2b3c4d5e6_create_chaoxing_sessions.py`

- [ ] **Step 1: 添加 cryptography 依赖**

在 `backend/pyproject.toml` 的 dependencies 中添加：
```toml
"cryptography>=43.0.0",
```

- [ ] **Step 2: 添加配置项**

在 `backend/shared/config.py` 的 Settings 类中添加：
```python
# 学习通
chaoxing_encrypt_key: str = ""  # Fernet key, 自动生成如果为空
```

- [ ] **Step 3: 添加 ChaoxingSession 模型**

在 `backend/shared/models.py` 中添加：
```python
class ChaoxingSession(Base):
    __tablename__ = "chaoxing_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    encrypted_cookies: Mapped[str] = mapped_column(Text)  # Fernet 加密的 JSON cookies
    cx_uid: Mapped[str] = mapped_column(String(50))  # 学习通用户ID
    cx_name: Mapped[str | None] = mapped_column(String(100))  # 学习通用户名
    is_valid: Mapped[bool] = mapped_column(default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="chaoxing_session")
```

同时在 User 模型中添加关系：
```python
chaoxing_session: Mapped["ChaoxingSession | None"] = relationship(back_populates="user", uselist=False)
```

- [ ] **Step 4: 生成 Alembic 迁移**

Run: `cd /e/SCU_Assistant/backend && python -m alembic revision --autogenerate -m "create chaoxing_sessions table"`
Expected: 新迁移文件生成

- [ ] **Step 5: 执行迁移**

Run: `cd /e/SCU_Assistant/backend && python -m alembic upgrade head`
Expected: 表创建成功

- [ ] **Step 6: Commit**

```bash
git add backend/shared/models.py backend/shared/config.py backend/pyproject.toml backend/alembic/versions/
git commit -m "feat(chaoxing): add ChaoxingSession model and migration"
```

---

### Task 2: Cookie 加密工具

**Files:**
- Create: `backend/services/chaoxing/__init__.py`
- Create: `backend/services/chaoxing/crypto.py`

- [ ] **Step 1: 创建包和加密模块**

`backend/services/chaoxing/__init__.py`: 空文件

`backend/services/chaoxing/crypto.py`:
```python
"""学习通 session cookie 加密/解密工具"""
import json
import os

from cryptography.fernet import Fernet

from shared.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.chaoxing_encrypt_key
        if not key:
            key = Fernet.generate_key().decode()
            # 首次运行时打印 key，提示用户保存到 .env
            print(f"[chaoxing] 生成加密密钥，请保存到 .env: CHAOXING_ENCRYPT_KEY={key}")
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_cookies(cookies: dict) -> str:
    """加密 cookie dict -> 密文字符串"""
    data = json.dumps(cookies).encode()
    return _get_fernet().encrypt(data).decode()


def decrypt_cookies(token: str) -> dict:
    """解密密文 -> cookie dict"""
    data = _get_fernet().decrypt(token.encode())
    return json.loads(data)
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/chaoxing/
git commit -m "feat(chaoxing): add cookie encryption utilities"
```

---

### Task 3: 学习通 API 客户端

**Files:**
- Create: `backend/services/chaoxing/client.py`

- [ ] **Step 1: 实现 ChaoxingClient**

`backend/services/chaoxing/client.py`:
```python
"""学习通 API 客户端 - QR登录、课程列表、作业抓取"""
import json
import time
import uuid
from dataclasses import dataclass, field

import httpx

# 学习通 API 基础 URL
PASSPORT_BASE = "https://passport2.chaoxing.com"
MOOC_API_BASE = "http://mooc1-api.chaoxing.com"
MOOC_BASE = "https://mooc1.chaoxing.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 12; Pixel 6) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


@dataclass
class QRSession:
    """QR 码登录会话"""
    uuid: str
    qr_url: str  # 二维码图片 URL
    enc: str = ""
    created_at: float = field(default_factory=time.time)


@dataclass
class ChaoxingCourse:
    """课程信息"""
    course_id: str
    class_id: str
    course_name: str
    teacher_name: str = ""


@dataclass
class ChaoxingWork:
    """作业/任务信息"""
    work_id: str
    course_name: str
    title: str
    deadline: str  # ISO datetime or empty
    status: str  # "未交" / "已交" / "待批阅"


class ChaoxingClient:
    """学习通 API 客户端"""

    def __init__(self):
        self._http = httpx.AsyncClient(
            headers=HEADERS,
            timeout=15.0,
            follow_redirects=True,
        )

    async def close(self):
        await self._http.aclose()

    # ---- QR 码登录流程 ----

    async def create_qr_session(self) -> QRSession:
        """创建 QR 码登录会话，返回二维码图片 URL"""
        qr_uuid = str(uuid.uuid4())
        # 获取 QR 码页面以拿到 enc 参数
        resp = await self._http.get(
            f"{PASSPORT_BASE}/createqr",
            params={"uuid": qr_uuid, "fid": "-1"},
        )
        resp.raise_for_status()

        # 从响应中提取 enc
        text = resp.text
        enc = ""
        if "enc" in text:
            # enc = "xxx" 格式
            import re
            match = re.search(r'enc\s*=\s*"([^"]+)"', text)
            if match:
                enc = match.group(1)

        qr_url = f"{PASSPORT_BASE}/createqr?uuid={qr_uuid}&fid=-1&qrenc={enc}"

        return QRSession(uuid=qr_uuid, qr_url=qr_url, enc=enc)

    async def get_qr_image_url(self, qr_session: QRSession) -> str:
        """获取可直接展示的 QR 图片 URL"""
        return (
            f"{PASSPORT_BASE}/createqr"
            f"?uuid={qr_session.uuid}&fid=-1&qrenc={qr_session.enc}"
        )

    async def poll_qr_status(self, qr_session: QRSession) -> dict:
        """
        轮询 QR 码扫描状态
        返回: {"status": 0/1/2/3, "uid": "...", "cookies": {...}}
          status: 0=未扫描, 1=已扫描待确认, 2=已确认(登录成功), 3=已过期
        """
        resp = await self._http.post(
            f"{PASSPORT_BASE}/getauthstatus",
            data={"enc": qr_session.enc, "uuid": qr_session.uuid},
        )
        resp.raise_for_status()
        data = resp.json()

        result = {"status": data.get("status", 0)}

        if data.get("status") == 2:
            # 登录成功，提取 cookies 和用户信息
            cookies = {c.name: c.value for c in resp.cookies.jar}
            # 也把 redirect URL 中可能的 cookies 合并
            if "url" in data:
                redir_resp = await self._http.get(data["url"])
                for c in redir_resp.cookies.jar:
                    cookies[c.name] = c.value

            result["cookies"] = cookies
            result["uid"] = data.get("uid", cookies.get("UID", ""))
            result["uname"] = data.get("uname", "")

        return result

    # ---- 课程和作业 API ----

    async def get_courses(self, cookies: dict) -> list[ChaoxingCourse]:
        """获取课程列表"""
        resp = await self._http.get(
            f"{MOOC_API_BASE}/mycourse/backclazzdata",
            params={"view": "json", "rss": "1"},
            cookies=cookies,
        )
        resp.raise_for_status()
        data = resp.json()

        courses = []
        for channel in data.get("channelList", []):
            content = channel.get("content", {})
            if not content or not content.get("course"):
                continue
            course = content["course"]
            courses.append(ChaoxingCourse(
                course_id=str(course.get("data", [{}])[0].get("id", "")) if course.get("data") else "",
                class_id=str(content.get("id", "")),
                course_name=content.get("name", course.get("data", [{}])[0].get("name", "未知课程")),
                teacher_name=content.get("teacherfactor", ""),
            ))
        return courses

    async def get_course_works(
        self, cookies: dict, course_id: str, class_id: str
    ) -> list[ChaoxingWork]:
        """获取某门课程的作业列表（含截止日期）"""
        works = []
        # 获取作业列表页
        resp = await self._http.get(
            f"{MOOC_BASE}/visit/stucoursemid498937245480/oldWorkList",
            params={
                "courseId": course_id,
                "classId": class_id,
                "cpi": "",
                "ut": "s",
                "enc": "",
            },
            cookies=cookies,
        )

        # 尝试 API 方式获取
        resp2 = await self._http.get(
            f"{MOOC_BASE}/api/work",
            params={
                "buildRecordByCourseId": course_id,
                "classId": class_id,
                "view": "json",
            },
            cookies=cookies,
        )
        if resp2.status_code == 200:
            try:
                data = resp2.json()
                for item in data.get("data", []):
                    deadline_ts = item.get("deadline", 0)
                    deadline_str = ""
                    if deadline_ts and deadline_ts > 0:
                        from datetime import datetime, timezone
                        deadline_str = datetime.fromtimestamp(
                            deadline_ts / 1000, tz=timezone.utc
                        ).isoformat()

                    works.append(ChaoxingWork(
                        work_id=str(item.get("workId", "")),
                        course_name=item.get("courseName", ""),
                        title=item.get("title", "未命名作业"),
                        deadline=deadline_str,
                        status=item.get("status", "未知"),
                    ))
            except (json.JSONDecodeError, KeyError):
                pass

        return works

    async def get_all_works(self, cookies: dict) -> list[ChaoxingWork]:
        """获取所有课程的所有作业"""
        courses = await self.get_courses(cookies)
        all_works = []
        for course in courses:
            if not course.course_id:
                continue
            try:
                works = await self.get_course_works(
                    cookies, course.course_id, course.class_id
                )
                # 补充课程名
                for w in works:
                    if not w.course_name:
                        w.course_name = course.course_name
                all_works.extend(works)
            except Exception:
                # 单个课程失败不影响其他
                continue
        return all_works
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/chaoxing/client.py
git commit -m "feat(chaoxing): implement Chaoxing API client with QR login and homework fetching"
```

---

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/services/chaoxing/schemas.py`

- [ ] **Step 1: 创建请求/响应模型**

`backend/services/chaoxing/schemas.py`:
```python
"""学习通模块 Pydantic schemas"""
from datetime import datetime

from pydantic import BaseModel


# ---- QR 登录 ----

class QRCodeResponse(BaseModel):
    """QR 码创建响应"""
    session_id: str  # Redis key，前端用于轮询
    qr_image_url: str  # 二维码图片 URL


class QRStatusResponse(BaseModel):
    """QR 码状态轮询响应"""
    status: int  # 0=未扫描, 1=已扫描待确认, 2=登录成功, 3=过期
    message: str


# ---- 绑定状态 ----

class ChaoxingBindStatus(BaseModel):
    """学习通绑定状态"""
    is_bound: bool
    cx_name: str | None = None
    last_sync_at: datetime | None = None


# ---- 同步结果 ----

class SyncResult(BaseModel):
    """DDL 同步结果"""
    total_works: int  # 抓取到的总作业数
    new_deadlines: int  # 新增的 DDL 数
    skipped: int  # 跳过的（已存在或已过期）
    courses: list[str]  # 涉及的课程列表


class CourseInfo(BaseModel):
    """课程信息"""
    course_id: str
    class_id: str
    course_name: str
    teacher_name: str = ""


class WorkInfo(BaseModel):
    """作业信息"""
    work_id: str
    course_name: str
    title: str
    deadline: str
    status: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/chaoxing/schemas.py
git commit -m "feat(chaoxing): add Pydantic schemas for QR login and sync"
```

---

## Chunk 2: Backend 业务逻辑 & API

### Task 5: Service 层

**Files:**
- Create: `backend/services/chaoxing/service.py`

- [ ] **Step 1: 实现 ChaoxingService**

`backend/services/chaoxing/service.py`:
```python
"""学习通业务逻辑：session 管理、DDL 同步"""
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import ChaoxingSession, Deadline
from services.chaoxing.client import ChaoxingClient, QRSession
from services.chaoxing.crypto import encrypt_cookies, decrypt_cookies
from services.chaoxing.schemas import SyncResult

# Redis key 前缀
QR_SESSION_PREFIX = "chaoxing:qr:"
QR_SESSION_TTL = 120  # QR 码有效期 2 分钟


class ChaoxingService:
    def __init__(self):
        self.client = ChaoxingClient()

    async def close(self):
        await self.client.close()

    # ---- QR 码登录流程 ----

    async def start_qr_login(self, redis) -> dict:
        """
        创建 QR 码登录会话
        返回 session_id 和 qr_image_url
        """
        qr = await self.client.create_qr_session()

        # 保存 QR session 到 Redis
        session_id = f"qr_{qr.uuid}"
        await redis.setex(
            f"{QR_SESSION_PREFIX}{session_id}",
            QR_SESSION_TTL,
            json.dumps({"uuid": qr.uuid, "enc": qr.enc}),
        )

        qr_image_url = await self.client.get_qr_image_url(qr)
        return {"session_id": session_id, "qr_image_url": qr_image_url}

    async def check_qr_status(self, redis, session_id: str) -> dict:
        """检查 QR 码扫描状态"""
        raw = await redis.get(f"{QR_SESSION_PREFIX}{session_id}")
        if not raw:
            return {"status": 3, "message": "二维码已过期，请重新获取"}

        qr_data = json.loads(raw)
        qr = QRSession(uuid=qr_data["uuid"], qr_url="", enc=qr_data["enc"])

        result = await self.client.poll_qr_status(qr)
        status = result["status"]

        messages = {
            0: "等待扫码...",
            1: "已扫码，请在手机上确认登录",
            2: "登录成功",
            3: "二维码已过期，请重新获取",
        }

        resp = {"status": status, "message": messages.get(status, "未知状态")}

        if status == 2:
            # 登录成功，临时保存 cookies 到 Redis（等待绑定）
            await redis.setex(
                f"{QR_SESSION_PREFIX}{session_id}:cookies",
                300,  # 5 分钟内完成绑定
                json.dumps({
                    "cookies": result["cookies"],
                    "uid": result.get("uid", ""),
                    "uname": result.get("uname", ""),
                }),
            )
            # 清理 QR session
            await redis.delete(f"{QR_SESSION_PREFIX}{session_id}")

        return resp

    async def bind_account(
        self, db: AsyncSession, redis, user_id: int, session_id: str
    ) -> dict:
        """将学习通账号绑定到当前用户"""
        raw = await redis.get(f"{QR_SESSION_PREFIX}{session_id}:cookies")
        if not raw:
            raise ValueError("登录信息已过期，请重新扫码")

        login_data = json.loads(raw)
        cookies = login_data["cookies"]
        cx_uid = login_data.get("uid", "")
        cx_name = login_data.get("uname", "")

        # 加密 cookies
        encrypted = encrypt_cookies(cookies)

        # 更新或创建 session
        stmt = select(ChaoxingSession).where(ChaoxingSession.user_id == user_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if session:
            session.encrypted_cookies = encrypted
            session.cx_uid = cx_uid
            session.cx_name = cx_name
            session.is_valid = True
            session.updated_at = datetime.now(timezone.utc)
        else:
            session = ChaoxingSession(
                user_id=user_id,
                encrypted_cookies=encrypted,
                cx_uid=cx_uid,
                cx_name=cx_name or "",
                is_valid=True,
            )
            db.add(session)

        await db.commit()
        # 清理 Redis 临时数据
        await redis.delete(f"{QR_SESSION_PREFIX}{session_id}:cookies")

        return {"cx_uid": cx_uid, "cx_name": cx_name}

    # ---- 绑定状态 ----

    async def get_bind_status(self, db: AsyncSession, user_id: int) -> dict:
        """获取绑定状态"""
        stmt = select(ChaoxingSession).where(
            ChaoxingSession.user_id == user_id,
            ChaoxingSession.is_valid == True,
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            return {"is_bound": False, "cx_name": None, "last_sync_at": None}

        return {
            "is_bound": True,
            "cx_name": session.cx_name,
            "last_sync_at": session.last_sync_at,
        }

    async def unbind_account(self, db: AsyncSession, user_id: int):
        """解绑学习通账号"""
        stmt = select(ChaoxingSession).where(ChaoxingSession.user_id == user_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            await db.delete(session)
            await db.commit()

    # ---- DDL 同步 ----

    async def sync_deadlines(self, db: AsyncSession, user_id: int) -> SyncResult:
        """从学习通抓取作业，同步到 DDL 模块"""
        # 获取 session
        stmt = select(ChaoxingSession).where(
            ChaoxingSession.user_id == user_id,
            ChaoxingSession.is_valid == True,
        )
        result = await db.execute(stmt)
        cx_session = result.scalar_one_or_none()
        if not cx_session:
            raise ValueError("未绑定学习通账号")

        # 解密 cookies
        try:
            cookies = decrypt_cookies(cx_session.encrypted_cookies)
        except Exception:
            cx_session.is_valid = False
            await db.commit()
            raise ValueError("学习通登录已过期，请重新扫码绑定")

        # 抓取所有作业
        try:
            works = await self.client.get_all_works(cookies)
        except Exception:
            cx_session.is_valid = False
            await db.commit()
            raise ValueError("学习通 session 已失效，请重新扫码绑定")

        # 获取用户现有 DDL（避免重复）
        stmt = select(Deadline).where(Deadline.user_id == user_id)
        result = await db.execute(stmt)
        existing = result.scalars().all()
        existing_titles = {(d.title, d.course) for d in existing}

        now = datetime.now(timezone.utc)
        new_count = 0
        skipped = 0
        courses = set()

        for work in works:
            courses.add(work.course_name)

            # 解析截止日期
            if not work.deadline:
                skipped += 1
                continue

            try:
                due = datetime.fromisoformat(work.deadline)
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
            except ValueError:
                skipped += 1
                continue

            # 跳过已过期的
            if due < now:
                skipped += 1
                continue

            # 跳过已存在的
            title = f"[学习通] {work.title}"
            if (title, work.course_name) in existing_titles:
                skipped += 1
                continue

            # 创建新 DDL
            deadline = Deadline(
                user_id=user_id,
                title=title,
                course=work.course_name,
                due_date=due,
                priority="medium",
                completed=work.status == "已交",
            )
            db.add(deadline)
            new_count += 1
            existing_titles.add((title, work.course_name))

        # 更新同步时间
        cx_session.last_sync_at = now
        await db.commit()

        return SyncResult(
            total_works=len(works),
            new_deadlines=new_count,
            skipped=skipped,
            courses=sorted(courses),
        )
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/chaoxing/service.py
git commit -m "feat(chaoxing): implement service layer with QR login flow and DDL sync"
```

---

### Task 6: Router (API 端点)

**Files:**
- Create: `backend/services/chaoxing/router.py`
- Modify: `backend/gateway/main.py`

- [ ] **Step 1: 创建 router**

`backend/services/chaoxing/router.py`:
```python
"""学习通 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from shared.database import get_db
from shared.redis_client import get_redis
from services.chaoxing.service import ChaoxingService
from services.chaoxing.schemas import (
    QRCodeResponse,
    QRStatusResponse,
    ChaoxingBindStatus,
    SyncResult,
)

router = APIRouter(prefix="/api/chaoxing", tags=["chaoxing"])

_service: ChaoxingService | None = None


def get_service() -> ChaoxingService:
    global _service
    if _service is None:
        _service = ChaoxingService()
    return _service


@router.post("/qr/create", response_model=QRCodeResponse)
async def create_qr_code(
    user=Depends(get_current_user),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """创建学习通扫码登录二维码"""
    result = await svc.start_qr_login(redis)
    return QRCodeResponse(**result)


@router.get("/qr/status/{session_id}", response_model=QRStatusResponse)
async def check_qr_status(
    session_id: str,
    user=Depends(get_current_user),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """轮询二维码扫描状态"""
    result = await svc.check_qr_status(redis, session_id)
    return QRStatusResponse(**result)


@router.post("/bind/{session_id}")
async def bind_chaoxing_account(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """将扫码登录的学习通账号绑定到当前用户"""
    try:
        result = await svc.bind_account(db, redis, user.id, session_id)
        return {"message": "绑定成功", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status", response_model=ChaoxingBindStatus)
async def get_bind_status(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """获取学习通绑定状态"""
    return await svc.get_bind_status(db, user.id)


@router.delete("/unbind")
async def unbind_chaoxing(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """解绑学习通账号"""
    await svc.unbind_account(db, user.id)
    return {"message": "已解绑"}


@router.post("/sync", response_model=SyncResult)
async def sync_deadlines(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """从学习通同步作业 DDL"""
    try:
        return await svc.sync_deadlines(db, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

- [ ] **Step 2: 在 main.py 注册 router**

在 `backend/gateway/main.py` 中添加：
```python
from services.chaoxing.router import router as chaoxing_router

app.include_router(chaoxing_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/chaoxing/router.py backend/gateway/main.py
git commit -m "feat(chaoxing): add API endpoints for QR login and DDL sync"
```

---

## Chunk 3: Frontend 集成

### Task 7: 前端 API 客户端

**Files:**
- Create: `frontend/src/lib/chaoxing.ts`

- [ ] **Step 1: 创建 API 客户端**

`frontend/src/lib/chaoxing.ts`:
```typescript
import api from "./api"

export interface QRCodeData {
  session_id: string
  qr_image_url: string
}

export interface QRStatus {
  status: number  // 0=未扫描, 1=已扫描待确认, 2=登录成功, 3=过期
  message: string
}

export interface BindStatus {
  is_bound: boolean
  cx_name: string | null
  last_sync_at: string | null
}

export interface SyncResult {
  total_works: number
  new_deadlines: number
  skipped: number
  courses: string[]
}

/** 创建扫码登录二维码 */
export async function createQRCode(): Promise<QRCodeData> {
  const { data } = await api.post("/api/chaoxing/qr/create")
  return data
}

/** 轮询二维码状态 */
export async function checkQRStatus(sessionId: string): Promise<QRStatus> {
  const { data } = await api.get(`/api/chaoxing/qr/status/${sessionId}`)
  return data
}

/** 绑定学习通账号 */
export async function bindChaoxing(sessionId: string): Promise<void> {
  await api.post(`/api/chaoxing/bind/${sessionId}`)
}

/** 获取绑定状态 */
export async function getBindStatus(): Promise<BindStatus> {
  const { data } = await api.get("/api/chaoxing/status")
  return data
}

/** 解绑学习通 */
export async function unbindChaoxing(): Promise<void> {
  await api.delete("/api/chaoxing/unbind")
}

/** 同步 DDL */
export async function syncDeadlines(): Promise<SyncResult> {
  const { data } = await api.post("/api/chaoxing/sync")
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/chaoxing.ts
git commit -m "feat(chaoxing): add frontend API client"
```

---

### Task 8: 扫码登录弹窗组件

**Files:**
- Create: `frontend/src/components/chaoxing/qr-login-modal.tsx`

- [ ] **Step 1: 实现 QR 登录弹窗**

`frontend/src/components/chaoxing/qr-login-modal.tsx`:
```tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createQRCode, checkQRStatus, bindChaoxing, QRCodeData } from "@/lib/chaoxing"

interface QRLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function QRLoginModal({ open, onClose, onSuccess }: QRLoginModalProps) {
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [status, setStatus] = useState<number>(0)
  const [message, setMessage] = useState("正在加载二维码...")
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startLogin = useCallback(async () => {
    stopPolling()
    setLoading(true)
    setStatus(0)
    setMessage("正在加载二维码...")
    try {
      const data = await createQRCode()
      setQrData(data)
      setMessage("请使用学习通 App 扫描二维码")

      // 开始轮询
      pollRef.current = setInterval(async () => {
        try {
          const result = await checkQRStatus(data.session_id)
          setStatus(result.status)
          setMessage(result.message)

          if (result.status === 2) {
            // 登录成功，绑定账号
            stopPolling()
            await bindChaoxing(data.session_id)
            onSuccess()
          } else if (result.status === 3) {
            // 过期
            stopPolling()
          }
        } catch {
          // 轮询出错，静默处理
        }
      }, 2000)
    } catch {
      setMessage("获取二维码失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [stopPolling, onSuccess])

  useEffect(() => {
    if (open) {
      startLogin()
    }
    return () => stopPolling()
  }, [open, startLogin, stopPolling])

  if (!open) return null

  const statusColors: Record<number, string> = {
    0: "text-gray-500",
    1: "text-blue-500",
    2: "text-green-500",
    3: "text-red-500",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-[380px] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">绑定学习通</h3>
          <button
            onClick={() => { stopPolling(); onClose() }}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-[200px] h-[200px] bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
            {qrData ? (
              <img
                src={qrData.qr_image_url}
                alt="学习通登录二维码"
                className="w-full h-full rounded-xl object-contain"
              />
            ) : (
              <div className="animate-pulse text-gray-400">加载中...</div>
            )}
          </div>

          {/* Status */}
          <p className={`text-sm font-medium ${statusColors[status] || "text-gray-500"}`}>
            {status === 1 && "📱 "}
            {status === 2 && "✅ "}
            {message}
          </p>

          {/* Refresh button when expired */}
          {status === 3 && (
            <button
              onClick={startLogin}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "加载中..." : "刷新二维码"}
            </button>
          )}

          {/* Instructions */}
          <div className="text-xs text-gray-400 text-center space-y-1">
            <p>1. 打开学习通 App</p>
            <p>2. 点击右上角扫一扫</p>
            <p>3. 扫描上方二维码并确认</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/chaoxing/qr-login-modal.tsx
git commit -m "feat(chaoxing): add QR code login modal component"
```

---

### Task 9: 集成到 Deadline 页面

**Files:**
- Modify: `frontend/src/app/(main)/academic/deadline/page.tsx`

- [ ] **Step 1: 在 Deadline 页面添加学习通同步功能**

在现有 Deadline 页面中添加：

1. 顶部添加 import：
```typescript
import { QRLoginModal } from "@/components/chaoxing/qr-login-modal"
import { getBindStatus, syncDeadlines, unbindChaoxing, BindStatus, SyncResult } from "@/lib/chaoxing"
```

2. 添加状态变量：
```typescript
const [bindStatus, setBindStatus] = useState<BindStatus | null>(null)
const [showQRModal, setShowQRModal] = useState(false)
const [syncing, setSyncing] = useState(false)
const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
```

3. 添加 useEffect 获取绑定状态：
```typescript
useEffect(() => {
  getBindStatus().then(setBindStatus).catch(() => {})
}, [])
```

4. 添加同步函数：
```typescript
async function handleSync() {
  setSyncing(true)
  setSyncResult(null)
  try {
    const result = await syncDeadlines()
    setSyncResult(result)
    fetchDeadlines()  // 刷新列表
  } catch (err: any) {
    alert(err.response?.data?.detail || "同步失败")
  } finally {
    setSyncing(false)
  }
}

async function handleUnbind() {
  if (!confirm("确定要解绑学习通吗？")) return
  await unbindChaoxing()
  setBindStatus({ is_bound: false, cx_name: null, last_sync_at: null })
}
```

5. 在页面标题区域添加学习通同步按钮（与现有"添加 DDL"按钮并排）：
```tsx
{/* 学习通同步区域 */}
<div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-xl">
  {bindStatus?.is_bound ? (
    <>
      <span className="text-sm text-blue-700">
        ✓ 已绑定: {bindStatus.cx_name || "学习通用户"}
      </span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {syncing ? "同步中..." : "同步作业DDL"}
      </button>
      <button
        onClick={handleUnbind}
        className="px-3 py-1.5 text-red-500 text-sm hover:underline"
      >
        解绑
      </button>
    </>
  ) : (
    <>
      <span className="text-sm text-gray-500">未绑定学习通</span>
      <button
        onClick={() => setShowQRModal(true)}
        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
      >
        扫码绑定
      </button>
    </>
  )}
</div>

{/* 同步结果提示 */}
{syncResult && (
  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
    同步完成：共 {syncResult.total_works} 项作业，新增 {syncResult.new_deadlines} 个 DDL，
    跳过 {syncResult.skipped} 个（已存在或已过期）
    {syncResult.courses.length > 0 && (
      <div className="mt-1 text-xs text-green-600">
        涉及课程：{syncResult.courses.join("、")}
      </div>
    )}
  </div>
)}

{/* QR 码弹窗 */}
<QRLoginModal
  open={showQRModal}
  onClose={() => setShowQRModal(false)}
  onSuccess={() => {
    setShowQRModal(false)
    getBindStatus().then(setBindStatus)
  }}
/>
```

- [ ] **Step 2: 验证页面编译无报错**

Run: `cd /e/SCU_Assistant/frontend && npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(main\)/academic/deadline/page.tsx
git commit -m "feat(chaoxing): integrate Chaoxing sync into deadline page"
```

---

## Chunk 4: 收尾

### Task 10: 安装依赖 & 验证

- [ ] **Step 1: 安装后端依赖**

Run: `cd /e/SCU_Assistant/backend && pip install cryptography`

- [ ] **Step 2: 验证后端启动无报错**

Run: `cd /e/SCU_Assistant/backend && python -c "from services.chaoxing.router import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: 验证前端编译**

Run: `cd /e/SCU_Assistant/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无类型错误

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(chaoxing): complete Chaoxing DDL sync feature with QR login"
```
