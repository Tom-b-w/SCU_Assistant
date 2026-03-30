"""学习通 API 客户端 - QR登录、课程列表、作业抓取"""
import json
import re
import time
import uuid as uuid_mod
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

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
    qr_url: str
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
        qr_uuid = str(uuid_mod.uuid4())
        resp = await self._http.get(
            f"{PASSPORT_BASE}/createqr",
            params={"uuid": qr_uuid, "fid": "-1"},
        )
        resp.raise_for_status()

        enc = ""
        match = re.search(r'enc\s*=\s*"([^"]+)"', resp.text)
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
        """轮询 QR 码扫描状态"""
        resp = await self._http.post(
            f"{PASSPORT_BASE}/getauthstatus",
            data={"enc": qr_session.enc, "uuid": qr_session.uuid},
        )
        resp.raise_for_status()
        data = resp.json()

        result: dict = {"status": data.get("status", 0)}

        if data.get("status") == 2:
            cookies = {c.name: c.value for c in resp.cookies.jar}
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
            course_data = course.get("data", [{}])
            courses.append(ChaoxingCourse(
                course_id=str(course_data[0].get("id", "")) if course_data else "",
                class_id=str(content.get("id", "")),
                course_name=content.get(
                    "name",
                    course_data[0].get("name", "未知课程") if course_data else "未知课程",
                ),
                teacher_name=content.get("teacherfactor", ""),
            ))
        return courses

    async def get_course_works(
        self, cookies: dict, course_id: str, class_id: str
    ) -> list[ChaoxingWork]:
        """获取某门课程的作业列表（含截止日期）"""
        works: list[ChaoxingWork] = []
        resp = await self._http.get(
            f"{MOOC_BASE}/api/work",
            params={
                "buildRecordByCourseId": course_id,
                "classId": class_id,
                "view": "json",
            },
            cookies=cookies,
        )
        if resp.status_code == 200:
            try:
                data = resp.json()
                for item in data.get("data", []):
                    deadline_ts = item.get("deadline", 0)
                    deadline_str = ""
                    if deadline_ts and deadline_ts > 0:
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
        all_works: list[ChaoxingWork] = []
        for course in courses:
            if not course.course_id:
                continue
            try:
                works = await self.get_course_works(
                    cookies, course.course_id, course.class_id
                )
                for w in works:
                    if not w.course_name:
                        w.course_name = course.course_name
                all_works.extend(works)
            except Exception:
                continue
        return all_works
