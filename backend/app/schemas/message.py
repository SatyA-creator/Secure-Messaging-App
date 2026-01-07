from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class MessageCreate(BaseModel):
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: str
    encrypted_session_key: str

class MessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: str
    encrypted_session_key: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True