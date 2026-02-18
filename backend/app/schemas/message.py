from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional, Dict, Any

class MediaAttachmentResponse(BaseModel):
    id: UUID
    file_name: str
    file_type: str
    file_size: int
    file_url: str
    category: str
    thumbnail_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, extra='ignore')

class MessageCreate(BaseModel):
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: str
    encrypted_session_key: str
    crypto_version: str = "v1"
    encryption_algorithm: str = "ECDH-AES256-GCM"
    kdf_algorithm: str = "HKDF-SHA256"
    signatures: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(extra='ignore')

class MessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    recipient_id: UUID
    encrypted_content: str
    encrypted_session_key: str
    # ✅ Self-encrypted copy for sender to decrypt on any device
    sender_encrypted_content: Optional[str] = None
    crypto_version: str
    encryption_algorithm: str
    kdf_algorithm: str
    signatures: Optional[List[Dict[str, Any]]] = None
    is_read: bool
    created_at: datetime
    has_media: bool = False
    media_attachments: List[MediaAttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True, extra='ignore')