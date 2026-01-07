from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from app.services.auth_service import AuthService
import logging
import json
import asyncio
from typing import Dict, List
from datetime import datetime

from app.config import settings
from app.database import init_db
from app.api import router as api_router
from app.services.email_queue import EmailQueue

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"✅ User {user_id} connected to WebSocket")
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"❌ User {user_id} disconnected from WebSocket")
            
    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)
            
    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# ✅ CREATE APP FIRST - BEFORE USING @app.websocket
app = FastAPI(
    title="Secure Messaging API",
    description="End-to-end encrypted messaging application",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.ENVIRONMENT == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Initialize database and start email queue worker
@app.on_event("startup")
async def startup():
    """Initialize database and start background tasks"""
    logger.info("🚀 Application starting...")
    
    # Initialize database
    init_db()
    logger.info("✅ Database initialized")
    
    # Initialize and start email queue worker
    EmailQueue.initialize()
    logger.info("✅ Email queue initialized")
    
    asyncio.create_task(EmailQueue.start_worker())
    logger.info("🚀 Email queue worker started")
    
    logger.info(f"🌍 Environment: {settings.ENVIRONMENT}")
    logger.info(f"📧 Frontend URL: {settings.FRONTEND_URL}")
    logger.info(f"🔐 CORS Origins: {settings.CORS_ORIGINS}")

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    logger.info("🛑 Application shutting down...")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Secure Messaging API",
        "version": "1.0.0",
        "docs": "/docs",
        "environment": settings.ENVIRONMENT
    }

# CORS preflight handler for debugging
@app.options("/{path:path}")
async def options_handler(path: str):
    return {"message": "OK"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }

# Favicon endpoint to prevent 405 errors
@app.get("/favicon.ico")
async def favicon():
    return {"message": "No favicon"}

# ✅ NOW DEFINE WEBSOCKET ENDPOINT (AFTER APP IS CREATED)
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """
    WebSocket endpoint for real-time messaging with JWT authentication
    user_id: The authenticated user's ID
    token: JWT authentication token passed as query parameter
    """
    try:
        # ✅ Verify JWT token
        payload = AuthService.verify_token(token)
        token_user_id = payload.get("sub")
        
        logger.info(f"🔐 WebSocket authentication:")
        logger.info(f"   URL user_id: {user_id}")
        logger.info(f"   Token user_id (sub): {token_user_id}")
        
        if token_user_id != user_id:
            logger.error(f"❌ Token mismatch! URL={user_id}, Token={token_user_id}")
            await websocket.close(code=1008)  # Policy violation
            return
        
        logger.info(f"✅ User {user_id} authenticated with JWT")
        await manager.connect(websocket, user_id)
        
        try:
            # Send connection confirmation
            await websocket.send_json({
                "type": "connection_established",
                "user_id": user_id,
                "timestamp": datetime.now().isoformat()
            })
            
            # Notify others that user came online
            await manager.broadcast(json.dumps({
                "type": "user_online",
                "user_id": user_id,
                "timestamp": datetime.now().isoformat()
            }))
            
            while True:
                data = await websocket.receive_text()
                try:
                    message_data = json.loads(data)
                    message_type = message_data.get("type")
                    payload = message_data.get("payload", {})
                    
                    logger.info(f"📨 WebSocket message from {user_id}: {message_type}")
                    
                    if message_type == "message":
                        # Handle real-time message sending
                        recipient_id = payload.get("recipient_id")
                        encrypted_content = payload.get("encrypted_content")
                        message_id = payload.get("message_id")
                        encrypted_session_key = payload.get("encrypted_session_key")
                        
                        if recipient_id:
                            # ✅ CRITICAL FIX: Save message to database
                            try:
                                from app.models.message import Message
                                from app.database import get_db
                                from uuid import UUID
                                import uuid as uuid_module
                                import traceback
                                
                                # Get database session
                                db = next(get_db())
                                
                                try:
                                    # Convert to UUID objects
                                    sender_uuid = UUID(user_id)
                                    recipient_uuid = UUID(recipient_id)
                                    msg_uuid = UUID(message_id) if message_id else uuid_module.uuid4()
                                    
                                    logger.info(f"🔍 Creating message with UUIDs:")
                                    logger.info(f"   sender_id: {sender_uuid} (type: {type(sender_uuid)})")
                                    logger.info(f"   recipient_id: {recipient_uuid} (type: {type(recipient_uuid)})")
                                    logger.info(f"   message_id: {msg_uuid} (type: {type(msg_uuid)})")
                                    
                                    # Create and save message
                                    db_message = Message(
                                        id=msg_uuid,
                                        sender_id=sender_uuid,
                                        recipient_id=recipient_uuid,
                                        encrypted_content=str(encrypted_content),
                                        encrypted_session_key=str(encrypted_session_key or "default-key")
                                    )
                                    db.add(db_message)
                                    db.commit()
                                    db.refresh(db_message)
                                    
                                    # Verify what was saved
                                    logger.info(f"✅ Message saved - verifying:")
                                    logger.info(f"   DB sender_id: {db_message.sender_id} (type: {type(db_message.sender_id)})")
                                    logger.info(f"   DB recipient_id: {db_message.recipient_id} (type: {type(db_message.recipient_id)})")
                                    
                                    # Use database timestamp for consistency
                                    timestamp = db_message.created_at.isoformat()
                                    message_id = str(db_message.id)
                                    
                                    logger.info(f"💾 Message {message_id} saved to database")
                                    logger.info(f"   Content: {encrypted_content[:50]}...")
                                    logger.info(f"   Timestamp: {timestamp}")
                                except Exception as inner_error:
                                    db.rollback()
                                    logger.error(f"❌ Database error: {inner_error}")
                                    logger.error(f"Traceback: {traceback.format_exc()}")
                                    raise
                                finally:
                                    db.close()
                            except Exception as db_error:
                                logger.error(f"❌ Failed to save message to database: {db_error}")
                                timestamp = datetime.now().isoformat()
                            
                            # Forward message to recipient
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "new_message",
                                    "sender_id": user_id,
                                    "message_id": message_id,
                                    "encrypted_content": encrypted_content,
                                    "encrypted_session_key": encrypted_session_key,
                                    "timestamp": timestamp
                                }),
                                recipient_id
                            )
                            
                            # Send confirmation to sender
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "message_sent",
                                    "message_id": message_id,
                                    "status": "sent",
                                    "timestamp": timestamp
                                }),
                                user_id
                            )
                            
                            logger.info(f"📨 Message forwarded from {user_id} to {recipient_id}")
                    
                    elif message_type == "delivery_confirmation":
                        # Handle delivery confirmation
                        sender_id = payload.get("sender_id")
                        message_id = payload.get("message_id")
                        if sender_id:
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "message_delivered",
                                    "message_id": message_id,
                                    "timestamp": datetime.now().isoformat()
                                }),
                                sender_id
                            )
                    
                    elif message_type == "typing":
                        # Handle typing indicator
                        recipient_id = payload.get("recipient_id")
                        if recipient_id:
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "typing",
                                    "sender_id": user_id,
                                    "is_typing": payload.get("is_typing", False)
                                }),
                                recipient_id
                            )
                    
                    elif message_type == "group_message":
                        # Handle group message sending
                        group_id = payload.get("group_id")
                        encrypted_content = payload.get("encrypted_content")
                        encrypted_session_keys = payload.get("encrypted_session_keys", {})
                        
                        if group_id:
                            try:
                                from app.models.group import GroupMember, GroupMessage
                                from app.database import get_db
                                from uuid import UUID
                                import uuid as uuid_module
                                
                                # Get database session
                                db = next(get_db())
                                
                                try:
                                    # Get all group members
                                    members = db.query(GroupMember).filter(
                                        GroupMember.group_id == UUID(group_id)
                                    ).all()
                                    
                                    # Create message
                                    db_message = GroupMessage(
                                        id=uuid_module.uuid4(),
                                        group_id=UUID(group_id),
                                        sender_id=UUID(user_id),
                                        encrypted_content=encrypted_content.encode() if isinstance(encrypted_content, str) else encrypted_content,
                                        encrypted_session_key=json.dumps(encrypted_session_keys).encode()
                                    )
                                    db.add(db_message)
                                    db.commit()
                                    db.refresh(db_message)
                                    
                                    message_id = str(db_message.id)
                                    timestamp = db_message.created_at.isoformat()
                                    
                                    logger.info(f"💾 Group message {message_id} saved to database")
                                    
                                    # Send to all group members except sender
                                    for member in members:
                                        if str(member.user_id) != user_id:
                                            await manager.send_personal_message(
                                                json.dumps({
                                                    "type": "new_group_message",
                                                    "group_id": group_id,
                                                    "sender_id": user_id,
                                                    "message_id": message_id,
                                                    "encrypted_content": encrypted_content,
                                                    "encrypted_session_keys": encrypted_session_keys,
                                                    "timestamp": timestamp
                                                }),
                                                str(member.user_id)
                                            )
                                    
                                    # Send confirmation to sender
                                    await manager.send_personal_message(
                                        json.dumps({
                                            "type": "group_message_sent",
                                            "group_id": group_id,
                                            "message_id": message_id,
                                            "status": "sent",
                                            "timestamp": timestamp
                                        }),
                                        user_id
                                    )
                                    
                                    logger.info(f"📨 Group message forwarded from {user_id} to group {group_id}")
                                    
                                except Exception as inner_error:
                                    db.rollback()
                                    logger.error(f"❌ Database error: {inner_error}")
                                    raise
                                finally:
                                    db.close()
                            except Exception as db_error:
                                logger.error(f"❌ Failed to save group message: {db_error}")
                    
                    elif message_type == "contact_added":
                        # Notify the inviter (admin) about the new contact
                        inviter_id = payload.get("inviter_id") 
                        contact_id = payload.get("contact_id")
                        
                        if inviter_id:
                            # Send notification to inviter (usually the admin)
                            await manager.send_personal_message(
                                json.dumps({
                                    "type": "contact_added",
                                    "contact_id": contact_id,
                                    "user_id": contact_id,
                                    "username": payload.get("username"),
                                    "email": payload.get("email"),
                                    "full_name": payload.get("full_name"),
                                    "is_online": False,
                                    "timestamp": datetime.now().isoformat()
                                }),
                                inviter_id
                            )
                            logger.info(f"👥 Contact added notification sent to {inviter_id} about user {contact_id}")
                        
                except json.JSONDecodeError:
                    logger.error(f"❌ Invalid JSON received from WebSocket (user: {user_id})")
                except Exception as e:
                    logger.error(f"❌ Error processing WebSocket message: {str(e)}")
                    
        except WebSocketDisconnect:
            manager.disconnect(user_id)
            logger.info(f"❌ User {user_id} disconnected from WebSocket")
        except Exception as e:
            logger.error(f"❌ WebSocket error for user {user_id}: {str(e)}")
            manager.disconnect(user_id)
    
    except Exception as e:
        logger.error(f"❌ WebSocket authentication error: {str(e)}")
        await websocket.close(code=1008)
    
    finally:
        # Cleanup and notify others user went offline
        manager.disconnect(user_id)
        await manager.broadcast(json.dumps({
            "type": "user_offline",
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }))
        logger.info(f"❌ User {user_id} disconnected")

logger.info(f"✅ FastAPI app initialized in {settings.ENVIRONMENT} mode")
