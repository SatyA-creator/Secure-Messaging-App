from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class MediaAttachmentResponse(BaseModel):
    id: UUID
    file_name: str
    file_type: str
    file_size: int
    file_url: str
    category: str
    thumbnail_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

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
    has_media: bool = False
    media_attachments: List[MediaAttachmentResponse] = []

    class Config:
        from_attributes = True