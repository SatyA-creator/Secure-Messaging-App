# app/api/relay.py
"""
Relay API - Ephemeral message relay endpoints
No database persistence - all messages are temporary with TTL
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.services.relay_service import relay_service
from app.websocket_manager import manager
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID

router = APIRouter()

class RelayMessageCreate(BaseModel):
    """Request model for creating relay message"""
    recipient_id: str
    encrypted_content: str
    encrypted_session_key: str
    crypto_version: str = "v1"
    encryption_algorithm: str = "ECDH-AES256-GCM"
    kdf_algorithm: str = "HKDF-SHA256"
    signatures: Optional[List[Dict[str, Any]]] = None
    has_media: bool = False
    media_refs: Optional[List[Dict[str, Any]]] = None
    ttl_days: Optional[int] = None

class MessageAcknowledgment(BaseModel):
    """Request model for acknowledging message delivery"""
    message_id: str

@router.post("/send")
async def send_relay_message(
    message: RelayMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send message via relay service (NO database storage - privacy-first).
    
    Messages are only stored in:
    - Relay service (temporary, with TTL) for delivery
    - Client-side IndexedDB (permanent, encrypted) for history
    
    Server never stores message content permanently.
    
    Behavior:
    - If recipient is online: instant WebSocket delivery
    - If recipient is offline: queue in relay service with TTL
    - Sender never blocked waiting for delivery
    """
    sender_id = str(current_user.id)
    recipient_id = message.recipient_id
    
    # Verify recipient exists
    recipient = db.query(User).filter(User.id == UUID(recipient_id)).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    # Queue message in relay service (temporary storage only)
    relay_msg = relay_service.queue_message(
        sender_id=sender_id,
        recipient_id=recipient_id,
        encrypted_content=message.encrypted_content,
        encrypted_session_key=message.encrypted_session_key,
        crypto_version=message.crypto_version,
        encryption_algorithm=message.encryption_algorithm,
        kdf_algorithm=message.kdf_algorithm,
        signatures=message.signatures,
        has_media=message.has_media,
        media_refs=message.media_refs,
        ttl_days=message.ttl_days
    )
    
    # Attempt instant delivery if recipient is online
    if relay_service.is_user_online(recipient_id):
        message_payload = {
            "type": "relay_message",
            "data": relay_msg.to_dict()
        }
        delivered = await manager.send_personal_message(recipient_id, message_payload)
        
        if delivered:
            print(f"📨 Instant delivery to online user {recipient_id}")
        else:
            print(f"📬 Queued for offline user {recipient_id} (TTL: {relay_msg.expires_at})")
    else:
        print(f"📬 Queued for offline user {recipient_id} (TTL: {relay_msg.expires_at})")
    
    return {
        "success": True,
        "message_id": relay_msg.id,
        "status": "delivered" if relay_service.is_user_online(recipient_id) else "queued",
        "expires_at": relay_msg.expires_at.isoformat()
    }

@router.post("/acknowledge")
async def acknowledge_message(
    ack: MessageAcknowledgment,
    current_user: User = Depends(get_current_user)
):
    """
    Acknowledge message delivery - server immediately deletes the relay message.
    
    This is the acknowledge-and-delete pattern: once client confirms
    receipt and local storage, the server forgets the message forever.
    """
    success = relay_service.acknowledge_message(ack.message_id)
    
    if not success:
        # Message not found - either already deleted or never existed
        # This is not an error in relay model (idempotent ACKs are fine)
        print(f"⚠️ ACK for non-existent message {ack.message_id}")
    
    return {
        "success": True,
        "message_id": ack.message_id,
        "status": "deleted" if success else "not_found"
    }

@router.get("/pending")
async def get_pending_messages(
    current_user: User = Depends(get_current_user)
):
    """
    Get all pending (unacknowledged) relay messages for current user.
    
    Client should:
    1. Call this on reconnect
    2. Save messages to local IndexedDB
    3. Send ACK for each message
    4. Server deletes acknowledged messages
    """
    user_id = str(current_user.id)
    pending_messages = relay_service.get_pending_messages(user_id)
    
    return {
        "success": True,
        "count": len(pending_messages),
        "messages": [msg.to_dict() for msg in pending_messages]
    }

@router.get("/stats")
async def get_relay_stats(current_user: User = Depends(get_current_user)):
    """
    Get relay service statistics (for monitoring).
    Only accessible to authenticated users.
    """
    stats = relay_service.get_stats()
    
    return {
        "success": True,
        "stats": stats
    }

@router.post("/cleanup")
async def trigger_cleanup(current_user: User = Depends(get_current_user)):
    """
    Manually trigger cleanup of expired messages.
    (Normally runs automatically via background task)
    """
    # Optional: restrict to admin users
    # if current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Admin only")
    
    deleted_count = relay_service.cleanup_expired_messages()
    
    return {
        "success": True,
        "deleted_count": deleted_count
    }
