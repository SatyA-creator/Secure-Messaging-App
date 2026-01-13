from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timedelta, timezone
import uuid
from app.database import Base

class Invitation(Base):
    __tablename__ = "invitations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invitee_email = Column(String(255), nullable=False)
    invitation_token = Column(String(255), unique=True, nullable=False)
    is_accepted = Column(Boolean, default=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    
    def __repr__(self):
        return f"Invitation {self.id} from {self.inviter_id} to {self.invitee_email}"
    
    def is_valid(self) -> bool:
        """Check if invitation is still valid (not expired and not accepted)"""
        return not self.is_accepted and datetime.now(timezone.utc) < self.expires_at