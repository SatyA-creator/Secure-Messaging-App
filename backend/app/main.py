from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import json
from typing import Dict, List
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
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Secure Messaging API",
        "version": "1.0.0",
        "docs": "/docs"
    }

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = "demo-token"):
    # For demo purposes, extract user_id from token
    user_id = token.replace("demo-token-", "") if token.startswith("demo-token-") else "anonymous"
    
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")
                payload = message_data.get("payload", {})
                
                if message_type == "new_message":
                    # Handle new message
                    recipient_id = payload.get("recipient_id")
                    if recipient_id:
                        await manager.send_personal_message(data, recipient_id)
                elif message_type == "contact_added":
                    # Handle contact added notification
                    logger.info(f"Contact added by user {user_id}: {payload}")
                    
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from WebSocket")
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)

logger.info(f"FastAPI app initialized in {settings.ENVIRONMENT} mode")