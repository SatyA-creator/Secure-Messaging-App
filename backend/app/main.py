from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.services.auth_service import AuthService
import logging
import json
import asyncio
from typing import Dict, List
from datetime import datetime
import re

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

# ✅ CREATE APP FIRST
app = FastAPI(
    title="Secure Messaging API",
    description="End-to-end encrypted messaging application",
    version="1.0.0"
)

# ✅ Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"📥 {request.method} {request.url.path} from {request.client.host if request.client else 'unknown'}")
    logger.info(f"   Origin: {request.headers.get('origin', 'none')}")
    response = await call_next(request)
    logger.info(f"📤 Response status: {response.status_code}")
    return response

# ✅ Add CORS middleware - SIMPLE AND PERMISSIVE for debugging
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


# Initialize database and start email queue worker
@app.on_event("startup")
async def startup():
    """Initialize database and start background tasks"""
    logger.info("🚀 Application starting...")
    
    # Initialize database with error handling
    try:
        init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        logger.error("⚠️  Application will continue but database operations will fail!")
        logger.error("📋 Possible causes:")
        logger.error("   1. Supabase requires IPv4 add-on for external connections")
        logger.error("   2. Check DATABASE_URL in environment variables")
        logger.error("   3. Verify Supabase firewall/network settings")
        # Don't crash the app - let it start so we can see the error in logs
    
    # Initialize and start email queue worker
    EmailQueue.initialize()
    logger.info("✅ Email queue initialized")
    
    asyncio.create_task(EmailQueue.start_worker())
    logger.info("🚀 Email queue worker started")
    
    logger.info(f"🌍 Environment: {settings.ENVIRONMENT}")
    logger.info(f"📧 Frontend URL: {settings.FRONTEND_URL}")
    logger.info(f"🔐 CORS Origins: {settings.CORS_ORIGINS}")
    
    # ✅ Debug: Print all registered routes
    logger.info("\n" + "="*80)
    logger.info("🔍 ALL REGISTERED ROUTES:")
    logger.info("="*80)
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = ', '.join(sorted(route.methods - {'OPTIONS', 'HEAD'}))
            if methods:
                logger.info(f"  {methods:20} {route.path}")
    
    logger.info("="*80)
    logger.info("🔍 Looking specifically for groups routes:")
    
    groups_routes = [r for r in app.routes if hasattr(r, 'path') and '/groups' in r.path]
    if groups_routes:
        for route in groups_routes:
            if hasattr(route, 'methods'):
                methods = ', '.join(sorted(route.methods - {'OPTIONS', 'HEAD'}))
                logger.info(f"  ✅ {methods:15} {route.path}")
    else:
        logger.error("  ❌ NO /groups routes found!")
    
    logger.info("="*80 + "\n")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    logger.info("🛑 Application shutting down...")


# Root endpoint
@app.get("/", include_in_schema=True)
@app.head("/", include_in_schema=False)
async def root():
    return {
        "message": "Secure Messaging API",
        "version": "1.0.0",
        "docs": "/docs",
        "environment": settings.ENVIRONMENT
    }


# Health check endpoint
@app.get("/health")
@app.head("/health", include_in_schema=False)
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


# ✅ WEBSOCKET ENDPOINT
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """WebSocket endpoint for real-time messaging with JWT authentication"""
    try:
        # Verify JWT token
        payload = AuthService.verify_token(token)
        token_user_id = payload.get("sub")
        
        logger.info(f"🔐 WebSocket authentication:")
        logger.info(f"   URL user_id: {user_id}")
        logger.info(f"   Token user_id (sub): {token_user_id}")
        
        if token_user_id != user_id:
            logger.error(f"❌ Token mismatch! URL={user_id}, Token={token_user_id}")
            await websocket.close(code=1008)
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
                        # Handle direct messages
                        recipient_id = payload.get("recipient_id")
                        encrypted_content = payload.get("encrypted_content")
                        message_id = payload.get("message_id")
                        encrypted_session_key = payload.get("encrypted_session_key")
                        
                        if recipient_id:
                            try:
                                from app.models.message import Message
                                from app.database import get_db
                                from uuid import UUID
                                import uuid as uuid_module
                                
                                db = next(get_db())
                                
                                try:
                                    sender_uuid = UUID(user_id)
                                    recipient_uuid = UUID(recipient_id)
                                    msg_uuid = UUID(message_id) if message_id else uuid_module.uuid4()
                                    
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
                                    
                                    timestamp = db_message.created_at.isoformat()
                                    message_id = str(db_message.id)
                                    
                                    logger.info(f"💾 Message {message_id} saved to database")
                                except Exception as inner_error:
                                    db.rollback()
                                    logger.error(f"❌ Database error: {inner_error}")
                                    raise
                                finally:
                                    db.close()
                            except Exception as db_error:
                                logger.error(f"❌ Failed to save message: {db_error}")
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
                    
                    elif message_type == "group_message":
                        # Handle group messages
                        group_id = payload.get("group_id")
                        encrypted_content = payload.get("encrypted_content")
                        encrypted_session_keys = payload.get("encrypted_session_keys", {})
                        
                        if group_id:
                            try:
                                from app.models.group import GroupMember, GroupMessage, Group
                                from app.database import get_db
                                from uuid import UUID
                                import uuid as uuid_module
                                
                                db = next(get_db())
                                
                                try:
                                    # ✅ FIX: Get group to check admin
                                    group = db.query(Group).filter(Group.id == UUID(group_id)).first()
                                    
                                    if not group:
                                        logger.error(f"❌ Group {group_id} not found")
                                        raise Exception(f"Group {group_id} not found")
                                    
                                    # ✅ FIX: Verify sender is admin OR member
                                    is_admin = str(group.admin_id) == user_id
                                    is_member = db.query(GroupMember).filter(
                                        GroupMember.group_id == UUID(group_id),
                                        GroupMember.user_id == UUID(user_id)
                                    ).first() is not None
                                    
                                    if not (is_admin or is_member):
                                        logger.error(f"❌ User {user_id} not authorized for group {group_id}")
                                        raise Exception(f"User not authorized")
                                    
                                    logger.info(f"✅ User {user_id} authorized (Admin: {is_admin}, Member: {is_member})")
                                    
                                    # Get all group members
                                    members = db.query(GroupMember).filter(
                                        GroupMember.group_id == UUID(group_id)
                                    ).all()
                                    
                                    # Save message to database
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
                                    
                                    logger.info(f"💾 Group message {message_id} saved")
                                    
                                    # ✅ FIX: Build recipient list including admin
                                    recipient_ids = set()
                                    
                                    # Add all members
                                    for member in members:
                                        recipient_ids.add(str(member.user_id))
                                    
                                    # ✅ CRITICAL: Add admin to recipients
                                    recipient_ids.add(str(group.admin_id))
                                    
                                    # Remove sender from recipients to avoid duplicate
                                    if user_id in recipient_ids:
                                        recipient_ids.remove(user_id)
                                    
                                    logger.info(f"📤 Broadcasting to {len(recipient_ids)} recipients (excluding sender)")
                                    
                                    # Send to all recipients except sender
                                    for recipient_id in recipient_ids:
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
                                            recipient_id
                                        )
                                        logger.info(f"  ✅ Sent to user {recipient_id}")
                                    
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
                                    
                                    logger.info(f"✅ Group message broadcast complete for group {group_id}")
                                except Exception as inner_error:
                                    db.rollback()
                                    logger.error(f"❌ Database error: {inner_error}")
                                    raise
                                finally:
                                    db.close()
                            except Exception as db_error:
                                logger.error(f"❌ Failed to save group message: {db_error}")
                                import traceback
                                traceback.print_exc()
                    
                    elif message_type == "delivery_confirmation":
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
                    
                    elif message_type == "contact_added":
                        inviter_id = payload.get("inviter_id")
                        contact_id = payload.get("contact_id")
                        
                        if inviter_id:
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
                            logger.info(f"👥 Contact added notification sent")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"❌ JSON decode error: {e}")
                except Exception as e:
                    logger.error(f"❌ Error processing message: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    
        except WebSocketDisconnect:
            manager.disconnect(user_id)
            logger.info(f"❌ User {user_id} disconnected")
        except Exception as e:
            logger.error(f"❌ WebSocket error for user {user_id}: {str(e)}")
            manager.disconnect(user_id)
    
    except Exception as e:
        logger.error(f"❌ WebSocket authentication error: {str(e)}")
        await websocket.close(code=1008)
    
    finally:
        manager.disconnect(user_id)
        await manager.broadcast(json.dumps({
            "type": "user_offline",
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }))


logger.info(f"✅ FastAPI app initialized in {settings.ENVIRONMENT} mode")
