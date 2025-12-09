from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import json
from typing import Dict, List
from datetime import datetime
from app.config import settings
from app.database import init_db
from app.api import router as api_router
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected to WebSocket")
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected from WebSocket")
            
    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)
            
    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# Create FastAPI app
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

# Initialize database
@app.on_event("startup")
async def startup():
    init_db()
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown():
    logger.info("Application shutting down")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Secure Messaging API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# CORS preflight handler for debugging
@app.options("/{path:path}")
async def options_handler(path: str):
    return {"message": "OK"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

# Favicon endpoint to prevent 405 errors
@app.get("/favicon.ico")
async def favicon():
    return {"message": "No favicon"}

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint for real-time messaging
    user_id: The authenticated user's ID (should validate with JWT in production)
    """
    await manager.connect(websocket, user_id)
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "user_id": user_id,
            "timestamp": json.dumps(datetime.now(), default=str)
        })
        
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")
                payload = message_data.get("payload", {})
                
                logger.info(f"WebSocket message from {user_id}: {message_type}")
                
                if message_type == "new_message":
                    # Handle new message and forward to recipient
                    recipient_id = payload.get("recipient_id")
                    if recipient_id:
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "new_message",
                                "sender_id": user_id,
                                "payload": payload
                            }),
                            recipient_id
                        )
                        logger.info(f"Message forwarded from {user_id} to {recipient_id}")
                    
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
                
                elif message_type == "contact_added":
                    # Notify the other user about the new contact
                    contact_id = payload.get("contact_id")
                    if contact_id:
                        await manager.send_personal_message(
                            json.dumps({
                                "type": "contact_added",
                                "user_id": user_id,
                                "payload": payload
                            }),
                            contact_id
                        )
                        logger.info(f"Contact added notification sent from {user_id} to {contact_id}")
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from WebSocket (user: {user_id})")
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {str(e)}")
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info(f"User {user_id} disconnected from WebSocket")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {str(e)}")
        manager.disconnect(user_id)

logger.info(f"FastAPI app initialized in {settings.ENVIRONMENT} mode")