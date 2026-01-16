from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Participants
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Encrypted Content (stored as text for compatibility)
    encrypted_content = Column(Text, nullable=False)
    encrypted_session_key = Column(Text, nullable=False)
    
    # Status (Boolean: False=unread/not deleted, True=read/deleted)
    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    
    # Media attachments
    has_media = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    media_attachments = relationship("MediaAttachment", backref="message", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_messages_sender', 'sender_id'),
        Index('idx_messages_recipient', 'recipient_id'),
        Index('idx_messages_created', 'created_at'),
    )

    def __repr__(self):
        return f"<Message {self.id}>"