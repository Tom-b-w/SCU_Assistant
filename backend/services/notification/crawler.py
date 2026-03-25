"""
教务通知爬虫 — 开发阶段使用 Mock 数据。
应用启动时自动 seed，确保通知列表不为空。
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Notification

logger = logging.getLogger(__name__)

CST = timezone(timedelta(hours=8))

MOCK_NOTIFICATIONS = [
    {
        "title": "关于 2025-2026 学年第二学期期末考试安排的通知",
        "url": "https://jwc.scu.edu.cn/notice/example1",
        "content": "各学院：期末考试将于第 17-18 周进行，请各位同学做好复习准备。",
        "summary": "期末考试安排在第17-18周，请同学们做好复习准备。",
        "source": "教务处",
        "days_ago": 1,
    },
    {
        "title": "关于开展 2026 年大学生创新创业训练计划项目申报的通知",
        "url": "https://jwc.scu.edu.cn/notice/example2",
        "content": "为培养学生创新精神和实践能力，现启动 2026 年大创项目申报...",
        "summary": "2026年大创项目申报启动，培养创新精神和实践能力。",
        "source": "教务处",
        "days_ago": 2,
    },
    {
        "title": "关于做好 2026 年春季学期学生心理健康教育工作的通知",
        "url": "https://xgb.scu.edu.cn/notice/example3",
        "content": "为进一步加强学生心理健康教育，各学院需组织心理健康主题班会...",
        "summary": "春季学期心理健康教育工作安排，各学院需组织主题班会。",
        "source": "学工部",
        "days_ago": 3,
    },
    {
        "title": "关于 2026 年春季学期研究生学位论文答辩安排的通知",
        "url": "https://gs.scu.edu.cn/notice/example4",
        "content": "2026 年春季学期研究生学位论文答辩工作即将开始，请相关研究生做好准备...",
        "summary": "春季学期研究生学位论文答辩工作即将开始。",
        "source": "研究生院",
        "days_ago": 4,
    },
    {
        "title": "关于 2025-2026 学年第二学期选课补退选的通知",
        "url": "https://jwc.scu.edu.cn/notice/example5",
        "content": "补退选时间为第 2 周周一至周五，请同学们在规定时间内完成操作。",
        "summary": "第2周周一至周五开放补退选，请按时操作。",
        "source": "教务处",
        "days_ago": 7,
    },
    {
        "title": "关于开展 2026 年暑期社会实践项目申报的通知",
        "url": "https://xgb.scu.edu.cn/notice/example6",
        "content": "为引导学生在实践中受教育、长才干，现启动 2026 年暑期社会实践项目申报。",
        "summary": "2026年暑期社会实践项目申报启动。",
        "source": "学工部",
        "days_ago": 5,
    },
]


async def seed_notifications(session: AsyncSession) -> int:
    """如果通知表为空，插入 Mock 数据。返回新增数量。"""
    count_result = await session.execute(select(func.count()).select_from(Notification))
    existing_count = count_result.scalar() or 0
    if existing_count > 0:
        logger.info("通知表已有 %d 条数据，跳过 seed", existing_count)
        return 0

    now = datetime.now(CST)
    new_count = 0
    for entry in MOCK_NOTIFICATIONS:
        notification = Notification(
            title=entry["title"],
            source=entry["source"],
            url=entry["url"],
            content=entry.get("content"),
            summary=entry.get("summary") or entry["title"],
            published_at=now - timedelta(days=entry.get("days_ago", 0)),
        )
        session.add(notification)
        new_count += 1

    if new_count > 0:
        await session.commit()
        logger.info("已 seed %d 条通知数据", new_count)
    return new_count
