from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.api.auth import get_current_user
from app.schemas.message import MessageCreate, MessageResponse, MediaAttachmentResponse
from app.models.message import Message
from app.models.user import User
from app.models.media import MediaAttachment
from typing import List
import uuid

router = APIRouter()

@router.post("/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, db: Session = Depends(get_db)):
    """Send a new message"""
    # Verify recipient exists
    recipient = db.query(User).filter(User.id == message.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    # Create message
    db_message = Message(
        sender_id=message.sender_id,
        recipient_id=message.recipient_id,
        encrypted_content=message.encrypted_content,
        encrypted_session_key=message.encrypted_session_key
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    return MessageResponse(
        id=db_message.id,
        sender_id=db_message.sender_id,
        recipient_id=db_message.recipient_id,
        encrypted_content=db_message.encrypted_content,
        encrypted_session_key=db_message.encrypted_session_key,
        created_at=db_message.created_at,
        is_read=db_message.is_read
    )

@router.get("/conversation/{other_user_id}", response_model=List[MessageResponse])
async def get_conversation(
    other_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get conversation between current user and another user"""
    current_user_id = current_user.id
    print(f"\n🔍 Querying conversation between {current_user_id} and {other_user_id}")
    print(f"   current_user_id type: {type(current_user_id)}")
    print(f"   other_user_id type: {type(other_user_id)}")
    
    # Debug: Check total messages in database
    total_messages = db.query(Message).count()
    print(f"📊 Total messages in database: {total_messages}")
    
    # Debug: Check messages sent by current user
    sent_by_current = db.query(Message).filter(Message.sender_id == current_user_id).count()
    print(f"📤 Messages sent by {current_user_id}: {sent_by_current}")
    
    # Debug: Check messages received by current user
    received_by_current = db.query(Message).filter(Message.recipient_id == current_user_id).count()
    print(f"📥 Messages received by {current_user_id}: {received_by_current}")
    
    # Debug: Show message count only (content hidden for security)
    all_messages = db.query(Message).all()
    # ⚠️ SECURITY: Sanitized log - detailed message content removed
    print(f"\n📋 Total messages in database: {len(all_messages)}")
    
    # Ensure UUIDs are proper UUID objects for comparison
    current_user_uuid = current_user_id if isinstance(current_user_id, uuid.UUID) else uuid.UUID(str(current_user_id))
    other_user_uuid = other_user_id if isinstance(other_user_id, uuid.UUID) else uuid.UUID(str(other_user_id))
    
    messages = db.query(Message).filter(
        ((Message.sender_id == current_user_uuid) & (Message.recipient_id == other_user_uuid)) |
        ((Message.sender_id == other_user_uuid) & (Message.recipient_id == current_user_uuid))
    ).order_by(Message.created_at).all()
    
    print(f"💬 Found {len(messages)} messages in conversation")
    
    # ⚠️ SECURITY: Sanitized log - showing summary only
    if messages:
        print(f"  📊 Message summary: {len(messages)} total, first_id={messages[0].id if messages else 'none'}, last_id={messages[-1].id if messages else 'none'}")
    
    # Build response with media attachments
    response = []
    for msg in messages:
        # Get media attachments for this message
        media = db.query(MediaAttachment).filter(MediaAttachment.message_id == msg.id).all()
        
        response.append(MessageResponse(
            id=msg.id,
            sender_id=msg.sender_id,
            recipient_id=msg.recipient_id,
            encrypted_content=msg.encrypted_content,
            encrypted_session_key=msg.encrypted_session_key,
            sender_encrypted_content=msg.sender_encrypted_content,
            created_at=msg.created_at,
            is_read=msg.is_read,
            has_media=len(media) > 0,
            media_attachments=[
                MediaAttachmentResponse(
                    id=m.id,
                    file_name=m.file_name,
                    file_type=m.file_type,
                    file_size=m.file_size,
                    file_url=m.file_url,
                    category='image' if m.file_type.startswith('image/') else 'document',
                    thumbnail_url=m.thumbnail_url,
                    created_at=m.created_at
                )
                for m in media
            ]
        ))
    
    return response

@router.put("/{message_id}/read")
async def mark_message_read(message_id: uuid.UUID, db: Session = Depends(get_db)):
    """Mark a message as read"""
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    message.is_read = True  # Mark as read
    db.commit()
    
    return {"status": "Message marked as read"}