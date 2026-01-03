# app/models/group.py
from sqlalchemy import Column, String, UUID, DateTime, Boolean, ForeignKey, Text, LargeBinary
from datetime import datetime
import uuid

from app.database import Base

class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    is_encrypted = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="member")  # admin, moderator, member
    added_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    is_muted = Column(Boolean, default=False)

class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    encrypted_content = Column(LargeBinary, nullable=False)
    encrypted_session_key = Column(LargeBinary, nullable=False)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GroupReadReceipt(Base):
    __tablename__ = "group_read_receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("group_messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)
