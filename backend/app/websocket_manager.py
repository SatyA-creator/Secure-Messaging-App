# app/websocket_manager.py
from typing import List, Dict, Set, Optional
from fastapi import WebSocket
import json
import redis
from app.config import settings
from app.services.relay_service import relay_service


class ConnectionManager:
    """
    Manages WebSocket connections and real-time message routing.
    Supports multiple simultaneous connections per user (multi-device).
    Integrated with relay service for offline message queuing.
    """

    def __init__(self):
        # ✅ FIX: support multiple WebSocket connections per user (multi-device)
        self.active_connections: Dict[str, List[WebSocket]] = {}  # user_id -> list of websockets
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
        """
        Register new WebSocket connection for a user.
        Supports multiple connections (multi-device) — all devices receive messages.
        """
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        # Mark user as online in relay service (first connection)
        relay_service.mark_user_online(user_id)

        # Publish user online event to Redis (if available)
        if self.redis_client:
            try:
                self.redis_client.publish(
                    "user_status",
                    json.dumps({"user_id": user_id, "status": "online"})
                )
            except Exception as e:
                print(f"⚠️ Redis publish error: {e}")

        device_count = len(self.active_connections[user_id])
        print(f"✅ User {user_id} connected (device #{device_count}). Total unique users: {len(self.active_connections)}")

        # Deliver pending relay messages to this specific connection
        await self._deliver_pending_messages_to(user_id, websocket)

    def disconnect(self, user_id: str, websocket: WebSocket = None):
        """
        Remove a specific WebSocket connection.
        Only marks user offline when ALL their connections are gone (all devices disconnected).
        """
        if user_id in self.active_connections:
            if websocket is not None:
                try:
                    self.active_connections[user_id].remove(websocket)
                except ValueError:
                    pass  # Already removed
            else:
                # Remove all connections for this user (fallback)
                self.active_connections[user_id] = []

            # Clean up empty list
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Only mark offline if no connections remain for this user
        if user_id not in self.active_connections:
            relay_service.mark_user_offline(user_id)

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

            print(f"❌ User {user_id} fully disconnected (all devices). Total unique users: {len(self.active_connections)}")
        else:
            remaining = len(self.active_connections[user_id])
            print(f"📱 User {user_id} disconnected one device ({remaining} device(s) still connected)")

    async def send_personal_message(self, user_id: str, message: dict) -> bool:
        """
        Send message to a specific user across ALL their active connections (all devices).
        Returns True if delivered to at least one device.
        """
        if user_id not in self.active_connections:
            print(f"⏸️ User {user_id} is offline, caller should queue for relay")
            return False

        connections = list(self.active_connections.get(user_id, []))
        delivered = False
        dead_connections = []

        for ws in connections:
            try:
                await ws.send_json(message)
                delivered = True
            except Exception as e:
                print(f"❌ Dead connection for user {user_id}: {e}")
                dead_connections.append(ws)

        # Prune dead connections
        for ws in dead_connections:
            self.disconnect(user_id, ws)

        if delivered:
            print(f"✅ Message sent to {user_id} on {len(connections) - len(dead_connections)} device(s)")
        return delivered

    async def _deliver_pending_messages(self, user_id: str):
        """Deliver all pending relay messages to all devices of this user."""
        pending_messages = relay_service.get_pending_messages(user_id)
        if pending_messages:
            print(f"📬 Delivering {len(pending_messages)} pending messages to {user_id}")
            for relay_msg in pending_messages:
                message_payload = {
                    "type": "relay_message",
                    "data": relay_msg.to_dict()
                }
                await self.send_personal_message(user_id, message_payload)
        else:
            print(f"📭 No pending messages for {user_id}")

    async def _deliver_pending_messages_to(self, user_id: str, websocket: WebSocket):
        """Deliver pending relay messages to a SPECIFIC new connection (avoid re-sending to existing devices)."""
        pending_messages = relay_service.get_pending_messages(user_id)
        if pending_messages:
            print(f"📬 Delivering {len(pending_messages)} pending messages to new device of {user_id}")
            for relay_msg in pending_messages:
                try:
                    await websocket.send_json({
                        "type": "relay_message",
                        "data": relay_msg.to_dict()
                    })
                except Exception as e:
                    print(f"❌ Failed to deliver pending message to new device: {e}")
        else:
            print(f"📭 No pending messages for {user_id}")

    async def broadcast(self, message: dict, exclude_user: Optional[str] = None):
        """Broadcast message to all connected users (all devices)."""
        sent_count = 0
        for user_id, connections in list(self.active_connections.items()):
            if exclude_user and user_id == exclude_user:
                continue
            for ws in list(connections):
                try:
                    await ws.send_json(message)
                    sent_count += 1
                except Exception as e:
                    print(f"❌ Error broadcasting to {user_id}: {e}")
                    self.disconnect(user_id, ws)

        print(f"📡 Broadcast sent to {sent_count} device connection(s)")

    async def broadcast_to_group(self, group_id: str, message: dict):
        """
        Send message to all members in a group INCLUDING the admin.
        Each member receives on ALL their connected devices.
        """
        from app.database import SessionLocal
        from app.models.group import GroupMember, Group
        from uuid import UUID

        db = SessionLocal()
        try:
            try:
                group_uuid = UUID(group_id) if isinstance(group_id, str) else group_id
            except ValueError:
                print(f"❌ Invalid group_id format: {group_id}")
                return

            group = db.query(Group).filter(Group.id == group_uuid).first()
            if not group:
                print(f"❌ Group {group_id} not found")
                return

            members = db.query(GroupMember).filter(
                GroupMember.group_id == group_uuid
            ).all()

            recipient_ids = set()
            for member in members:
                recipient_ids.add(str(member.user_id))
            recipient_ids.add(str(group.admin_id))

            print(f"📤 Broadcasting to group {group_id}: {len(recipient_ids)} users (all devices)")

            sent_count = 0
            offline_count = 0

            for recipient_id in recipient_ids:
                if recipient_id in self.active_connections:
                    await self.send_personal_message(recipient_id, message)
                    sent_count += 1
                else:
                    offline_count += 1

            print(f"✅ Group broadcast complete: {sent_count} online users, {offline_count} offline")

        except Exception as e:
            print(f"❌ Error broadcasting to group {group_id}: {e}")
        finally:
            db.close()

    async def send_to_group(self, group_id: str, message: dict):
        """Alias for broadcast_to_group for backward compatibility."""
        await self.broadcast_to_group(group_id, message)

    def add_user_to_room(self, user_id: str, room_id: str):
        """Add user to room (group) - for tracking purposes."""
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)

        if room_id not in self.room_members:
            self.room_members[room_id] = set()
        self.room_members[room_id].add(user_id)

        print(f"👥 User {user_id} added to room {room_id}")

    def remove_user_from_room(self, user_id: str, room_id: str):
        """Remove user from room."""
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
            if not self.user_rooms[user_id]:
                del self.user_rooms[user_id]

        if room_id in self.room_members:
            self.room_members[room_id].discard(user_id)
            if not self.room_members[room_id]:
                del self.room_members[room_id]
                print(f"🗑️ Room {room_id} deleted (empty)")

        print(f"👥 User {user_id} removed from room {room_id}")

    def is_user_online(self, user_id: str) -> bool:
        """Check if user has at least one active connection."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_room_members(self, room_id: str) -> List[str]:
        """Get all members in a room."""
        return list(self.room_members.get(room_id, set()))

    def get_online_count(self) -> int:
        """Get number of unique online users."""
        return len(self.active_connections)

    def get_user_rooms(self, user_id: str) -> List[str]:
        """Get all rooms a user is in."""
        return list(self.user_rooms.get(user_id, set()))


# Global singleton instance
manager = ConnectionManager()
