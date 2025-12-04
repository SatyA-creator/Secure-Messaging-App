from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.message import MessageCreate, MessageResponse
from app.models.message import Message
from app.models.user import User
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
async def get_conversation(other_user_id: uuid.UUID, current_user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get conversation between current user and another user"""
    messages = db.query(Message).filter(
        ((Message.sender_id == current_user_id) & (Message.recipient_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.recipient_id == current_user_id))
    ).order_by(Message.created_at).all()
    
    return [
        MessageResponse(
            id=msg.id,
            sender_id=msg.sender_id,
            recipient_id=msg.recipient_id,
            encrypted_content=msg.encrypted_content,
            encrypted_session_key=msg.encrypted_session_key,
            created_at=msg.created_at,
            is_read=msg.is_read
        )
        for msg in messages
    ]

@router.put("/{message_id}/read")
async def mark_message_read(message_id: uuid.UUID, db: Session = Depends(get_db)):
    """Mark a message as read"""
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    message.is_read = 2  # Read status
    db.commit()
    
    return {"status": "Message marked as read"}