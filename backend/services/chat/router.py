from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from gateway.middleware.rate_limit import check_rate_limit
from shared.cache import redis_client
from shared.config import settings
from shared.database import get_db
from shared.exceptions import RateLimitError
from services.chat.schemas import ChatRequest, ChatResponse
from services.chat.service import chat_completion, chat_completion_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/completions", response_model=ChatResponse)
async def create_chat_completion(
    body: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送消息获取 AI 回复（chat_rate_limit_per_minute）"""
    # Rate limit check
    rate_key = f"rate:chat:{user.student_id}"
    allowed = await check_rate_limit(
        redis_client,
        key=rate_key,
        limit=settings.chat_rate_limit_per_minute,
        window=60,
    )
    if not allowed:
        raise RateLimitError()

    user_info = {
        "student_id": user.student_id,
        "user_id": user.id,
    }
    result = await chat_completion(
        messages=body.messages,
        user_info=user_info,
        db=db,
        redis_client=redis_client,
    )

    return ChatResponse(reply=result["reply"], usage=result["usage"])


@router.post("/stream")
async def create_chat_stream(
    body: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE 流式对话"""
    rate_key = f"rate:chat:{user.student_id}"
    allowed = await check_rate_limit(
        redis_client,
        key=rate_key,
        limit=settings.chat_rate_limit_per_minute,
        window=60,
    )
    if not allowed:
        raise RateLimitError()

    user_info = {
        "student_id": user.student_id,
        "user_id": user.id,
    }

    return StreamingResponse(
        chat_completion_stream(
            messages=body.messages,
            user_info=user_info,
            db=db,
            redis_client=redis_client,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
