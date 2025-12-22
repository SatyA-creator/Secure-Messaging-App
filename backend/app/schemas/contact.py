from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class ContactCreate(BaseModel):
    user_id: UUID
    contact_id: UUID
    nickname: Optional[str] = None

class ContactResponse(BaseModel):
    id: UUID
    user_id: UUID
    contact_id: UUID
    nickname: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True