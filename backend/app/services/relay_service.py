# app/services/relay_service.py
"""
Relay Service - Ephemeral message relay with no database persistence
Messages are stored in-memory with TTL-based auto-expiry
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set
from uuid import UUID
import uuid
from collections import defaultdict
import threading

from app.models.relay_message import RelayMessage

class RelayService:
    """
    In-memory relay service for ephemeral message delivery.
    
    Philosophy:
    - Server is infrastructure, not authority
    - No long-term storage
    - No indexing or search
    - TTL-based auto-cleanup
    - Acknowledge-and-delete pattern
    """
    
    def __init__(self, default_ttl_days: int = 7, cleanup_interval_seconds: int = 3600):
        """
        Initialize relay service
        
        Args:
            default_ttl_days: How long messages persist before auto-deletion
            cleanup_interval_seconds: How often to run cleanup job
        """
        # In-memory storage: message_id -> RelayMessage
        self._messages: Dict[str, RelayMessage] = {}
        
        # Index: recipient_id -> Set[message_id] for fast lookups
        self._recipient_index: Dict[str, Set[str]] = defaultdict(set)
        
        # Online users tracking for instant delivery
        self._online_users: Set[str] = set()
        
        # Configuration
        self.default_ttl_days = default_ttl_days
        self.cleanup_interval = cleanup_interval_seconds
        
        # Thread-safe lock
        self._lock = threading.RLock()
        
        # Background cleanup task
        self._cleanup_task = None
        self._running = False
    
    def start(self):
        """Start background cleanup task"""
        if not self._running:
            self._running = True
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    def stop(self):
        """Stop background cleanup task"""
        self._running = False
        if self._cleanup_task:
            self._cleanup_task.cancel()
    
    async def _cleanup_loop(self):
        """Background task to remove expired messages"""
        while self._running:
            try:
                await asyncio.sleep(self.cleanup_interval)
                self.cleanup_expired_messages()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ Relay cleanup error: {e}")
    
    def cleanup_expired_messages(self) -> int:
        """
        Remove all expired messages from relay queue.
        Returns count of deleted messages.
        """
        with self._lock:
            expired_ids = [
                msg_id for msg_id, msg in self._messages.items()
                if msg.is_expired()
            ]
            
            for msg_id in expired_ids:
                msg = self._messages[msg_id]
                # Remove from recipient index
                self._recipient_index[msg.recipient_id].discard(msg_id)
                # Remove from storage
                del self._messages[msg_id]
            
            if expired_ids:
                print(f"🧹 Cleaned up {len(expired_ids)} expired relay messages")
            
            return len(expired_ids)
    
    def queue_message(
        self,
        sender_id: str,
        recipient_id: str,
        encrypted_content: str,
        encrypted_session_key: str,
        crypto_version: str = "v1",
        encryption_algorithm: str = "ECDH-AES256-GCM",
        kdf_algorithm: str = "HKDF-SHA256",
        signatures: Optional[list] = None,
        has_media: bool = False,
        media_refs: Optional[list] = None,
        ttl_days: Optional[int] = None
    ) -> RelayMessage:
        """
        Queue a message for relay delivery.
        
        Returns: RelayMessage object
        """
        with self._lock:
            # Create relay message
            msg_id = str(uuid.uuid4())
            expires_at = datetime.now(timezone.utc) + timedelta(
                days=ttl_days or self.default_ttl_days
            )
            
            relay_msg = RelayMessage(
                id=msg_id,
                sender_id=sender_id,
                recipient_id=recipient_id,
                encrypted_content=encrypted_content,
                encrypted_session_key=encrypted_session_key,
                crypto_version=crypto_version,
                encryption_algorithm=encryption_algorithm,
                kdf_algorithm=kdf_algorithm,
                signatures=signatures,
                has_media=has_media,
                media_refs=media_refs,
                expires_at=expires_at
            )
            
            # Store message
            self._messages[msg_id] = relay_msg
            
            # Index by recipient
            self._recipient_index[recipient_id].add(msg_id)
            
            print(f"📬 Queued relay message {msg_id} for {recipient_id}, expires {expires_at}")
            
            return relay_msg
    
    def get_pending_messages(self, recipient_id: str) -> List[RelayMessage]:
        """
        Get all pending (unacknowledged, non-expired) messages for a recipient.
        """
        with self._lock:
            message_ids = self._recipient_index.get(recipient_id, set())
            
            pending = [
                self._messages[msg_id]
                for msg_id in message_ids
                if msg_id in self._messages and self._messages[msg_id].is_deliverable()
            ]
            
            # Record delivery attempts
            for msg in pending:
                msg.record_delivery_attempt()
            
            return pending
    
    def acknowledge_message(self, message_id: str) -> bool:
        """
        Acknowledge message delivery and remove from relay queue.
        
        Returns: True if message was found and deleted, False otherwise
        """
        with self._lock:
            if message_id not in self._messages:
                return False
            
            msg = self._messages[message_id]
            
            # Remove from recipient index
            self._recipient_index[msg.recipient_id].discard(message_id)
            
            # Delete message
            del self._messages[message_id]
            
            print(f"✅ Acknowledged and deleted relay message {message_id}")
            
            return True
    
    def mark_user_online(self, user_id: str):
        """Mark user as online for instant delivery"""
        self._online_users.add(user_id)
    
    def mark_user_offline(self, user_id: str):
        """Mark user as offline"""
        self._online_users.discard(user_id)
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently online"""
        return user_id in self._online_users
    
    def get_stats(self) -> Dict[str, int]:
        """Get relay service statistics"""
        with self._lock:
            total_messages = len(self._messages)
            deliverable_messages = sum(
                1 for msg in self._messages.values() if msg.is_deliverable()
            )
            expired_messages = sum(
                1 for msg in self._messages.values() if msg.is_expired()
            )
            acknowledged_messages = sum(
                1 for msg in self._messages.values() if msg.acknowledged
            )
            
            return {
                "total_messages": total_messages,
                "deliverable_messages": deliverable_messages,
                "expired_messages": expired_messages,
                "acknowledged_messages": acknowledged_messages,
                "online_users": len(self._online_users),
                "unique_recipients": len(self._recipient_index)
            }

# Global singleton instance
relay_service = RelayService()
