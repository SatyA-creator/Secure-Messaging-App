from typing import List, Dict, Set
from fastapi import WebSocket
import json
import redis
from app.config import settings

class ConnectionManager:
    """Manages WebSocket connections and real-time message routing"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room_ids
        self.room_members: Dict[str, Set[str]] = {}  # room_id -> set of user_ids
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True
        )
    
    async def connect(self, user_id: str, websocket: WebSocket):
        """Register new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
        # Publish user online event to Redis
        self.redis_client.publish(
            "user_status",
            json.dumps({"user_id": user_id, "status": "online"})
        )
        
        print(f"✓ User {user_id} connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Publish user offline event to Redis
        self.redis_client.publish(
            "user_status",
            json.dumps({"user_id": user_id, "status": "offline"})
        )
        
        print(f"✗ User {user_id} disconnected. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, user_id: str, message: dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast(self, message: dict, exclude_user: str = None):
        """Broadcast message to all connected users"""
        for user_id, connection in list(self.active_connections.items()):
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def send_to_group(self, group_id: str, message: dict):
        """Send message to all users in a group - queries DB for members"""
        from app.database import SessionLocal
        from app.models.group import GroupMember
        from uuid import UUID
        
        # Get group members from database
        db = SessionLocal()
        try:
            members = db.query(GroupMember).filter(
                GroupMember.group_id == UUID(group_id)
            ).all()
            
            print(f"📤 Sending to group {group_id}: {len(members)} members")
            
            # Send to all online members
            sent_count = 0
            for member in members:
                member_id = str(member.user_id)
                if member_id in self.active_connections:
                    await self.send_personal_message(member_id, message)
                    sent_count += 1
                    print(f"  ✅ Sent to {member_id}")
                else:
                    print(f"  ⏸️ Member {member_id} offline")
            
            print(f"✅ Sent group message to {sent_count}/{len(members)} online members")
        finally:
            db.close()
    
    def add_user_to_room(self, user_id: str, room_id: str):
        """Add user to room (group)"""
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)
        
        if room_id not in self.room_members:
            self.room_members[room_id] = set()
        self.room_members[room_id].add(user_id)
    
    def remove_user_from_room(self, user_id: str, room_id: str):
        """Remove user from room"""
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
        
        if room_id in self.room_members:
            self.room_members[room_id].discard(room_id)
            
            # Delete room if empty
            if not self.room_members[room_id]:
                del self.room_members[room_id]
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently online"""
        return user_id in self.active_connections
    
    def get_room_members(self, room_id: str) -> List[str]:
        """Get all members in a room"""
        return list(self.room_members.get(room_id, set()))

manager = ConnectionManager()