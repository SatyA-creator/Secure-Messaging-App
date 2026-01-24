from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from app.database import Base

class MediaAttachment(Base):
    __tablename__ = "media_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Message reference - nullable to allow upload before message creation
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=True)
    
    # File information
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)  # image/jpeg, application/pdf, etc.
    file_size = Column(Integer, nullable=False)  # in bytes
    file_url = Column(String(500), nullable=False)  # storage URL or path
    
    # Optional thumbnail for images/videos
    thumbnail_url = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Indexes
    __table_args__ = (
        Index('idx_media_message', 'message_id'),
    )

    def __repr__(self):
        return f"<MediaAttachment {self.file_name}>"
