from fastapi import APIRouter, WebSocket, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.database import getdb
from app.websocket_manager import manager
from app.services.auth_service import AuthService
from app.services.message_service import MessageService
from app.middleware.auth import get_current_user
import json
from datetime import datetime

router = APIRouter(prefix="/api/ws", tags=["websocket"])

@router.websocket("/chat/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """
    WebSocket endpoint for real-time messaging
    
    Message types:
    - "message": Send encrypted message
    - "delivery_confirmation": Acknowledge message received
    - "read_confirmation": Mark message as read
    - "typing": User is typing indicator
    - "group_message": Send message to group
    """
    
    try:
        # Verify JWT token
        payload = AuthService.verify_token(token)
        if payload.get("sub") != user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Get database session
        db = next(getdb())
        
        # Connect user
        await manager.connect(user_id, websocket)
        
        # Notify others that user came online
        await manager.broadcast({
            "type": "user_online",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                # One-to-one message
                recipient_id = data.get("recipient_id")
                encrypted_content = data.get("encrypted_content")
                encrypted_session_key = data.get("encrypted_session_key")
                message_id = data.get("message_id")  # Use frontend message ID if provided
                
                # Save message to database
                from app.models.message import Message
                from uuid import UUID
                import uuid as uuid_module
                
                db_message = Message(
                    id=UUID(message_id) if message_id else uuid_module.uuid4(),
                    sender_id=UUID(user_id),
                    recipient_id=UUID(recipient_id),
                    encrypted_content=encrypted_content,
                    encrypted_session_key=encrypted_session_key
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)
                
                # Use database timestamp for consistency
                timestamp = db_message.created_at.isoformat()
                
                # Send to recipient if online
                await manager.send_personal_message(recipient_id, {
                    "type": "new_message",
                    "message_id": str(db_message.id),
                    "sender_id": user_id,
                    "encrypted_content": encrypted_content,
                    "encrypted_session_key": encrypted_session_key,
                    "timestamp": timestamp
                })
                
                # Send confirmation to sender with same timestamp
                await manager.send_personal_message(user_id, {
                    "type": "message_sent",
                    "message_id": str(db_message.id),
                    "status": "sent",
                    "timestamp": timestamp
                })
            
            elif data.get("type") == "delivery_confirmation":
                # Message was delivered
                message_id = data.get("message_id")
                MessageService.mark_as_delivered(db, message_id)
                
                # Notify sender
                sender_id = data.get("sender_id")
                await manager.send_personal_message(sender_id, {
                    "type": "message_delivered",
                    "message_id": message_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            elif data.get("type") == "read_confirmation":
                # Message was read
                message_id = data.get("message_id")
                MessageService.mark_as_read(db, message_id)
                
                # Notify sender
                sender_id = data.get("sender_id")
                await manager.send_personal_message(sender_id, {
                    "type": "message_read",
                    "message_id": message_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            elif data.get("type") == "typing":
                # User is typing indicator
                recipient_id = data.get("recipient_id")
                await manager.send_personal_message(recipient_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "is_typing": data.get("is_typing", True)
                })
            
            elif data.get("type") == "group_message":
                # Group message
                group_id = data.get("group_id")
                encrypted_content = data.get("encrypted_content")
                encrypted_session_keys = data.get("encrypted_session_keys")  # dict: user_id -> key
                
                # Save group message
                message = MessageService.send_group_message(
                    db=db,
                    sender_id=user_id,
                    group_id=group_id,
                    encrypted_content=encrypted_content,
                    encrypted_session_keys=encrypted_session_keys
                )
                
                # Send to all group members
                await manager.send_to_group(group_id, {
                    "type": "new_group_message",
                    "message_id": str(message.id),
                    "group_id": group_id,
                    "sender_id": user_id,
                    "encrypted_content": encrypted_content,
                    "encrypted_session_keys": encrypted_session_keys,
                    "timestamp": message.created_at.isoformat()
                })
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        # Cleanup on disconnect
        manager.disconnect(user_id)
        
        # Notify others that user went offline
        await manager.broadcast({
            "type": "user_offline",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })