"""
四川大学教务系统 (zhjw.scu.edu.cn) 客户端

登录流程:
1. GET /login  → 获取 JSESSIONID cookie
2. GET /img/captcha.jpg → 获取验证码图片
3. POST /j_spring_security_check → 提交学号 + MD5密码 + 验证码
4. 成功后 JSESSIONID 即为已认证 session，可用于后续请求
"""

import hashlib
import re
import uuid
from abc import ABC, abstractmethod
from datetime import time

import httpx


class BaseJwcClient(ABC):
    """教务系统客户端抽象接口"""

    @abstractmethod
    async def start_session(self) -> tuple[str, bytes]:
        """
        创建新会话，获取验证码
        返回: (session_key, captcha_image_bytes)
        """
        ...

    @abstractmethod
    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        """
        验证登录
        返回: 学生信息 dict，失败返回 None
        """
        ...

    @abstractmethod
    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        """获取课表数据"""
        ...

    @abstractmethod
    async def get_scores(self, session_key: str) -> list[dict]:
        """获取成绩数据"""
        ...


class RealJwcClient(BaseJwcClient):
    """真实教务系统客户端 — 对接 zhjw.scu.edu.cn"""

    BASE_URL = "http://zhjw.scu.edu.cn"

    def __init__(self, redis_client):
        self.redis = redis_client

    def _make_http_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
                "Referer": f"{self.BASE_URL}/login",
            },
        )

    async def start_session(self) -> tuple[str, bytes]:
        """访问登录页获取 JSESSIONID，再获取验证码图片"""
        async with self._make_http_client() as client:
            # 1. 访问登录页，获取 JSESSIONID
            resp = await client.get(f"{self.BASE_URL}/login")
            jsessionid = resp.cookies.get("JSESSIONID")
            if not jsessionid:
                # 从 Set-Cookie header 手动提取
                for cookie in resp.cookies.jar:
                    if cookie.name == "JSESSIONID":
                        jsessionid = cookie.value
                        break

            if not jsessionid:
                raise RuntimeError("无法获取教务系统会话")

            # 2. 获取验证码图片
            captcha_resp = await client.get(
                f"{self.BASE_URL}/img/captcha.jpg",
                cookies={"JSESSIONID": jsessionid},
            )
            captcha_bytes = captcha_resp.content

            # 3. 生成 session_key 并将 JSESSIONID 存入 Redis（5分钟过期）
            session_key = f"jwc_session:{uuid.uuid4().hex}"
            await self.redis.set(session_key, jsessionid, ex=300)

            return session_key, captcha_bytes

    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        """用学号 + MD5密码 + 验证码登录教务系统"""
        jsessionid = await self.redis.get(session_key)
        if not jsessionid:
            return None

        # MD5 加密密码
        md5_password = hashlib.md5(password.encode()).hexdigest()

        async with self._make_http_client() as client:
            resp = await client.post(
                f"{self.BASE_URL}/j_spring_security_check",
                data={
                    "j_username": student_id,
                    "j_password": md5_password,
                    "j_captcha": captcha,
                },
                cookies={"JSESSIONID": jsessionid},
            )

            # 检查是否登录成功（失败会重定向到 /login?error=xxx）
            final_url = str(resp.url)
            if "badCredentials" in final_url or "badCaptcha" in final_url or "login" in final_url:
                await self.redis.delete(session_key)
                return None

            # 登录成功，更新 session 过期时间（延长到 30 分钟）
            # 响应可能会更新 JSESSIONID
            new_jsessionid = jsessionid
            for cookie in resp.cookies.jar:
                if cookie.name == "JSESSIONID":
                    new_jsessionid = cookie.value
                    break

            session_data_key = f"jwc_auth:{student_id}"
            await self.redis.set(session_data_key, new_jsessionid, ex=1800)
            await self.redis.delete(session_key)  # 清理临时 session

            # 尝试从教务系统页面提取学生信息
            student_info = await self._fetch_student_info(client, new_jsessionid)
            student_info["student_id"] = student_id

            return student_info

    async def _fetch_student_info(self, client: httpx.AsyncClient, jsessionid: str) -> dict:
        """从教务系统首页提取学生基本信息"""
        try:
            resp = await client.get(
                f"{self.BASE_URL}/student/index",
                cookies={"JSESSIONID": jsessionid},
            )
            html = resp.text
            # 尝试提取姓名（页面上通常有欢迎信息）
            name_match = re.search(r"欢迎.*?(\S+?)同学", html)
            name = name_match.group(1) if name_match else "同学"
            return {"name": name, "campus": None, "major": None, "grade": None}
        except Exception:
            return {"name": "同学", "campus": None, "major": None, "grade": None}

    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        """爬取课表数据"""
        jsessionid = await self.redis.get(session_key)
        if not jsessionid:
            return []

        async with self._make_http_client() as client:
            try:
                resp = await client.get(
                    f"{self.BASE_URL}/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback",
                    params={"planCode": semester},
                    cookies={"JSESSIONID": jsessionid},
                )
                if resp.status_code == 200:
                    return self._parse_schedule(resp.json())
                return []
            except Exception:
                return []

    def _parse_schedule(self, data: dict) -> list[dict]:
        """解析教务系统返回的课表 JSON 数据"""
        courses = []
        try:
            # 教务系统课表数据格式可能因版本不同而变化
            # 这里做通用解析，具体字段需要根据实际返回调整
            items = data if isinstance(data, list) else data.get("dateList", [])
            for item in items:
                course = {
                    "course_name": item.get("courseName", item.get("name", "")),
                    "teacher": item.get("teacherName", item.get("teacher", "")),
                    "location": item.get("roomName", item.get("location", "")),
                    "weekday": item.get("dayOfWeek", item.get("weekday", 0)),
                    "start_time": item.get("startTime", ""),
                    "end_time": item.get("endTime", ""),
                    "weeks": item.get("weeks", []),
                    "start_section": item.get("startSection", 0),
                    "end_section": item.get("endSection", 0),
                }
                if course["course_name"]:
                    courses.append(course)
        except Exception:
            pass
        return courses

    async def get_scores(self, session_key: str) -> list[dict]:
        """爬取成绩数据"""
        jsessionid = await self.redis.get(session_key)
        if not jsessionid:
            return []

        async with self._make_http_client() as client:
            try:
                resp = await client.get(
                    f"{self.BASE_URL}/student/integratedQuery/scoreQuery/allPassingScores/callback",
                    cookies={"JSESSIONID": jsessionid},
                )
                if resp.status_code == 200:
                    return self._parse_scores(resp.json())
                return []
            except Exception:
                return []

    def _parse_scores(self, data: dict) -> list[dict]:
        """解析成绩数据"""
        scores = []
        try:
            items = data if isinstance(data, list) else data.get("list", [])
            for item in items:
                score = {
                    "course_name": item.get("courseName", ""),
                    "credit": item.get("credit", 0),
                    "score": item.get("score", ""),
                    "gpa": item.get("gradePoint", 0),
                    "semester": item.get("semester", ""),
                    "course_type": item.get("courseType", ""),
                }
                if score["course_name"]:
                    scores.append(score)
        except Exception:
            pass
        return scores


class MockJwcClient(BaseJwcClient):
    """开发/测试环境模拟客户端"""

    async def start_session(self) -> tuple[str, bytes]:
        # 返回一个假的 session_key 和一个 1x1 透明 PNG 作为验证码
        fake_captcha = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
            b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
            b'\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        return f"mock_session:{uuid.uuid4().hex}", fake_captcha

    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        if len(student_id) < 5:
            return None
        return {
            "student_id": student_id,
            "name": f"学生{student_id[-4:]}",
            "campus": "望江",
            "major": "计算机科学与技术",
            "grade": 2022,
        }

    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        return [
            {
                "course_name": "高等数学 (A)",
                "teacher": "张教授",
                "location": "一教 B305",
                "weekday": 1,
                "start_time": "08:00",
                "end_time": "09:40",
                "weeks": list(range(1, 17)),
                "start_section": 1,
                "end_section": 2,
            },
            {
                "course_name": "数据结构",
                "teacher": "李教授",
                "location": "二教 C201",
                "weekday": 1,
                "start_time": "10:10",
                "end_time": "11:50",
                "weeks": list(range(1, 17)),
                "start_section": 3,
                "end_section": 4,
            },
            {
                "course_name": "计算机网络",
                "teacher": "王教授",
                "location": "三教 A108",
                "weekday": 3,
                "start_time": "14:00",
                "end_time": "15:40",
                "weeks": list(range(1, 17)),
                "start_section": 5,
                "end_section": 6,
            },
            {
                "course_name": "操作系统",
                "teacher": "赵教授",
                "location": "基教 A301",
                "weekday": 4,
                "start_time": "08:00",
                "end_time": "09:40",
                "weeks": list(range(1, 17)),
                "start_section": 1,
                "end_section": 2,
            },
            {
                "course_name": "软件工程导论",
                "teacher": "刘教授",
                "location": "基教 B201",
                "weekday": 5,
                "start_time": "10:10",
                "end_time": "11:50",
                "weeks": list(range(1, 17)),
                "start_section": 3,
                "end_section": 4,
            },
        ]

    async def get_scores(self, session_key: str) -> list[dict]:
        return [
            {"course_name": "高等数学 (A)", "credit": 5, "score": "92", "gpa": 3.7, "semester": "2024-2025-1", "course_type": "必修"},
            {"course_name": "线性代数", "credit": 3, "score": "88", "gpa": 3.3, "semester": "2024-2025-1", "course_type": "必修"},
            {"course_name": "大学英语", "credit": 2, "score": "85", "gpa": 3.0, "semester": "2024-2025-1", "course_type": "必修"},
        ]


def get_jwc_client(redis_client=None) -> BaseJwcClient:
    """工厂函数: 根据环境返回对应客户端"""
    from shared.config import settings

    if getattr(settings, "jwc_use_mock", True):
        return MockJwcClient()
    return RealJwcClient(redis_client=redis_client)
