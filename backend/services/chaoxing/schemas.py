"""学习通模块 Pydantic schemas"""
from datetime import datetime

from pydantic import BaseModel


class QRCodeResponse(BaseModel):
    """QR 码创建响应"""
    session_id: str
    qr_image_url: str


class QRStatusResponse(BaseModel):
    """QR 码状态轮询响应"""
    status: int  # 0=未扫描, 1=已扫描待确认, 2=登录成功, 3=过期
    message: str


class ChaoxingBindStatus(BaseModel):
    """学习通绑定状态"""
    is_bound: bool
    cx_name: str | None = None
    last_sync_at: datetime | None = None


class SyncResult(BaseModel):
    """DDL 同步结果"""
    total_works: int
    new_deadlines: int
    skipped: int
    courses: list[str]
