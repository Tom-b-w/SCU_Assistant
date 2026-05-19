"""图书馆集成服务

- 图书检索：通过 OPAC 系统爬取真实数据，支持分页，返回完整图书元数据
- 个人借阅：通过 OPAC 系统获取真实数据（需登录后），支持查看当前借阅
- 到期提醒：基于借阅数据计算
"""

import asyncio
import json
import logging
import random
from datetime import date, timedelta

from services.library.schemas import (
    BookItem,
    BookSearchResult,
    BorrowedBook,
    DueReminder,
    PersonalBorrowing,
)
from services.library.opac_service import search_books as opac_search
from services.library.opac_service import get_session as get_opac_session
from services.library.opac_auth_service import login_user as opac_login
from services.library.opac_auth_service import check_login_status
from services.library.opac_borrowing_service import fetch_borrowing_data
from shared.cache import redis_client

logger = logging.getLogger(__name__)


async def search_books(keyword: str, page: int = 1, page_size: int = 20) -> BookSearchResult:
    """检索图书（支持分页）"""
    logger.info(f"检索图书: {keyword}, page={page}")

    try:
        result = await opac_search(keyword, page_num=page)
        if result and result.books:
            logger.info(f"OPAC 检索成功: 第 {page} 页, 共 {result.total_count} 条结果")
            return result
    except Exception as e:
        logger.warning(f"OPAC 检索失败，使用 mock 数据: {e}")

    return _mock_book_search(keyword, page=page, page_size=page_size)


async def login_to_opac_and_cache(student_id: str, password: str) -> dict:
    """初始化 OPAC 会话 → 登录 → 缓存 cookies 到 Redis（永久有效）
    
    与 login 页面共用同一套账号，无需用户再次输入密码。
    cookies 存储在 Redis 中，服务器重启后也可恢复。
    
    Returns:
        {"success": True/False, "message": "..."}
    """
    logger.info(f"初始化 OPAC 会话并登录: student_id={student_id}")

    session_info = None
    for attempt in range(3):
        session_info = await get_opac_session()
        if session_info:
            break
        logger.info(f"  OPAC 会话初始化尝试 {attempt + 1} 失败，重试...")
        await asyncio.sleep(2)

    if not session_info:
        return {"success": False, "message": "OPAC 系统暂时无法访问，请稍后重试"}

    try:
        context, session_base = session_info
        success = await opac_login(context, session_base, student_id, password)

        if success:
            cookies = await context.cookies()
            session_data = {
                "cookies": cookies,
                "session_base": session_base,
                "student_id": student_id,
            }
            await redis_client.set(f"opac_session:{student_id}", json.dumps(session_data))
            logger.info(f"  OPAC 登录成功，cookies 已缓存到 Redis (key=opac_session:{student_id})")
            return {"success": True, "message": "登录成功"}
        else:
            return {"success": False, "message": "登录失败，请检查学号和密码"}
    except Exception as e:
        logger.warning(f"OPAC 登录失败: {e}")
        return {"success": False, "message": str(e)}


async def get_authenticated_opac_session(student_id: str) -> tuple | None:
    """获取已认证的 OPAC 会话
    
    优先级：
    1. 尝试全局 Playwright 上下文（已登录则直接使用）
    2. 从 Redis 恢复缓存的 cookies
    
    Returns:
        (BrowserContext, session_base) or None
    """
    session_info = await get_opac_session()
    if not session_info:
        return None

    context, session_base = session_info

    is_logged_in = await check_login_status(context, session_base)
    if is_logged_in:
        logger.info(f"  全局 OPAC 上下文已认证")
        return context, session_base

    session_data_json = await redis_client.get(f"opac_session:{student_id}")
    if not session_data_json:
        logger.info(f"  未找到缓存的 OPAC session (student_id={student_id})")
        return None

    try:
        session_data = json.loads(session_data_json)
        cookies = session_data.get("cookies", [])
        cached_session_base = session_data.get("session_base", "")

        if cookies:
            await context.add_cookies(cookies)
            logger.info(f"  已从 Redis 恢复 OPAC cookies ({len(cookies)} 条)")

            target_base = cached_session_base or session_base
            is_logged_in = await check_login_status(context, target_base)
            if is_logged_in:
                logger.info(f"  恢复的 OPAC session 有效")
                return context, target_base
            else:
                logger.info(f"  恢复的 OPAC session 已过期")
                await redis_client.delete(f"opac_session:{student_id}")
                return None
    except Exception as e:
        logger.warning(f"  恢复 OPAC session 失败: {e}")
        await redis_client.delete(f"opac_session:{student_id}")

    return None


async def get_personal_borrowing(student_id: str) -> PersonalBorrowing:
    """获取个人借阅（使用已认证的 OPAC 会话）"""
    logger.info(f"获取个人借阅: student_id={student_id}")

    session_info = await get_authenticated_opac_session(student_id)
    if not session_info:
        logger.warning("  无法获取已认证的 OPAC 会话，请先登录")
        return PersonalBorrowing(total_borrowed=0, overdue_count=0, books=[])

    try:
        context, session_base = session_info
        logger.info("  尝试从 OPAC 获取借阅数据...")
        books = await fetch_borrowing_data(context, session_base)
        if books:
            overdue = [b for b in books if b.is_overdue]
            result = PersonalBorrowing(
                total_borrowed=len(books),
                overdue_count=len(overdue),
                books=books,
            )
            logger.info(f"  OPAC 借阅数据获取成功: {result.total_borrowed} 本")
            return result
        else:
            logger.info("  OPAC 借阅数据为空")
            return PersonalBorrowing(total_borrowed=0, overdue_count=0, books=[])
    except Exception as e:
        logger.warning(f"  OPAC 借阅获取失败: {e}")
        return PersonalBorrowing(total_borrowed=0, overdue_count=0, books=[])


async def get_due_reminders(student_id: str) -> DueReminder:
    """获取到期提醒（基于借阅数据计算）"""
    borrowing = await get_personal_borrowing(student_id)
    today = date.today()
    week_later = today + timedelta(days=7)

    today_overdue = [b for b in borrowing.books if b.is_overdue]
    week_due = [b for b in borrowing.books if not b.is_overdue and today <= date.fromisoformat(b.due_date) <= week_later]
    normal = [b for b in borrowing.books if not b.is_overdue and date.fromisoformat(b.due_date) > week_later]

    return DueReminder(
        today_overdue=today_overdue,
        week_due=week_due,
        normal=normal,
    )


# ====== Mock 数据（仅图书检索用） ======

def _mock_book_search(keyword: str, page: int = 1, page_size: int = 20) -> BookSearchResult:
    today = date.today()
    seed = sum(ord(c) for c in keyword)
    rng = random.Random(seed)

    titles_pool = [
        f"深度学习: 基于{keyword}的实践", f"{keyword}原理与实解",
        f"{keyword}导论（第3版）", f"现代{keyword}技术",
        f"{keyword}算法与实现", f"{keyword}：从入门到精通",
        f"{keyword}中的数据科学", f"{keyword}系统设计与分析",
        f"分布式{keyword}系统", f"{keyword}安全理论与实践",
        f"{keyword}高级编程", f"{keyword}基础教程",
        f"{keyword}实战项目", f"{keyword}核心技术与应用",
        f"{keyword}性能优化", f"{keyword}设计模式与架构",
        f"大数据{keyword}技术", f"云计算与{keyword}",
        f"{keyword}工程师面试指南", f"{keyword}科研方法论",
    ]
    authors_pool = ["张三", "李四", "王五", "赵六", "周慕白", "郑知远", "陈明道"]
    publishers_pool = ["高等教育出版社", "清华大学出版社", "人民邮电出版社", "机械工业出版社", "科学出版社", "电子工业出版社"]

    total_count = max(rng.randint(80, 200), 80)
    all_books = []
    for i in range(total_count):
        title = rng.choice(titles_pool)
        if i > 0 and rng.random() > 0.5:
            title = f"{title}（第{rng.randint(2, 5)}版）"

        available = rng.random() > 0.3
        year = str(rng.randint(2000, 2025))
        all_books.append(BookItem(
            title=title,
            author=f"{rng.choice(authors_pool)} 著",
            publisher=rng.choice(publishers_pool),
            isbn=f"978-{rng.randint(100, 999)}-{rng.randint(10000, 99999)}-{rng.randint(0, 9)}",
            call_number=f"{chr(rng.randint(65, 75))}{rng.randint(100, 999)}-{rng.randint(1000, 9999)}",
            location=rng.choice(["文理馆", "工学馆", "医学馆", "江安馆"]),
            status="在馆" if available else "借出",
            available=available,
            year=year,
        ))

    start = (page - 1) * page_size
    end = start + page_size
    page_books = all_books[start:end]

    return BookSearchResult(
        keyword=keyword,
        total=len(page_books),
        books=page_books,
        page=page,
        page_size=page_size,
        total_count=total_count,
    )