from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.database import Base

class DeletedUser(Base):
    """Track deleted user emails to prevent re-registration"""
    __tablename__ = "deleted_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_by_admin_id = Column(UUID(as_uuid=True), nullable=True)
    
    def __repr__(self):
        return f"<DeletedUser {self.email}>"
