# app/models/relay_message.py
"""
Relay Message Model - Temporary in-memory message storage
No database persistence - messages are ephemeral with TTL
"""
from datetime import datetime, timezone, timedelta
from uuid import UUID
from typing import Optional, Dict, Any
from dataclasses import dataclass, field

@dataclass
class RelayMessage:
    """
    Ephemeral relay message stored in memory only.
    TTL-based auto-expiry ensures no long-term storage.
    """
    id: str
    sender_id: str
    recipient_id: str
    encrypted_content: str
    encrypted_session_key: str
    
    # Crypto metadata (PQ-ready)
    crypto_version: str = "v1"
    encryption_algorithm: str = "ECDH-AES256-GCM"
    kdf_algorithm: str = "HKDF-SHA256"
    signatures: Optional[list] = None
    
    # Relay metadata
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = field(default=None)
    delivery_attempts: int = 0
    last_attempt_at: Optional[datetime] = None
    acknowledged: bool = False
    
    # Media attachments metadata (content-addressed)
    has_media: bool = False
    media_refs: Optional[list] = None  # [{"hash": "sha256-...", "size": 1234}]
    
    def __post_init__(self):
        """Set expiry time on creation"""
        if self.expires_at is None:
            # Default TTL: 7 days (configurable)
            self.expires_at = self.created_at + timedelta(days=7)
    
    def is_expired(self) -> bool:
        """Check if message has exceeded TTL"""
        return datetime.now(timezone.utc) > self.expires_at
    
    def is_deliverable(self) -> bool:
        """Check if message can be delivered"""
        return not self.is_expired() and not self.acknowledged
    
    def mark_acknowledged(self):
        """Mark message as delivered and acknowledged"""
        self.acknowledged = True
    
    def record_delivery_attempt(self):
        """Increment delivery attempts counter"""
        self.delivery_attempts += 1
        self.last_attempt_at = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for transmission"""
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "recipient_id": self.recipient_id,
            "encrypted_content": self.encrypted_content,
            "encrypted_session_key": self.encrypted_session_key,
            "crypto_version": self.crypto_version,
            "encryption_algorithm": self.encryption_algorithm,
            "kdf_algorithm": self.kdf_algorithm,
            "signatures": self.signatures,
            "has_media": self.has_media,
            "media_refs": self.media_refs,
            "created_at": self.created_at.isoformat(),
            "delivery_attempts": self.delivery_attempts
        }
