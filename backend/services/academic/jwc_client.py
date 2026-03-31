"""
四川大学教务系统 (zhjw.scu.edu.cn) 客户端

登录流程:
1. GET /login  → 获取 student.urpSoft.cn cookie + tokenValue 隐藏字段
2. GET /img/captcha.jpg → 获取验证码图片
3. POST /j_spring_security_check → 提交 j_username + j_password(MD5) + j_captcha + tokenValue
4. 成功后 cookie 即为已认证 session，可用于后续请求

数据接口:
- 课表: /student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback
- 成绩: /student/integratedQuery/scoreQuery/allPassingScores/callback
- 方案完成: /student/integratedQuery/planCompletion/index (HTML 解析)
"""

import hashlib
import json
import logging
import re
import struct
import uuid
import zlib
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger(__name__)

# SCU 教务系统使用的 cookie 名称
SESSION_COOKIE_NAME = "student.urpSoft.cn"


def _get_field(item: dict, *keys, default=""):
    """从 dict 中按多个可能的 key 依次尝试取值"""
    for k in keys:
        v = item.get(k)
        if v is not None and v != "":
            return v
    return default


class BaseJwcClient(ABC):
    """教务系统客户端抽象接口"""

    @abstractmethod
    async def start_session(self) -> tuple[str, bytes]:
        ...

    @abstractmethod
    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        ...

    @abstractmethod
    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        ...

    @abstractmethod
    async def get_scores(self, session_key: str) -> list[dict]:
        ...

    @abstractmethod
    async def get_plan_completion(self, session_key: str) -> dict:
        ...


class RealJwcClient(BaseJwcClient):
    """真实教务系统客户端 — 对接 zhjw.scu.edu.cn"""

    _COMMON_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
                  "application/json,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    def __init__(self, redis_client, base_url: str = "http://zhjw.scu.edu.cn"):
        self.redis = redis_client
        self.BASE_URL = base_url.rstrip("/")

    def _make_http_client(self, session_value: str | bytes | None = None) -> httpx.AsyncClient:
        """创建 httpx 客户端，如果提供 session_value 则预置到 cookie jar 中。
        session_value 支持两种格式：
        - JSON 字符串: {"session": "xxx", "lb": "yyy"} — 包含负载均衡 cookie
        - 纯字符串: 仅 student.urpSoft.cn 的值（向后兼容）
        """
        if isinstance(session_value, bytes):
            session_value = session_value.decode("utf-8")

        cookies = None
        if session_value:
            try:
                parsed = json.loads(session_value)
                cookies = {SESSION_COOKIE_NAME: parsed["session"]}
                if parsed.get("lb"):
                    cookies["XUANKE_LB"] = parsed["lb"]
            except (json.JSONDecodeError, KeyError, TypeError):
                # 向后兼容：纯 cookie 字符串
                cookies = {SESSION_COOKIE_NAME: session_value}

        return httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            cookies=cookies,
            headers=self._COMMON_HEADERS,
        )

    def _session_cookies(self, session_value: str) -> dict:
        """构造教务系统的 session cookie"""
        return {SESSION_COOKIE_NAME: session_value}

    async def start_session(self) -> tuple[str, bytes]:
        """访问登录页获取会话 cookie + 验证码图片"""
        async with self._make_http_client() as client:
            # 1. 访问登录页
            resp = await client.get(f"{self.BASE_URL}/login")
            session_value = self._extract_session_cookie(resp)

            if not session_value:
                raise RuntimeError("无法获取教务系统会话，请检查网络是否可访问 zhjw.scu.edu.cn")

            # 提取负载均衡 cookie
            lb_value = resp.cookies.get("XUANKE_LB", "")
            logger.info("获取到教务系统会话 cookie: %s..., LB: %s", session_value[:12], lb_value[:12] if lb_value else "NONE")

            # 提取 tokenValue 隐藏字段
            token_match = re.search(r'name="tokenValue"\s*value="([^"]+)"', resp.text)
            token_value = token_match.group(1) if token_match else ""
            logger.info("提取到 tokenValue: %s", token_value[:12] if token_value else "NONE")

            # 2. 获取验证码图片 — 使用 cookie jar (client 自动带)
            client.cookies[SESSION_COOKIE_NAME] = session_value
            if lb_value:
                client.cookies["XUANKE_LB"] = lb_value
            captcha_resp = await client.get(f"{self.BASE_URL}/img/captcha.jpg")
            captcha_bytes = captcha_resp.content
            logger.info("获取到验证码图片: %d bytes, content-type: %s",
                        len(captcha_bytes), captcha_resp.headers.get("content-type"))

            # 3. 存入 Redis（5分钟过期）
            session_key = f"jwc_session:{uuid.uuid4().hex}"
            session_data = json.dumps({
                "cookie": session_value,
                "token": token_value,
                "lb": lb_value,
            })
            await self.redis.set(session_key, session_data, ex=300)

            return session_key, captcha_bytes

    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        """用学号 + MD5密码 + 验证码登录教务系统"""
        session_data_str = await self.redis.get(session_key)
        if not session_data_str:
            logger.warning("session_key 不存在或已过期: %s", session_key)
            return None

        # 解析存储的会话数据
        lb_value = ""
        try:
            session_data = json.loads(session_data_str)
            session_value = session_data["cookie"]
            token_value = session_data.get("token", "")
            lb_value = session_data.get("lb", "")
        except (json.JSONDecodeError, KeyError):
            # 兼容旧格式 (纯 cookie 值)
            session_value = session_data_str if isinstance(session_data_str, str) else session_data_str.decode()
            token_value = ""

        # 教务系统密码加密: hex_md5(hex_md5(pwd+salt), ver=1.8) + '*' + hex_md5(hex_md5(pwd, ver=1.8), ver=1.8)
        # ver=1.8 不加盐, 否则加盐 "{Urp602019}"
        SALT = "{Urp602019}"
        md5_with_salt = hashlib.md5((password + SALT).encode()).hexdigest()
        md5_no_salt = hashlib.md5(password.encode()).hexdigest()
        part1 = hashlib.md5(md5_with_salt.encode()).hexdigest()
        part2 = hashlib.md5(md5_no_salt.encode()).hexdigest()
        md5_password = f"{part1}*{part2}"

        # 构造包含 LB cookie 的 session JSON 以初始化客户端
        init_session = json.dumps({"session": session_value, "lb": lb_value}) if lb_value else session_value
        async with self._make_http_client(init_session) as client:
            client.headers["Referer"] = f"{self.BASE_URL}/login"

            post_data = {
                "j_username": student_id,
                "j_password": md5_password,
                "j_captcha": captcha,
                "lang": "zh",
            }
            if token_value:
                post_data["tokenValue"] = token_value

            logger.info("尝试登录: student_id=%s, captcha=%s, j_password长度=%d, cookie=%s..., token=%s...",
                        student_id, captcha, len(md5_password),
                        session_value[:12], token_value[:12] if token_value else "NONE")

            # 第一步: POST 登录，不自动跟随重定向以便检查结果
            resp = await client.post(
                f"{self.BASE_URL}/j_spring_security_check",
                data=post_data,
                follow_redirects=False,
            )

            # 检查 302 重定向的 Location
            location = resp.headers.get("location", "")
            logger.info("登录响应: status=%d, location=%s", resp.status_code, location)

            # 更新 cookie jar 中的 session（登录后可能发新 cookie）
            new_session = self._extract_session_cookie(resp) or session_value
            client.cookies[SESSION_COOKIE_NAME] = new_session

            # 检查是否登录失败
            if resp.status_code in (301, 302, 303, 307):
                if any(err in location for err in [
                    "badCredentials", "badCaptcha", "errorCode", "error="
                ]) or location.endswith("/login"):
                    logger.warning("登录失败: %s", location)
                    await self.redis.delete(session_key)
                    return None

            # 登录成功 — 跟随重定向，cookie jar 自动携带 session
            if location:
                follow_url = location if location.startswith("http") else f"{self.BASE_URL}{location}"
                follow_resp = await client.get(follow_url)
                # 更新为最新的 session cookie
                new_session = self._extract_session_cookie(follow_resp) or new_session
                client.cookies[SESSION_COOKIE_NAME] = new_session
                # 更新 LB cookie
                new_lb = follow_resp.cookies.get("XUANKE_LB") or lb_value
                logger.info("跟随重定向后 session: %s..., LB: %s", new_session[:12], new_lb[:12] if new_lb else "NONE")

            # 存储已认证会话（30分钟过期）— JSON 格式包含 LB cookie
            auth_key = f"jwc_auth:{student_id}"
            new_lb = client.cookies.get("XUANKE_LB") or lb_value
            auth_data = json.dumps({"session": new_session, "lb": new_lb})
            await self.redis.set(auth_key, auth_data, ex=1800)
            await self.redis.delete(session_key)

            logger.info("登录成功: student_id=%s, auth_key=%s, session=%s...",
                        student_id, auth_key, new_session[:12])

            # 提取学生信息（复用已验证的客户端，cookie jar 中有有效 session）
            student_info = await self._fetch_student_info(client, new_session)
            student_info["student_id"] = student_id
            return student_info

    async def _fetch_student_info(self, client: httpx.AsyncClient, session_value: str) -> dict:
        """从教务系统首页及个人信息页提取学生基本信息"""
        info: dict = {"name": "同学", "campus": None, "major": None, "grade": None}
        try:
            # 1. 从学生首页提取姓名
            resp = await client.get(f"{self.BASE_URL}/student/index")
            html = resp.text

            for pattern in [
                r"欢迎.*?(\S+?)\s*同学",
                r"姓名[：:]\s*(\S+)",
                r'class="user-name"[^>]*>([^<]+)',
                r'id="welcomeMsg"[^>]*>[^<]*?(\S+)\s*同学',
            ]:
                m = re.search(pattern, html)
                if m:
                    info["name"] = m.group(1).strip()
                    break

            # 2. 尝试从个人信息页面提取更多字段
            try:
                profile_resp = await client.get(
                    f"{self.BASE_URL}/student/rollManagement/rollInfo/index",
                )
                profile_html = profile_resp.text
                logger.info("个人信息页面长度: %d", len(profile_html))

                # 提取专业
                for p in [
                    r"专业[：:]\s*([^<\s]+)",
                    r"zydm_display[^>]*>([^<]+)",
                    r'majorName["\']?\s*[：:>]\s*([^<"\s]+)',
                    r"专\s*业.*?<[^>]*>([^<]{2,20})</",
                ]:
                    m = re.search(p, profile_html)
                    if m and m.group(1).strip():
                        info["major"] = m.group(1).strip()
                        break

                # 提取年级/入学年份
                for p in [
                    r"年级[：:]\s*(\d{4})",
                    r"入学年份[：:]\s*(\d{4})",
                    r"grade[\"']?\s*[：:>]\s*(\d{4})",
                    r"njdm_display[^>]*>(\d{4})",
                ]:
                    m = re.search(p, profile_html)
                    if m:
                        info["grade"] = int(m.group(1))
                        break

                # 提取校区
                for p in [
                    r"校区[：:]\s*([^<\s]+)",
                    r"campus[\"']?\s*[：:>]\s*([^<\"\s]+)",
                    r"xqdm_display[^>]*>([^<]+)",
                ]:
                    m = re.search(p, profile_html)
                    if m and m.group(1).strip():
                        info["campus"] = m.group(1).strip()
                        break

                logger.info("提取到学生信息: name=%s, major=%s, grade=%s, campus=%s",
                            info["name"], info["major"], info["grade"], info["campus"])
            except Exception as e:
                logger.warning("获取个人信息页面失败(非致命): %s", e)

            return info
        except Exception as e:
            logger.error("提取学生信息失败: %s", e)
            return info

    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        """爬取本学期课表 — 不带 planCode 参数获取当前学期"""
        session_value = await self.redis.get(session_key)
        if not session_value:
            logger.warning("课表查询: 会话不存在 %s", session_key)
            return []

        async with self._make_http_client(session_value) as client:
            try:
                # 先访问课表页面（cookie jar 自动携带 session）
                page_resp = await client.get(
                    f"{self.BASE_URL}/student/courseSelect/thisSemesterCurriculum/index",
                )
                # 检查是否被重定向到登录页（教务系统可能重定向到 /login 或 /gotoLogin）
                final_url = str(page_resp.url).lower()
                if "/login" in final_url or "/gotologin" in final_url:
                    logger.warning("课表页面被重定向到登录页 (%s)，会话可能已失效", page_resp.url)
                    await self.redis.delete(session_key)
                    return []

                # 获取课表 JSON
                resp = await client.get(
                    f"{self.BASE_URL}/student/courseSelect/thisSemesterCurriculum/ajaxStudentSchedule/callback",
                    headers={"X-Requested-With": "XMLHttpRequest"},
                )

                if resp.status_code != 200:
                    logger.error("课表请求失败: HTTP %d, url=%s", resp.status_code, resp.url)
                    return []

                # 检查返回内容是否是 HTML（被重定向到登录页的标志）
                content_type = resp.headers.get("content-type", "")
                if "text/html" in content_type:
                    logger.warning("课表 AJAX 返回 HTML 而非 JSON，会话可能已失效")
                    await self.redis.delete(session_key)
                    return []

                data = resp.json()
                logger.info("课表数据键: %s", list(data.keys()) if isinstance(data, dict) else type(data).__name__)

                return self._parse_schedule(data)
            except Exception as e:
                logger.error("获取课表异常: %s", e, exc_info=True)
                return []

    def _parse_schedule(self, data: dict) -> list[dict]:
        """解析 SCU 教务系统课表 JSON

        关键数据源:
        - dateList[].selectCourseList[].timeAndPlaceList[] — 真正的排课时间地点
          字段: classDay(星期), classSessions(开始节次), continuingSession(连续节数),
                classroomName(教室), teachingBuildingName(教学楼), campusName(校区),
                weekDescription(周次描述)
        - xkxx: 选课信息，含教师/课程属性，但 dgFlag 常为"（无）"不可靠
        """
        if not isinstance(data, dict):
            return []

        logger.info("课表响应顶层 keys: %s", list(data.keys()))

        # 1. 从 xkxx 构建课程基本信息 map
        xkxx_raw = data.get("xkxx", {})
        xkxx: dict = {}
        if isinstance(xkxx_raw, list):
            for item in xkxx_raw:
                if isinstance(item, dict):
                    xkxx.update(item)
        elif isinstance(xkxx_raw, dict):
            xkxx = xkxx_raw

        # 按 courseNumber_seqNumber 建立教师/属性查找表
        teacher_map: dict[str, str] = {}  # course_key → teacher
        type_map: dict[str, str] = {}     # course_key → course_type
        for course_key, info in xkxx.items():
            if isinstance(info, dict):
                teacher_map[course_key] = info.get("attendClassTeacher", "").strip()
                type_map[course_key] = info.get("coursePropertiesName", "")

        # 2. 从 dateList → selectCourseList → timeAndPlaceList 提取排课
        courses = []
        seen: set[tuple] = set()
        date_list = data.get("dateList", [])

        if isinstance(date_list, list):
            for plan_info in date_list:
                if not isinstance(plan_info, dict):
                    continue
                for sc in plan_info.get("selectCourseList", []):
                    if not isinstance(sc, dict):
                        continue

                    course_name = sc.get("courseName", "")
                    if not course_name:
                        continue

                    # 从 xkxx 查找教师（更准确）
                    sc_id = sc.get("id", {})
                    c_num = sc_id.get("coureNumber", "") if isinstance(sc_id, dict) else ""
                    c_seq = sc_id.get("coureSequenceNumber", "") if isinstance(sc_id, dict) else ""
                    xkxx_key = f"{c_num}_{c_seq}" if c_num and c_seq else ""

                    teacher = teacher_map.get(xkxx_key, sc.get("attendClassTeacher", "").strip())
                    course_type = type_map.get(xkxx_key, sc.get("coursePropertiesName", ""))

                    tap_list = sc.get("timeAndPlaceList") or []
                    if not tap_list:
                        # 无排课信息
                        dedup = (course_name, 0, 0)
                        if dedup not in seen:
                            seen.add(dedup)
                            courses.append({
                                "course_name": course_name,
                                "teacher": teacher,
                                "location": "",
                                "weekday": 0,
                                "start_section": 0,
                                "end_section": 0,
                                "weeks": "",
                                "course_type": course_type,
                                "campus": "",
                                "building": "",
                                "is_scheduled": False,
                            })
                        continue

                    for tap in tap_list:
                        if not isinstance(tap, dict):
                            continue

                        weekday = int(tap.get("classDay", 0) or 0)
                        start_section = int(tap.get("classSessions", 0) or 0)
                        continuing = int(tap.get("continuingSession", 1) or 1)
                        end_section = start_section + continuing - 1

                        classroom = (tap.get("classroomName", "") or "").strip()
                        building = (tap.get("teachingBuildingName", "") or "").strip()
                        campus = (tap.get("campusName", "") or "").strip()
                        week_desc = (tap.get("weekDescription", "") or "").strip()

                        # 组合地点: "一教A座 A207" 或 "A207"
                        location = f"{building} {classroom}".strip() if building else classroom

                        if weekday and start_section:
                            dedup = (course_name, weekday, start_section)
                            if dedup in seen:
                                continue
                            seen.add(dedup)
                            courses.append({
                                "course_name": course_name,
                                "teacher": teacher,
                                "location": location,
                                "weekday": weekday,
                                "start_section": start_section,
                                "end_section": end_section,
                                "weeks": week_desc,
                                "course_type": course_type,
                                "campus": campus,
                                "building": building,
                                "is_scheduled": True,
                            })

        # 3. 如果 dateList 没有数据，回退到 xkxx 的 dgFlag
        if not courses:
            for course_key, info in xkxx.items():
                if not isinstance(info, dict):
                    continue
                course_name = info.get("courseName", "")
                if not course_name:
                    continue
                teacher = info.get("attendClassTeacher", "").strip()
                course_type = info.get("coursePropertiesName", "")
                courses.append({
                    "course_name": course_name,
                    "teacher": teacher,
                    "location": "",
                    "weekday": 0,
                    "start_section": 0,
                    "end_section": 0,
                    "weeks": "",
                    "course_type": course_type,
                    "campus": "",
                    "building": "",
                    "is_scheduled": False,
                })

        logger.info("成功解析 %d 条课程记录 (其中 %d 条已排课)",
                     len(courses), sum(1 for c in courses if c["is_scheduled"]))
        return courses

    async def get_scores(self, session_key: str) -> list[dict]:
        """爬取全部已过成绩 — URL 包含动态哈希，需先访问 HTML 页面提取"""
        session_value = await self.redis.get(session_key)
        if not session_value:
            return []

        async with self._make_http_client(session_value) as client:
            try:
                # 1. 访问成绩页面 HTML，提取包含动态哈希的 AJAX URL
                page_resp = await client.get(
                    f"{self.BASE_URL}/student/integratedQuery/scoreQuery/allPassingScores/index",
                )
                final_url = str(page_resp.url).lower()
                if "/login" in final_url or "/gotologin" in final_url:
                    logger.warning("成绩页面被重定向到登录页 (%s)，会话可能已失效", page_resp.url)
                    await self.redis.delete(session_key)
                    return []

                if page_resp.status_code != 200:
                    logger.error("成绩页面请求失败: HTTP %d", page_resp.status_code)
                    return []

                # 从 HTML 中提取带哈希的 AJAX URL
                hash_match = re.search(
                    r"(/student/integratedQuery/scoreQuery/[^/]+/allPassingScores/callback)",
                    page_resp.text,
                )
                if not hash_match:
                    logger.error("未能从成绩页面提取 AJAX URL, 页面长度=%d, 前200字符=%s",
                                 len(page_resp.text), page_resp.text[:200])
                    return []

                ajax_url = hash_match.group(1)
                logger.info("成绩 AJAX URL: %s", ajax_url)

                # 2. 请求 AJAX 接口获取成绩数据
                resp = await client.get(
                    f"{self.BASE_URL}{ajax_url}",
                    headers={"X-Requested-With": "XMLHttpRequest"},
                )

                if resp.status_code != 200:
                    logger.error("成绩 AJAX 请求失败: HTTP %d", resp.status_code)
                    return []

                content_type = resp.headers.get("content-type", "")
                if "text/html" in content_type:
                    logger.warning("成绩 AJAX 返回 HTML 而非 JSON，会话可能已失效")
                    await self.redis.delete(session_key)
                    return []

                data = resp.json()
                return self._parse_scores(data)
            except Exception as e:
                logger.error("获取成绩异常: %s", e, exc_info=True)
                return []

    def _parse_scores(self, data: dict) -> list[dict]:
        """解析 SCU 教务系统成绩 JSON

        数据结构:
        - lnList: 按学期分组的成绩列表
          - lnList[i].cjList: 该学期的课程成绩数组
          - lnList[i].cjlx / zxjxjhh: 学期标识
        - 每门课程: courseName, courseScore/cj, credit, gradePointScore, courseAttributeName, gradeName
        """
        scores = []

        if not isinstance(data, dict):
            return []

        ln_list = data.get("lnList", [])
        if not isinstance(ln_list, list):
            return []

        for ln in ln_list:
            if not isinstance(ln, dict):
                continue

            semester_label = ln.get("cjlx", ln.get("zxjxjhh", ""))
            cj_list = ln.get("cjList", [])

            for cj in cj_list:
                if not isinstance(cj, dict):
                    continue

                course_name = cj.get("courseName", "")
                if not course_name:
                    continue

                # 成绩可能在 courseScore 或 cj 字段
                score_val = cj.get("courseScore", cj.get("cj", ""))
                credit_val = cj.get("credit", 0)
                gpa_val = cj.get("gradePointScore", 0)
                course_type = cj.get("courseAttributeName", "")
                grade_name = cj.get("gradeName", "")

                # 学期信息
                semester = semester_label
                id_info = cj.get("id", {})
                if isinstance(id_info, dict):
                    plan_num = id_info.get("executiveEducationPlanNumber", "")
                    if plan_num:
                        semester = plan_num

                scores.append({
                    "course_name": str(course_name),
                    "credit": float(credit_val) if credit_val else 0,
                    "score": str(score_val),
                    "gpa": float(gpa_val) if gpa_val else 0,
                    "semester": str(semester),
                    "course_type": str(course_type),
                    "grade": str(grade_name),
                })

        logger.info("成功解析 %d 条成绩 (跨 %d 个学期)", len(scores), len(ln_list))
        return scores

    async def get_plan_completion(self, session_key: str) -> dict:
        """获取方案完成情况 — 从教务系统培养方案页面提取各类别学分"""
        session_value = await self.redis.get(session_key)
        if not session_value:
            return {"total_required_credits": 0, "earned_credits": 0, "categories": []}

        async with self._make_http_client(session_value) as client:
            try:
                resp = await client.get(
                    f"{self.BASE_URL}/student/integratedQuery/planCompletion/index",
                )
                final_url = str(resp.url).lower()
                if "/login" in final_url or "/gotologin" in final_url:
                    logger.warning("培养方案页面被重定向到登录页 (%s)", resp.url)
                    await self.redis.delete(session_key)
                    return {"total_required_credits": 0, "earned_credits": 0, "categories": []}

                html = resp.text
                return self._parse_plan_completion(html)
            except Exception as e:
                logger.error("获取培养方案异常: %s", e, exc_info=True)
                return {"total_required_credits": 0, "earned_credits": 0, "categories": []}

    def _parse_plan_completion(self, html: str) -> dict:
        """解析培养方案 HTML 页面，提取各课程类别的要求学分和已修学分

        页面中包含 JS 变量 zNodes（zTree 节点数组），
        顶层节点 (pId=="-1") 即为课程大类，字段:
        - zsxf: 最低修读学分（要求）
        - yxxf: 已修学分（通过）
        - name: 含 HTML 标签的类别名称
        """
        import json as _json

        categories = []
        total_required = 0.0
        total_earned = 0.0

        # 提取 JS 中的 zNodes 数组
        nodes_match = re.search(r"var zNodes = (\[.*?\]);", html, re.DOTALL)
        if not nodes_match:
            logger.warning("培养方案页面未找到 zNodes 数据")
            return {"total_required_credits": 0, "earned_credits": 0, "categories": []}

        try:
            nodes_str = nodes_match.group(1).replace("\\/", "/")
            nodes = _json.loads(nodes_str)
        except _json.JSONDecodeError as e:
            logger.error("解析 zNodes JSON 失败: %s", e)
            return {"total_required_credits": 0, "earned_credits": 0, "categories": []}

        for node in nodes:
            # 只取顶层类别 (pId == "-1")
            if node.get("pId") != "-1":
                continue

            # 从 name HTML 中提取纯文本类别名
            raw_name = node.get("name", "")
            clean_name = re.sub(r"<[^>]+>", "", raw_name).strip()
            # 去掉 &nbsp; 和括号内的详细信息
            clean_name = clean_name.replace("&nbsp;", "").strip()
            paren_idx = clean_name.find("(")
            if paren_idx == -1:
                paren_idx = clean_name.find("（")
            if paren_idx > 0:
                clean_name = clean_name[:paren_idx].strip()

            required = float(node.get("zsxf") or 0)
            earned = float(node.get("yxxf") or 0)

            if not clean_name:
                continue

            categories.append({
                "name": clean_name,
                "required_credits": required,
                "earned_credits": earned,
            })
            total_required += required
            total_earned += earned

        logger.info("培养方案: %d 个类别, 要求 %.1f 学分, 已修 %.1f 学分",
                     len(categories), total_required, total_earned)
        return {
            "total_required_credits": total_required,
            "earned_credits": total_earned,
            "categories": categories,
        }

    @staticmethod
    def _extract_session_cookie(resp: httpx.Response) -> str | None:
        """从 httpx 响应中提取教务系统 session cookie"""
        # 从 cookies
        val = resp.cookies.get(SESSION_COOKIE_NAME)
        if val:
            return val

        # 从 cookie jar
        for cookie in resp.cookies.jar:
            if cookie.name == SESSION_COOKIE_NAME:
                return cookie.value

        # 从 Set-Cookie header
        set_cookie = resp.headers.get("set-cookie", "")
        m = re.search(rf"{re.escape(SESSION_COOKIE_NAME)}=([^;]+)", set_cookie)
        if m:
            return m.group(1)

        # 兜底: 尝试 JSESSIONID
        jsessionid = resp.cookies.get("JSESSIONID")
        if jsessionid:
            return jsessionid

        return None


class MockJwcClient(BaseJwcClient):
    """开发/测试环境模拟客户端"""

    def __init__(self, redis_client=None):
        self.redis = redis_client

    async def start_session(self) -> tuple[str, bytes]:
        captcha_bytes = self._generate_captcha_image()
        return f"mock_session:{uuid.uuid4().hex}", captcha_bytes

    @staticmethod
    def _generate_captcha_image() -> bytes:
        """生成一张带随机4位字符的简单验证码 PNG 图片"""
        import random

        chars = "".join(random.choices("abcdefghjkmnpqrstuvwxyz2345678", k=4))

        font: dict[str, list[str]] = {
            "a": ["01110","10001","10001","11111","10001","10001","10001"],
            "b": ["11110","10001","10001","11110","10001","10001","11110"],
            "c": ["01110","10001","10000","10000","10000","10001","01110"],
            "d": ["11100","10010","10001","10001","10001","10010","11100"],
            "e": ["11111","10000","10000","11110","10000","10000","11111"],
            "f": ["11111","10000","10000","11110","10000","10000","10000"],
            "g": ["01110","10001","10000","10111","10001","10001","01110"],
            "h": ["10001","10001","10001","11111","10001","10001","10001"],
            "j": ["00111","00010","00010","00010","00010","10010","01100"],
            "k": ["10001","10010","10100","11000","10100","10010","10001"],
            "m": ["10001","11011","10101","10101","10001","10001","10001"],
            "n": ["10001","11001","10101","10011","10001","10001","10001"],
            "p": ["11110","10001","10001","11110","10000","10000","10000"],
            "q": ["01110","10001","10001","10001","10101","10010","01101"],
            "r": ["11110","10001","10001","11110","10100","10010","10001"],
            "s": ["01111","10000","10000","01110","00001","00001","11110"],
            "t": ["11111","00100","00100","00100","00100","00100","00100"],
            "u": ["10001","10001","10001","10001","10001","10001","01110"],
            "v": ["10001","10001","10001","10001","01010","01010","00100"],
            "w": ["10001","10001","10001","10101","10101","10101","01010"],
            "x": ["10001","10001","01010","00100","01010","10001","10001"],
            "y": ["10001","10001","01010","00100","00100","00100","00100"],
            "z": ["11111","00001","00010","00100","01000","10000","11111"],
            "2": ["01110","10001","00001","00010","00100","01000","11111"],
            "3": ["01110","10001","00001","00110","00001","10001","01110"],
            "4": ["00010","00110","01010","10010","11111","00010","00010"],
            "5": ["11111","10000","11110","00001","00001","10001","01110"],
            "6": ["01110","10001","10000","11110","10001","10001","01110"],
            "7": ["11111","00001","00010","00100","01000","01000","01000"],
            "8": ["01110","10001","10001","01110","10001","10001","01110"],
        }

        width, height = 100, 30
        import random as rnd
        pixels = []
        for _y in range(height):
            for _x in range(width):
                nr = rnd.randint(-10, 10)
                pixels.append((min(255, max(0, 240 + nr)),
                               min(255, max(0, 240 + nr)),
                               min(255, max(0, 240 + nr))))

        colors = [(200, 50, 50), (50, 50, 200), (50, 150, 50), (150, 50, 150)]
        for ci, ch in enumerate(chars):
            glyph = font.get(ch, font["a"])
            x_off = 10 + ci * 22
            y_off = 5 + rnd.randint(-2, 2)
            color = colors[ci % len(colors)]
            for gy, row in enumerate(glyph):
                for gx, pixel in enumerate(row):
                    if pixel == "1":
                        for dy in range(3):
                            for dx in range(3):
                                px = x_off + gx * 3 + dx
                                py = y_off + gy * 3 + dy
                                if 0 <= px < width and 0 <= py < height:
                                    pixels[py * width + px] = color

        for _ in range(80):
            nx = rnd.randint(0, width - 1)
            ny = rnd.randint(0, height - 1)
            pixels[ny * width + nx] = (rnd.randint(0, 200), rnd.randint(0, 200), rnd.randint(0, 200))

        raw_data = b""
        for y in range(height):
            raw_data += b"\x00"
            for x in range(width):
                r, g, b = pixels[y * width + x]
                raw_data += struct.pack("BBB", r, g, b)

        compressed = zlib.compress(raw_data)

        def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
            chunk = chunk_type + data
            crc = zlib.crc32(chunk) & 0xFFFFFFFF
            return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)

        png = b"\x89PNG\r\n\x1a\n"
        png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        png += png_chunk(b"IDAT", compressed)
        png += png_chunk(b"IEND", b"")
        return png

    async def login(
        self, session_key: str, student_id: str, password: str, captcha: str
    ) -> dict | None:
        if len(student_id) < 5:
            return None
        # 存储 mock 认证 session 到 Redis（让 fetch_and_cache_all 可以找到它）
        if self.redis:
            auth_key = f"jwc_auth:{student_id}"
            await self.redis.set(auth_key, "mock_auth_token", ex=1800)
        return {
            "student_id": student_id,
            "name": f"学生{student_id[-4:]}",
            "campus": "望江",
            "major": "计算机科学与技术",
            "grade": 2022,
        }

    async def get_schedule(self, session_key: str, semester: str) -> list[dict]:
        return [
            # 周一
            {"course_name": "高等数学 (A)", "teacher": "张伟教授", "location": "一教 B305",
             "weekday": 1, "start_section": 1, "end_section": 2, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "数据结构与算法", "teacher": "李明教授", "location": "二教 C201",
             "weekday": 1, "start_section": 3, "end_section": 4, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "形势与政策", "teacher": "陈思远教授", "location": "基教 D101",
             "weekday": 1, "start_section": 7, "end_section": 8, "weeks": "1-8周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            # 周二
            {"course_name": "线性代数", "teacher": "刘芳教授", "location": "一教 A201",
             "weekday": 2, "start_section": 1, "end_section": 2, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "大学英语（四）", "teacher": "王晓英教授", "location": "外语楼 302",
             "weekday": 2, "start_section": 3, "end_section": 4, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "体育（田径）", "teacher": "赵强教授", "location": "田径场",
             "weekday": 2, "start_section": 9, "end_section": 10, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            # 周三
            {"course_name": "计算机网络", "teacher": "王建国教授", "location": "三教 A108",
             "weekday": 3, "start_section": 1, "end_section": 2, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "数字逻辑", "teacher": "孙海涛教授", "location": "江安 A区 201",
             "weekday": 3, "start_section": 5, "end_section": 6, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            # 周四
            {"course_name": "操作系统原理", "teacher": "赵志远教授", "location": "基教 A301",
             "weekday": 4, "start_section": 1, "end_section": 2, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "高等数学 (A)", "teacher": "张伟教授", "location": "一教 B305",
             "weekday": 4, "start_section": 3, "end_section": 4, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "机器学习导论", "teacher": "黄明亮教授", "location": "信息学院 C302",
             "weekday": 4, "start_section": 7, "end_section": 8, "weeks": "9-16周",
             "course_type": "选修", "campus": "望江", "is_scheduled": True},
            # 周五
            {"course_name": "软件工程", "teacher": "刘国强教授", "location": "基教 B201",
             "weekday": 5, "start_section": 1, "end_section": 2, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "计算机网络", "teacher": "王建国教授", "location": "三教 A108",
             "weekday": 5, "start_section": 3, "end_section": 4, "weeks": "1-16周",
             "course_type": "必修", "campus": "望江", "is_scheduled": True},
            {"course_name": "Python 程序设计", "teacher": "陈凯教授", "location": "计算机楼 机房301",
             "weekday": 5, "start_section": 5, "end_section": 6, "weeks": "1-12周",
             "course_type": "选修", "campus": "望江", "is_scheduled": True},
        ]

    async def get_scores(self, session_key: str) -> list[dict]:
        return [
            # 2023-2024-1 学期
            {"course_name": "大学英语（一）", "credit": 2.0, "score": "87", "gpa": 3.3,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "良好"},
            {"course_name": "高等数学 (A)（上）", "credit": 5.0, "score": "78", "gpa": 2.7,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "中等"},
            {"course_name": "线性代数", "credit": 3.0, "score": "91", "gpa": 3.7,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "优秀"},
            {"course_name": "C程序设计", "credit": 3.0, "score": "95", "gpa": 4.0,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "优秀"},
            {"course_name": "体育（一）", "credit": 1.0, "score": "优秀", "gpa": 4.0,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "优秀"},
            {"course_name": "思想道德与法治", "credit": 3.0, "score": "89", "gpa": 3.3,
             "semester": "2023-2024-1", "course_type": "必修", "grade": "良好"},
            # 2023-2024-2 学期
            {"course_name": "大学英语（二）", "credit": 2.0, "score": "82", "gpa": 3.0,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "良好"},
            {"course_name": "高等数学 (A)（下）", "credit": 5.0, "score": "85", "gpa": 3.3,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "良好"},
            {"course_name": "大学物理 (A)（一）", "credit": 3.0, "score": "76", "gpa": 2.7,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "中等"},
            {"course_name": "离散数学", "credit": 4.0, "score": "88", "gpa": 3.3,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "良好"},
            {"course_name": "数字逻辑", "credit": 3.0, "score": "90", "gpa": 3.7,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "优秀"},
            {"course_name": "体育（二）", "credit": 1.0, "score": "良好", "gpa": 3.3,
             "semester": "2023-2024-2", "course_type": "必修", "grade": "良好"},
            # 2024-2025-1 学期
            {"course_name": "大学英语（三）", "credit": 2.0, "score": "90", "gpa": 3.7,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "优秀"},
            {"course_name": "数据结构与算法", "credit": 4.0, "score": "93", "gpa": 4.0,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "优秀"},
            {"course_name": "计算机组成原理", "credit": 4.0, "score": "80", "gpa": 3.0,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "良好"},
            {"course_name": "概率论与数理统计", "credit": 3.0, "score": "86", "gpa": 3.3,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "良好"},
            {"course_name": "汇编语言与接口技术", "credit": 3.0, "score": "72", "gpa": 2.3,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "中等"},
            {"course_name": "Python 程序设计基础", "credit": 2.0, "score": "96", "gpa": 4.0,
             "semester": "2024-2025-1", "course_type": "选修", "grade": "优秀"},
            {"course_name": "体育（三）", "credit": 1.0, "score": "良好", "gpa": 3.3,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "良好"},
            {"course_name": "中国近代史纲要", "credit": 3.0, "score": "84", "gpa": 3.0,
             "semester": "2024-2025-1", "course_type": "必修", "grade": "良好"},
        ]

    async def get_plan_completion(self, session_key: str) -> dict:
        return {
            "total_required_credits": 175,
            "earned_credits": 81,
            "categories": [
                {"name": "必修课程", "required_credits": 110, "earned_credits": 62},
                {"name": "专业选修", "required_credits": 30, "earned_credits": 8},
                {"name": "通识教育", "required_credits": 15, "earned_credits": 6},
                {"name": "实践环节", "required_credits": 12, "earned_credits": 3},
                {"name": "体育", "required_credits": 4, "earned_credits": 3},
                {"name": "思政课程", "required_credits": 4, "earned_credits": 3},
            ],
        }


def get_jwc_client(redis_client=None) -> BaseJwcClient:
    """工厂函数: 根据环境返回对应客户端"""
    from shared.config import settings

    if getattr(settings, "jwc_use_mock", True):
        logger.info("使用 MockJwcClient (开发模式)")
        return MockJwcClient(redis_client=redis_client)
    logger.info("使用 RealJwcClient → %s", settings.jwc_base_url)
    return RealJwcClient(
        redis_client=redis_client,
        base_url=getattr(settings, "jwc_base_url", "http://zhjw.scu.edu.cn"),
    )
