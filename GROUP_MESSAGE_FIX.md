# Group Messaging Real-Time Fix

## Problem
Group messages were not being received by other members in real-time. Messages were being sent but not delivered to recipients.

## Root Cause
The WebSocket handler in [ws.py](backend/app/routes/ws.py) was only checking if the sender was in the `GroupMember` table. However, **the group admin/creator may not be in this table** since they are identified by the `admin_id` field in the `Group` table.

This caused admin messages to be blocked with the error:
```
❌ User {user_id} not a member of group {group_id}
```

## Solution
Modified the WebSocket group message handler to check **both**:
1. Is the user the group **admin**? (by comparing `Group.admin_id`)
2. Is the user a **member**? (by checking `GroupMember` table)

## Files Changed

### 1. [backend/app/routes/ws.py](backend/app/routes/ws.py)
**Before:**
```python
# Verify sender is member of the group
member = db.query(GroupMember).filter(
    (GroupMember.group_id == UUID(group_id)) &
    (GroupMember.user_id == UUID(user_id))
).first()

if not member:
    print(f"❌ User {user_id} not a member of group {group_id}")
    continue
```

**After:**
```python
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
```

### 2. [backend/app/services/group_service.py](backend/app/services/group_service.py)
**Before (had bug):**
```python
# Delete all group read receipts
db.query(GroupReadReceipt).filter(
    GroupReadReceipt.group_id == group_id  # ❌ This field doesn't exist!
).delete()
```

**After:**
```python
# Delete all group messages (this will cascade delete read receipts due to ondelete="CASCADE")
db.query(GroupMessage).filter(
    GroupMessage.group_id == group_id
).delete()
```

## How It Works Now

1. **User sends group message** via WebSocket
2. **Backend validates** sender is either:
   - Group admin (from `Group.admin_id`), OR
   - Group member (from `GroupMember` table)
3. **Message saved** to `GroupMessage` table in database
4. **Real-time broadcast** to all online members via `broadcast_to_group()`
5. **Message persisted** in database so offline members can see it when they log in

## Testing

1. **Login as admin** user
2. **Create a group** or select existing group
3. **Send a message** in the group chat
4. **Verify**:
   - ✅ Message appears in sender's chat
   - ✅ Message received by all online members in real-time
   - ✅ Message persisted in database (visible after page refresh)
   - ✅ Console shows: `✅ User authorized - Admin: true, Member: false`

5. **Login as member** user
6. **Send a message** in the same group
7. **Verify**:
   - ✅ Message appears in sender's chat
   - ✅ Message received by admin and other members
   - ✅ Console shows: `✅ User authorized - Admin: false, Member: true`

## Database Schema

```
Group
├── id (UUID)
├── name (String)
├── admin_id (UUID) ← Admin is identified here
└── ...

GroupMember
├── id (UUID)
├── group_id (UUID → Group.id)
├── user_id (UUID → User.id) ← Regular members are here
└── role (String)

GroupMessage
├── id (UUID)
├── group_id (UUID → Group.id, CASCADE delete)
├── sender_id (UUID → User.id) ← Can be admin or member
├── encrypted_content (Bytes)
└── created_at (DateTime)

GroupReadReceipt
├── id (UUID)
├── message_id (UUID → GroupMessage.id, CASCADE delete) ← No group_id!
├── user_id (UUID → User.id)
└── read_at (DateTime)
```

## Related Fixes

This fix is related to the previous group visibility fix in [websocket_manager.py](backend/app/websocket_manager.py):
- `broadcast_to_group()` already includes admin in recipient list
- Now the WebSocket handler allows admin to send messages too

## Benefits

✅ **Admin can send messages** to groups they created  
✅ **Members can send messages** as before  
✅ **Messages preserved** in database for history  
✅ **Real-time delivery** to all online users  
✅ **Proper authorization** checks prevent unauthorized access  
✅ **DELETE group** now works correctly without `GroupReadReceipt.group_id` error

---
**Date Fixed:** January 12, 2026  
**Status:** ✅ Resolved and tested
