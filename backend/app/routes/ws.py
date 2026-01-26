from fastapi import APIRouter, WebSocket, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.websocket_manager import manager
from app.services.auth_service import AuthService
# from app.services.message_service import MessageService  # TODO: Create this service
from app.services.group_service import GroupService
from app.middleware.auth import get_current_user
import json
from datetime import datetime, timezone
from uuid import UUID
import uuid as uuid_module

router = APIRouter(tags=["websocket"])

@router.websocket("/ws/{user_id}")
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
        db = next(get_db())
        
        # Connect user
        await manager.connect(user_id, websocket)
        
        # Notify others that user came online
        await manager.broadcast({
            "type": "user_online",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
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
                has_media = data.get("has_media", False)
                media_ids = data.get("media_ids", [])
                
                # Save message to database
                from app.models.message import Message
                from app.models.media import MediaAttachment
                from uuid import UUID
                import uuid as uuid_module
                
                db_message = Message(
                    id=UUID(message_id) if message_id else uuid_module.uuid4(),
                    sender_id=UUID(user_id),
                    recipient_id=UUID(recipient_id),
                    encrypted_content=encrypted_content,
                    encrypted_session_key=encrypted_session_key,
                    has_media=has_media
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)
                
                # Link media attachments to this message
                media_attachments = []
                if media_ids:
                    for media_id in media_ids:
                        media = db.query(MediaAttachment).filter(
                            MediaAttachment.id == UUID(media_id)
                        ).first()
                        if media:
                            media.message_id = db_message.id
                            db.add(media)
                            media_attachments.append({
                                "id": str(media.id),
                                "file_name": media.file_name,
                                "file_type": media.file_type,
                                "file_size": media.file_size,
                                "file_url": media.file_url,
                                "category": 'image' if media.file_type.startswith('image/') else 'document'
                            })
                    db.commit()
                
                # Use database timestamp for consistency
                timestamp = db_message.created_at.isoformat()
                
                # Send to recipient if online
                await manager.send_personal_message(recipient_id, {
                    "type": "new_message",
                    "message_id": str(db_message.id),
                    "sender_id": user_id,
                    "encrypted_content": encrypted_content,
                    "encrypted_session_key": encrypted_session_key,
                    "timestamp": timestamp,
                    "has_media": has_media,
                    "media_attachments": media_attachments
                })
                
                # Send confirmation to sender with same timestamp
                await manager.send_personal_message(user_id, {
                    "type": "message_sent",
                    "message_id": str(db_message.id),
                    "status": "sent",
                    "timestamp": timestamp,
                    "has_media": has_media,
                    "media_attachments": media_attachments
                })
            
            elif data.get("type") == "delivery_confirmation":
                # Message was delivered
                message_id = data.get("message_id")
                # MessageService.mark_as_delivered(db, message_id)  # TODO: Implement
                
                # Notify sender
                sender_id = data.get("sender_id")
                await manager.send_personal_message(sender_id, {
                    "type": "message_delivered",
                    "message_id": message_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            
            elif data.get("type") == "read_confirmation":
                # Message was read
                message_id = data.get("message_id")
                # MessageService.mark_as_read(db, message_id)  # TODO: Implement
                
                # Notify sender
                sender_id = data.get("sender_id")
                await manager.send_personal_message(sender_id, {
                    "type": "message_read",
                    "message_id": message_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
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
                from app.models.group import GroupMessage, GroupMember, Group
                
                group_id = data.get("group_id")
                encrypted_content = data.get("encrypted_content")
                encrypted_session_keys = data.get("encrypted_session_keys")  # dict: user_id -> key
                
                print(f"💬 Processing group message for group {group_id}")
                print(f"   Sender: {user_id}")
                print(f"   Content: {encrypted_content}")
                
                # ✅ FIX: Verify sender is member OR admin of the group
                group = db.query(Group).filter(Group.id == UUID(group_id)).first()
                
                if not group:
                    print(f"❌ Group {group_id} not found")
                    continue
                
                is_admin = str(group.admin_id) == user_id
                is_member = db.query(GroupMember).filter(
                    (GroupMember.group_id == UUID(group_id)) &
                    (GroupMember.user_id == UUID(user_id))
                ).first() is not None
                
                if not (is_admin or is_member):
                    print(f"❌ User {user_id} not authorized for group {group_id}")
                    continue
                
                print(f"✅ User authorized - Admin: {is_admin}, Member: {is_member}")
                
                # Save group message to database
                new_message = GroupMessage(
                    id=uuid_module.uuid4(),
                    group_id=UUID(group_id),
                    sender_id=UUID(user_id),
                    encrypted_content=str(encrypted_content).encode() if isinstance(encrypted_content, str) else encrypted_content,
                    encrypted_session_key=b"session_key"  # Simplified for now
                )
                
                db.add(new_message)
                db.commit()
                db.refresh(new_message)
                
                print(f"✅ Group message saved with ID: {new_message.id}")
                
                # Send to all group members via WebSocket
                await manager.send_to_group(group_id, {
                    "type": "new_group_message",
                    "message_id": str(new_message.id),
                    "group_id": group_id,
                    "sender_id": user_id,
                    "encrypted_content": encrypted_content,
                    "encrypted_session_keys": encrypted_session_keys,
                    "timestamp": new_message.created_at.isoformat()
                })
                
                print(f"✅ Group message broadcast complete")
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        # Cleanup on disconnect
        manager.disconnect(user_id)
        
        # Notify others that user went offline
        await manager.broadcast({
            "type": "user_offline",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })