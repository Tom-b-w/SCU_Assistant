"""学习通业务逻辑：session 管理、DDL 同步"""
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import ChaoxingSession, Deadline
from services.chaoxing.client import ChaoxingClient, QRSession
from services.chaoxing.crypto import encrypt_cookies, decrypt_cookies
from services.chaoxing.schemas import SyncResult

QR_SESSION_PREFIX = "chaoxing:qr:"
QR_SESSION_TTL = 120  # 二维码有效期 2 分钟


class ChaoxingService:
    def __init__(self):
        self.client = ChaoxingClient()

    async def close(self):
        await self.client.close()

    # ---- QR 码登录流程 ----

    async def start_qr_login(self, redis) -> dict:
        """创建 QR 码登录会话，返回 session_id 和 qr_image_url"""
        qr = await self.client.create_qr_session()

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
            # 登录成功，临时保存 cookies 到 Redis（5 分钟内完成绑定）
            await redis.setex(
                f"{QR_SESSION_PREFIX}{session_id}:cookies",
                300,
                json.dumps({
                    "cookies": result["cookies"],
                    "uid": result.get("uid", ""),
                    "uname": result.get("uname", ""),
                }),
            )
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

        encrypted = encrypt_cookies(cookies)

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
        await redis.delete(f"{QR_SESSION_PREFIX}{session_id}:cookies")

        return {"cx_uid": cx_uid, "cx_name": cx_name}

    # ---- 绑定状态 ----

    async def get_bind_status(self, db: AsyncSession, user_id: int) -> dict:
        """获取绑定状态"""
        stmt = select(ChaoxingSession).where(
            ChaoxingSession.user_id == user_id,
            ChaoxingSession.is_valid == True,  # noqa: E712
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
        stmt = select(ChaoxingSession).where(
            ChaoxingSession.user_id == user_id,
            ChaoxingSession.is_valid == True,  # noqa: E712
        )
        result = await db.execute(stmt)
        cx_session = result.scalar_one_or_none()
        if not cx_session:
            raise ValueError("未绑定学习通账号")

        try:
            cookies = decrypt_cookies(cx_session.encrypted_cookies)
        except Exception:
            cx_session.is_valid = False
            await db.commit()
            raise ValueError("学习通登录已过期，请重新扫码绑定")

        try:
            works = await self.client.get_all_works(cookies)
        except Exception:
            cx_session.is_valid = False
            await db.commit()
            raise ValueError("学习通 session 已失效，请重新扫码绑定")

        # 获取现有 DDL 避免重复
        stmt = select(Deadline).where(Deadline.user_id == user_id)
        result = await db.execute(stmt)
        existing_titles = {(d.title, d.course) for d in result.scalars().all()}

        now = datetime.now(timezone.utc)
        new_count = 0
        skipped = 0
        courses: set[str] = set()

        for work in works:
            courses.add(work.course_name)

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

            if due < now:
                skipped += 1
                continue

            title = f"[学习通] {work.title}"
            if (title, work.course_name) in existing_titles:
                skipped += 1
                continue

            db.add(Deadline(
                user_id=user_id,
                title=title,
                course=work.course_name,
                due_date=due,
                priority="medium",
                completed=work.status == "已交",
            ))
            new_count += 1
            existing_titles.add((title, work.course_name))

        cx_session.last_sync_at = now
        await db.commit()

        return SyncResult(
            total_works=len(works),
            new_deadlines=new_count,
            skipped=skipped,
            courses=sorted(courses),
        )
