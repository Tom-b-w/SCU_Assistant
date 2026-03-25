from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    title: str
    source: str
    url: str | None
    summary: str | None
    published_at: datetime | None

    model_config = {"from_attributes": True}
