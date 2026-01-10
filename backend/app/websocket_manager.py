# app/websocket_manager.py
from typing import List, Dict, Set, Optional
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
        
        # Initialize Redis only if settings are available
        try:
            if hasattr(settings, 'REDIS_HOST') and settings.REDIS_HOST:
                self.redis_client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    decode_responses=True
                )
                print("✅ Redis client initialized")
            else:
                self.redis_client = None
                print("⚠️ Redis not configured, using in-memory only")
        except Exception as e:
            print(f"⚠️ Redis initialization failed: {e}, using in-memory only")
            self.redis_client = None
    
    async def connect(self, user_id: str, websocket: WebSocket):
        """Register new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
        # Publish user online event to Redis (if available)
        if self.redis_client:
            try:
                self.redis_client.publish(
                    "user_status",
                    json.dumps({"user_id": user_id, "status": "online"})
                )
            except Exception as e:
                print(f"⚠️ Redis publish error: {e}")
        
        print(f"✅ User {user_id} connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Clean up user rooms
        if user_id in self.user_rooms:
            for room_id in self.user_rooms[user_id]:
                if room_id in self.room_members:
                    self.room_members[room_id].discard(user_id)
            del self.user_rooms[user_id]
        
        # Publish user offline event to Redis (if available)
        if self.redis_client:
            try:
                self.redis_client.publish(
                    "user_status",
                    json.dumps({"user_id": user_id, "status": "offline"})
                )
            except Exception as e:
                print(f"⚠️ Redis publish error: {e}")
        
        print(f"❌ User {user_id} disconnected. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, user_id: str, message: dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
                print(f"✅ Message sent to {user_id}: {message.get('type', 'unknown')}")
            except Exception as e:
                print(f"❌ Error sending to {user_id}: {e}")
                self.disconnect(user_id)
        else:
            print(f"⏸️ User {user_id} is offline, message not sent")
    
    async def broadcast(self, message: dict, exclude_user: Optional[str] = None):
        """Broadcast message to all connected users"""
        sent_count = 0
        for user_id, connection in list(self.active_connections.items()):
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                await connection.send_json(message)
                sent_count += 1
            except Exception as e:
                print(f"❌ Error broadcasting to {user_id}: {e}")
                self.disconnect(user_id)
        
        print(f"📡 Broadcast sent to {sent_count} users")
    
    async def broadcast_to_group(self, group_id: str, message: dict):
        """
        Send message to all members in a group
        Queries database for current group members
        """
        from app.database import SessionLocal
        from app.models.group import GroupMember
        from uuid import UUID
        
        db = SessionLocal()
        try:
            # Convert group_id to UUID if it's a string
            try:
                group_uuid = UUID(group_id) if isinstance(group_id, str) else group_id
            except ValueError as e:
                print(f"❌ Invalid group_id format: {group_id}")
                return
            
            # Get all group members from database
            members = db.query(GroupMember).filter(
                GroupMember.group_id == group_uuid
            ).all()
            
            print(f"📤 Broadcasting to group {group_id}: {len(members)} members")
            
            # Send to all online members
            sent_count = 0
            offline_count = 0
            
            for member in members:
                member_id = str(member.user_id)
                if member_id in self.active_connections:
                    await self.send_personal_message(member_id, message)
                    sent_count += 1
                    print(f"  ✅ Sent to {member_id}")
                else:
                    offline_count += 1
                    print(f"  ⏸️ Member {member_id} offline, skipping")
            
            print(f"✅ Group broadcast complete: {sent_count} online, {offline_count} offline")
            
        except Exception as e:
            print(f"❌ Error broadcasting to group {group_id}: {e}")
        finally:
            db.close()
    
    async def send_to_group(self, group_id: str, message: dict):
        """
        Alias for broadcast_to_group for backward compatibility
        Send message to all users in a group
        """
        await self.broadcast_to_group(group_id, message)
    
    def add_user_to_room(self, user_id: str, room_id: str):
        """Add user to room (group) - for tracking purposes"""
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)
        
        if room_id not in self.room_members:
            self.room_members[room_id] = set()
        self.room_members[room_id].add(user_id)
        
        print(f"👥 User {user_id} added to room {room_id}")
    
    def remove_user_from_room(self, user_id: str, room_id: str):
        """Remove user from room"""
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
            if not self.user_rooms[user_id]:  # Clean up empty set
                del self.user_rooms[user_id]
        
        if room_id in self.room_members:
            self.room_members[room_id].discard(user_id)  # ✅ FIXED: was discarding room_id
            
            # Delete room if empty
            if not self.room_members[room_id]:
                del self.room_members[room_id]
                print(f"🗑️ Room {room_id} deleted (empty)")
        
        print(f"👥 User {user_id} removed from room {room_id}")
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently online"""
        return user_id in self.active_connections
    
    def get_room_members(self, room_id: str) -> List[str]:
        """Get all members in a room (in-memory tracking only)"""
        return list(self.room_members.get(room_id, set()))
    
    def get_online_count(self) -> int:
        """Get total number of online users"""
        return len(self.active_connections)
    
    def get_user_rooms(self, user_id: str) -> List[str]:
        """Get all rooms a user is in"""
        return list(self.user_rooms.get(user_id, set()))


# Global singleton instance
manager = ConnectionManager()
