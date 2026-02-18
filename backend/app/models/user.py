from sqlalchemy import Column, String, Boolean, DateTime, LargeBinary, Index, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Encryption Keys (Multi-key storage for algorithm agility and key rotation)
    # Structure: [{"key_id": str, "algorithm": str, "key_data": bytes, "created_at": str, "status": str}]
    public_keys = Column(JSON, nullable=False)

    # Encrypted private key backup for cross-device sync.
    # The private key JWK is encrypted with a PBKDF2-derived AES-256-GCM key
    # so only the user (who knows their password) can decrypt it.
    # Server never sees the plaintext private key.
    encrypted_private_key = Column(Text, nullable=True)
    
    # User Info
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(500), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Role-based access control
    role = Column(String(20), nullable=False, default='user', server_default='user')
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Indexes
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_username', 'username'),
    )

    def __repr__(self):
        return f"<User {self.username}>"