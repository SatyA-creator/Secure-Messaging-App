from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class MessageCreate(BaseModel):
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: bytes
    encrypted_session_key: bytes

class MessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: bytes
    encrypted_session_key: bytes
    is_read: int
    created_at: datetime

    class Config:
        from_attributes = True