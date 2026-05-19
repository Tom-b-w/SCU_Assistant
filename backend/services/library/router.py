from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from gateway.auth.dependencies import get_current_user
from shared.models import User as UserModel
from services.library.schemas import BookSearchResult, DueReminder, PersonalBorrowing
from services.library.service import get_due_reminders, get_personal_borrowing, search_books

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("/search", response_model=BookSearchResult)
async def book_search(
    keyword: str = Query(..., description="检索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
):
    return await search_books(keyword, page=page, page_size=page_size)


@router.get("/borrowing", response_model=PersonalBorrowing)
async def personal_borrowing(current_user: UserModel = Depends(get_current_user)):
    """获取个人借阅（自动使用已登录账号，无需再次输入密码）"""
    return await get_personal_borrowing(current_user.student_id)


@router.get("/duereminders", response_model=DueReminder)
async def due_reminders(current_user: UserModel = Depends(get_current_user)):
    """获取到期提醒"""
    return await get_due_reminders(current_user.student_id)