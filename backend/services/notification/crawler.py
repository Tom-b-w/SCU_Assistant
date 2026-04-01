"""
校园通知爬虫 — 抓取四川大学教务处、学工部真实通知。
启动时自动抓取最新通知并存入数据库。
"""

import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Notification

logger = logging.getLogger(__name__)

CST = timezone(timedelta(hours=8))

# 备用 Mock 数据（网络不通时使用）
MOCK_NOTIFICATIONS = [
    {
        "title": "关于 2025-2026 学年第二学期期末考试安排的通知",
        "url": "https://jwc.scu.edu.cn/notice/example1",
        "summary": "期末考试安排在第17-18周，请同学们做好复习准备。",
        "source": "教务处",
        "days_ago": 1,
    },
    {
        "title": "关于开展 2026 年大学生创新创业训练计划项目申报的通知",
        "url": "https://jwc.scu.edu.cn/notice/example2",
        "summary": "2026年大创项目申报启动，培养创新精神和实践能力。",
        "source": "教务处",
        "days_ago": 2,
    },
    {
        "title": "关于做好 2026 年春季学期学生心理健康教育工作的通知",
        "url": "https://xgb.scu.edu.cn/notice/example3",
        "summary": "春季学期心理健康教育工作安排，各学院需组织主题班会。",
        "source": "学工部",
        "days_ago": 3,
    },
    {
        "title": "关于 2026 年春季学期研究生学位论文答辩安排的通知",
        "url": "https://gs.scu.edu.cn/notice/example4",
        "summary": "春季学期研究生学位论文答辩工作即将开始。",
        "source": "研究生院",
        "days_ago": 4,
    },
    {
        "title": "关于 2025-2026 学年第二学期选课补退选的通知",
        "url": "https://jwc.scu.edu.cn/notice/example5",
        "summary": "第2周周一至周五开放补退选，请按时操作。",
        "source": "教务处",
        "days_ago": 7,
    },
    {
        "title": "关于开展 2026 年暑期社会实践项目申报的通知",
        "url": "https://xgb.scu.edu.cn/notice/example6",
        "summary": "2026年暑期社会实践项目申报启动。",
        "source": "学工部",
        "days_ago": 5,
    },
]


def _clean(text: str) -> str:
    """去除 HTML 标签和多余空白。"""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def _crawl_jwc() -> list[dict]:
    """
    抓取教务处通知。
    真实 HTML 结构：
      <li><a href="info/1069/xxx.htm" target="_blank">
        <div class="date"><p>MM/DD </p><span>YYYY</span></div>
        <div class="text"><p>标题</p></div>
      </a></li>
    """
    notifications = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get("https://jwc.scu.edu.cn/tzgg.htm")
            resp.raise_for_status()
            html = resp.text

            pattern = (
                r'<a[^>]*href="((?:info/|content\.jsp)[^"]*)"[^>]*>'
                r'.*?class="date"[^>]*>\s*<p>\s*(\d{2}/\d{2})\s*</p>\s*<span>\s*(\d{4})\s*</span>'
                r'.*?class="text"[^>]*>\s*<p>\s*(.*?)\s*</p>'
            )
            for match in re.finditer(pattern, html, re.DOTALL):
                href, date_str, year, title_raw = match.groups()
                title = _clean(title_raw)
                if not title or len(title) < 4:
                    continue

                try:
                    pub_date = datetime.strptime(
                        f"{year}/{date_str}", "%Y/%m/%d"
                    ).replace(tzinfo=CST)
                except ValueError:
                    pub_date = None

                url = f"https://jwc.scu.edu.cn/{href}"
                notifications.append({
                    "title": title,
                    "url": url,
                    "source": "教务处",
                    "published_at": pub_date,
                })

        logger.info("从教务处抓取到 %d 条通知", len(notifications))
    except Exception as e:
        logger.warning("抓取教务处通知失败: %s", e)

    return notifications


async def _crawl_xgb() -> list[dict]:
    """
    抓取学工部通知。
    真实 HTML 结构：
      <li class="news-list">
        <a href="../info/1003/xxx.htm" title="完整标题">
          <div class="date-box">
            <p class="date">DD</p>
            <p class="year-month">YYYY-MM</p>
          </div>
        </a>
      </li>
    """
    notifications = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get("https://xgb.scu.edu.cn/index/tzgg.htm")
            resp.raise_for_status()
            html = resp.text

            # 用 title 属性提取完整标题
            pattern = (
                r'<a[^>]*href="(?:\.\./)*(info/[^"]*)"[^>]*title="([^"]*)"[^>]*>'
                r'.*?class="date"[^>]*>\s*(\d{1,2})\s*</p>'
                r'.*?class="year-month"[^>]*>\s*(\d{4}-\d{2})\s*</p>'
            )
            for match in re.finditer(pattern, html, re.DOTALL):
                href, title, day, year_month = match.groups()
                title = _clean(title)
                if not title or len(title) < 4:
                    continue

                try:
                    pub_date = datetime.strptime(
                        f"{year_month}-{day.zfill(2)}", "%Y-%m-%d"
                    ).replace(tzinfo=CST)
                except ValueError:
                    pub_date = None

                url = f"https://xgb.scu.edu.cn/{href}"
                notifications.append({
                    "title": title,
                    "url": url,
                    "source": "学工部",
                    "published_at": pub_date,
                })

        logger.info("从学工部抓取到 %d 条通知", len(notifications))
    except Exception as e:
        logger.warning("抓取学工部通知失败: %s", e)

    return notifications


async def crawl_notifications() -> list[dict]:
    """抓取所有来源的通知。"""
    jwc = await _crawl_jwc()
    xgb = await _crawl_xgb()
    return jwc + xgb


async def seed_notifications(session: AsyncSession) -> int:
    """抓取真实通知并存入数据库。如果网络不通则使用 Mock 数据。"""
    count_result = await session.execute(
        select(func.count()).select_from(Notification)
    )
    existing_count = count_result.scalar() or 0
    if existing_count > 0:
        logger.info("通知表已有 %d 条数据，跳过 seed", existing_count)
        return 0

    # 尝试抓取真实数据
    items = await crawl_notifications()

    # 如果抓取失败，使用 Mock 数据
    if not items:
        logger.info("无法抓取真实通知，使用 Mock 数据")
        now = datetime.now(CST)
        items = [
            {
                "title": m["title"],
                "url": m["url"],
                "source": m["source"],
                "published_at": now - timedelta(days=m.get("days_ago", 0)),
                "summary": m.get("summary"),
            }
            for m in MOCK_NOTIFICATIONS
        ]

    new_count = 0
    for entry in items:
        notification = Notification(
            title=entry["title"],
            source=entry["source"],
            url=entry.get("url"),
            summary=entry.get("summary") or entry["title"][:100],
            published_at=entry.get("published_at"),
        )
        session.add(notification)
        new_count += 1

    if new_count > 0:
        await session.commit()
        logger.info("已存入 %d 条通知数据", new_count)
    return new_count


async def refresh_notifications(session: AsyncSession) -> int:
    """刷新通知：抓取最新通知，去重后新增到数据库。"""
    items = await crawl_notifications()
    if not items:
        return 0

    # 获取已有 URL 用于去重
    existing_urls_result = await session.execute(
        select(Notification.url).where(Notification.url.isnot(None))
    )
    existing_urls = {row[0] for row in existing_urls_result.all()}

    new_count = 0
    for entry in items:
        if entry.get("url") in existing_urls:
            continue
        notification = Notification(
            title=entry["title"],
            source=entry["source"],
            url=entry.get("url"),
            summary=entry.get("summary") or entry["title"][:100],
            published_at=entry.get("published_at"),
        )
        session.add(notification)
        new_count += 1

    if new_count > 0:
        await session.commit()
        logger.info("刷新通知：新增 %d 条", new_count)
    return new_count
