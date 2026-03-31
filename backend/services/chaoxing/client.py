"""学习通 API 客户端 - QR登录、课程列表、作业抓取"""
import json
import logging
import re
import time
import uuid as uuid_mod
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

PASSPORT_BASE = "https://passport2.chaoxing.com"
MOOC_API_BASE = "http://mooc1-api.chaoxing.com"
MOOC_BASE = "https://mooc1.chaoxing.com"
MOOC2_ANS_BASE = "https://mooc2-ans.chaoxing.com"
MOBILE_LEARN_BASE = "https://mobilelearn.chaoxing.com"

# 用户身份认证 cookies（跨子域共享），排除 JSESSIONID 等域专属 cookies
_AUTH_COOKIE_KEYS = {
    "UID", "_uid", "vc3", "cx_p_token", "p_auth_token",
    "xxtenc", "DSSTASH_LOG", "fid", "uf", "_d",
}

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
        """
        访问登录页提取 uuid/enc，GET 一次 QR 图片激活 session。
        返回包含 uuid、enc、qr_image_bytes 的会话对象。
        """
        # 1. 获取登录页，拿到 uuid 和 enc（server-side hidden input）
        resp = await self._http.get(
            f"{PASSPORT_BASE}/login",
            params={"fid": "-1"},
            headers={"Accept": "text/html,application/xhtml+xml,*/*;q=0.8"},
        )
        resp.raise_for_status()
        text = resp.text

        uuid_match = re.search(r"createqr\?uuid=([a-f0-9]+)", text)
        qr_uuid = uuid_match.group(1) if uuid_match else str(uuid_mod.uuid4())

        enc_match = re.search(r'id="enc"[^>]*value="([^"]+)"', text)
        if not enc_match:
            enc_match = re.search(r'value="([a-f0-9]{32})"[^>]*id="enc"', text)
        enc = enc_match.group(1) if enc_match else ""

        # 2. GET QR 图片一次，激活服务器端 QR session（必须！否则立即失效）
        qr_image_url = f"{PASSPORT_BASE}/createqr?uuid={qr_uuid}&fid=-1"
        await self._http.get(
            qr_image_url,
            headers={"Referer": f"{PASSPORT_BASE}/login?fid=-1"},
        )

        return QRSession(uuid=qr_uuid, qr_url=qr_image_url, enc=enc)

    async def get_qr_image_url(self, qr_session: QRSession) -> str:
        """返回二维码图片 URL"""
        return qr_session.qr_url

    async def get_qr_image_bytes(self, qr_session: QRSession) -> bytes:
        """获取二维码图片字节（携带 session cookies，供后端代理给前端）"""
        resp = await self._http.get(
            qr_session.qr_url,
            headers={"Referer": f"{PASSPORT_BASE}/login?fid=-1"},
        )
        resp.raise_for_status()
        return resp.content

    async def poll_qr_status(self, qr_session: QRSession) -> dict:
        """
        轮询 QR 码扫描状态（/getauthstatus/v2）
        返回: {"status": 0/1/2/3}
          0 = 未扫描（type==3）
          1 = 已扫码待确认（type==1）
          2 = 登录成功（status==True）
          3 = 已过期（type==2）
        """
        resp = await self._http.post(
            f"{PASSPORT_BASE}/getauthstatus/v2",
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Referer": f"{PASSPORT_BASE}/login?fid=-1",
                "Accept": "application/json, text/javascript, */*; q=0.01",
            },
            data={
                "enc": qr_session.enc,
                "uuid": qr_session.uuid,
                "doubleFactorLogin": "0",
                "forbidotherlogin": "0",
            },
        )
        resp.raise_for_status()
        data = resp.json()

        # 登录成功
        if data.get("status"):
            cookies = {k: v for k, v in self._http.cookies.items()}
            for c in resp.cookies.jar:
                cookies[c.name] = c.value
            redirect_url = data.get("url", "")
            if redirect_url:
                try:
                    await self._http.get(redirect_url)
                    # 捕获重定向链中所有 cookies（包括中间域的 cookies）
                    for k, v in self._http.cookies.items():
                        cookies[k] = v
                except Exception:
                    pass
            # 登录后立即建立 mooc1 session，捕获已认证的 JSESSIONID
            try:
                await self._http.get(
                    f"{MOOC_BASE}/",
                    headers={"Referer": redirect_url or f"{PASSPORT_BASE}/login"},
                )
                for k, v in self._http.cookies.items():
                    cookies[k] = v
            except Exception:
                pass
            return {
                "status": 2,
                "cookies": cookies,
                "uid": data.get("uid", cookies.get("UID", cookies.get("_uid", ""))),
                "uname": data.get("uname", data.get("username", "")),
            }

        tp = data.get("type", "")
        if tp == "2":
            return {"status": 3}  # 已过期
        if tp == "1":
            return {"status": 1}  # 已扫码待确认
        return {"status": 0}      # 等待扫码（type==3 或其他）

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
        self, course_id: str, class_id: str, cookies: dict
    ) -> list[ChaoxingWork]:
        """
        获取某门课程的作业列表。多端点依次尝试：
        1. mobilelearn API（移动端，不依赖 mooc JSESSIONID）
        2. mooc1-api（API 服务器）
        3. mooc1（需要 mooc session）
        """
        # 尝试 1: mobilelearn 移动端 API
        try:
            params: dict = {"courseId": course_id, "classId": class_id, "api": "1"}
            fid = cookies.get("fid", "")
            if fid:
                params["fid"] = fid
            resp = await self._http.get(
                f"{MOBILE_LEARN_BASE}/v2/apis/work/listWorksByCourse",
                params=params,
                cookies=cookies,
                headers={
                    "Referer": f"{MOBILE_LEARN_BASE}/",
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
            logger.info("mobilelearn work status=%s body=%r", resp.status_code, resp.text[:300])
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("workList") or data.get("data") or []
                if items:
                    return self._parse_work_items(items, mobile=True)
        except Exception as e:
            logger.info("mobilelearn work exception: %s", e)

        # 尝试 2: mooc1-api
        try:
            resp = await self._http.get(
                f"{MOOC_API_BASE}/api/work",
                params={"buildRecordByCourseId": course_id, "classId": class_id, "view": "json"},
                cookies=cookies,
                headers={"Referer": f"{MOOC_BASE}/visit/interaction?clazzId={class_id}&type=1"},
            )
            logger.info("mooc1-api work status=%s body=%r", resp.status_code, resp.text[:300])
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data") or []
                if items:
                    return self._parse_work_items(items)
        except Exception as e:
            logger.info("mooc1-api work exception: %s", e)

        # 尝试 3: mooc1（需要 jar 中已认证的 JSESSIONID）
        try:
            resp = await self._http.get(
                f"{MOOC_BASE}/api/work",
                params={"buildRecordByCourseId": course_id, "classId": class_id, "view": "json"},
                headers={
                    "Referer": f"{MOOC_BASE}/visit/interaction?clazzId={class_id}&type=1",
                    "X-Requested-With": "XMLHttpRequest",
                },
            )
            logger.info("mooc1 work status=%s body=%r", resp.status_code, resp.text[:300])
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data") or []
                if items:
                    return self._parse_work_items(items)
        except Exception as e:
            logger.info("mooc1 work exception: %s", e)

        return []

    def _parse_work_items(self, items: list, mobile: bool = False) -> list[ChaoxingWork]:
        """将 API 返回的作业条目解析为 ChaoxingWork 列表"""
        works = []
        for item in items:
            if mobile:
                # 移动端字段名不同
                deadline_raw = item.get("endTime", "") or item.get("deadline", "")
                deadline_str = ""
                if deadline_raw:
                    try:
                        ts = int(str(deadline_raw))
                        deadline_str = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
                    except (ValueError, TypeError):
                        deadline_str = str(deadline_raw)
                works.append(ChaoxingWork(
                    work_id=str(item.get("workId", "")),
                    course_name=item.get("courseName", ""),
                    title=item.get("workName", item.get("title", "未命名作业")),
                    deadline=deadline_str,
                    status=item.get("statusName", item.get("status", "未知")),
                ))
            else:
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
        return works

    async def _establish_mooc_session(self, cookies: dict) -> None:
        """
        将用户身份 cookies 写入 jar（.chaoxing.com），
        如果 cookies 中存有之前登录时捕获的 JSESSIONID，则也恢复到 mooc1 域。
        再访问 mooc1 主页触发 SSO 认证，让服务器颁发（或确认）mooc1 JSESSIONID。
        """
        for name, value in cookies.items():
            if name in _AUTH_COOKIE_KEYS:
                self._http.cookies.set(name, value, domain=".chaoxing.com")
        # 若登录时保存了 mooc1 JSESSIONID，恢复到 mooc1 域
        if "JSESSIONID" in cookies:
            self._http.cookies.set("JSESSIONID", cookies["JSESSIONID"],
                                   domain="mooc1.chaoxing.com")
        try:
            await self._http.get(
                f"{MOOC_BASE}/",
                headers={
                    "Referer": "https://i.chaoxing.com/base",
                    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                },
            )
        except Exception:
            pass

    async def get_all_works(self, cookies: dict) -> list[ChaoxingWork]:
        """获取所有课程的所有作业"""
        courses = await self.get_courses(cookies)
        # 建立 mooc1 域 session（仅用身份 cookies，跳过 JSESSIONID）
        await self._establish_mooc_session(cookies)
        all_works: list[ChaoxingWork] = []
        for course in courses:
            if not course.course_id:
                continue
            try:
                works = await self.get_course_works(
                    course.course_id, course.class_id, cookies
                )
                for w in works:
                    if not w.course_name:
                        w.course_name = course.course_name
                all_works.extend(works)
            except Exception:
                continue
        return all_works
