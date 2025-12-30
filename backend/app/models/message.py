from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
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
    
    # Status (0: sent, 1: delivered, 2: read)
    is_read = Column(Integer, default=0)
    is_deleted = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_messages_sender', 'sender_id'),
        Index('idx_messages_recipient', 'recipient_id'),
        Index('idx_messages_created', 'created_at'),
    )

    def __repr__(self):
        return f"<Message {self.id}>"