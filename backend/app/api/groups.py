# app/api/groups.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID
from datetime import datetime

from app.database import get_db
from .auth import get_current_user
from app.services.group_service import GroupService
from app.models.user import User
from app.models.group import Group, GroupMember
from app.websocket_manager import manager

router = APIRouter()


@router.get("/")
async def get_user_groups(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all groups the current user is a member of
    FIXED: Now returns groups where user is ADMIN or MEMBER
    """
    print(f"\n{'='*60}")
    print(f"📋 GET /groups - Fetching groups for user: {current_user.id}")
    print(f"   User email: {current_user.email}")
    print(f"   User username: {current_user.username}")
    
    try:
        # 🔥 CRITICAL FIX: Query groups where user is admin OR member
        groups = db.query(Group).outerjoin(GroupMember).filter(
            or_(
                Group.admin_id == current_user.id,      # Groups they created
                GroupMember.user_id == current_user.id  # Groups they're in
            )
        ).distinct().all()
        
        print(f"✅ Query completed - Found {len(groups)} groups (admin + member)")
        
        # Build response with member counts
        groups_with_counts = []
        for group in groups:
            member_count = db.query(GroupMember).filter(
                GroupMember.group_id == group.id
            ).count()
            
            group_data = {
                "id": str(group.id),
                "name": group.name,
                "description": group.description,
                "admin_id": str(group.admin_id),
                "memberCount": member_count + 1,  # +1 for admin
                "created_at": group.created_at.isoformat(),
                "is_admin": group.admin_id == current_user.id  # Flag if user is admin
            }
            
            groups_with_counts.append(group_data)
            print(f"   {len(groups_with_counts)}. {group.name} "
                  f"(ID: {group.id}, Members: {group_data['memberCount']}, "
                  f"Admin: {'YES' if group_data['is_admin'] else 'NO'})")
        
        if not groups_with_counts:
            print(f"   ⚠️ No groups found - user is not admin or member of any groups")
            
            # Debug: Check if user has any group memberships
            memberships = db.query(GroupMember).filter(
                GroupMember.user_id == current_user.id
            ).all()
            print(f"   🔍 Direct membership check: {len(memberships)} memberships found")
            for m in memberships:
                print(f"      - Group ID: {m.group_id}, Role: {m.role}")
        
        print(f"{'='*60}\n")
        return groups_with_counts
        
    except Exception as e:
        print(f"❌ Error fetching groups: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching groups: {str(e)}"
        )


@router.post("/create")
async def create_group(
    name: str,
    description: str = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new group (only creator becomes admin)"""
    print(f"\n{'='*60}")
    print(f"🎨 Creating group '{name}' for user {current_user.id}")
    
    try:
        group = GroupService.create_group(
            db,
            admin_id=current_user.id,
            name=name,
            description=description
        )
        
        print(f"✅ Group created with ID: {group.id}")
        print(f"📤 Sending WebSocket notification to {current_user.id}")
        
        # Notify the creator via WebSocket
        await manager.send_personal_message(str(current_user.id), {
            "type": "group_created",
            "group_id": str(group.id),
            "name": group.name,
            "description": group.description,
            "admin_id": str(group.admin_id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ WebSocket notification sent")
        print(f"{'='*60}\n")
        
        return {
            "group_id": str(group.id),
            "name": group.name,
            "description": group.description,
            "admin_id": str(group.admin_id),
            "created_at": group.created_at.isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error creating group: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating group: {str(e)}"
        )


@router.post("/add-member/{group_id}")
async def add_member_to_group(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add user to group (Admin only)
    FIXED: Now sends real-time notification to added user
    """
    print(f"\n{'='*60}")
    print(f"👥 Adding user {user_id} to group {group_id}")
    print(f"   Requested by: {current_user.id} ({current_user.username})")
    
    try:
        # Get group details first
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Verify requester is admin
        if group.admin_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can add members"
            )
        
        # Check if already a member
        existing = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already in group"
            )
        
        # Add member
        member = GroupService.add_member_to_group(
            db,
            group_id=group_id,
            user_id=user_id,
            added_by=current_user.id
        )
        
        print(f"✅ User {user_id} added to group {group_id}")
        
        # Get added user details
        added_user = db.query(User).filter(User.id == user_id).first()
        added_username = added_user.username if added_user else "Unknown"
        
        # 🔥 CRITICAL FIX: Notify the added user via WebSocket
        print(f"📤 Sending 'added_to_group' notification to {user_id}")
        await manager.send_personal_message(str(user_id), {
            "type": "added_to_group",
            "group_id": str(group_id),
            "group_name": group.name,
            "added_by": current_user.username,
            "added_by_id": str(current_user.id),
            "role": member.role,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # 🔥 CRITICAL FIX: Broadcast to all group members
        print(f"📤 Broadcasting 'member_added' to all group members")
        await manager.broadcast_to_group(str(group_id), {
            "type": "member_added",
            "group_id": str(group_id),
            "new_member_id": str(user_id),
            "new_member_username": added_username,
            "added_by": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ WebSocket notifications sent")
        print(f"{'='*60}\n")
        
        return {
            "message": "User added to group successfully",
            "member_id": str(member.id),
            "user_id": str(member.user_id),
            "username": added_username,
            "role": member.role,
            "added_at": member.added_at.isoformat() if hasattr(member, 'added_at') else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding member: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding member: {str(e)}"
        )


@router.delete("/remove-member/{group_id}/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove member from group (Admin only)"""
    print(f"\n{'='*60}")
    print(f"🗑️ Removing user {user_id} from group {group_id}")
    print(f"   Requested by: {current_user.id}")
    
    try:
        GroupService.remove_member_from_group(
            db,
            group_id=group_id,
            user_id=user_id,
            requester_id=current_user.id
        )
        
        # Notify removed user
        await manager.send_personal_message(str(user_id), {
            "type": "removed_from_group",
            "group_id": str(group_id),
            "removed_by": str(current_user.id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Notify remaining members
        await manager.broadcast_to_group(str(group_id), {
            "type": "member_removed",
            "group_id": str(group_id),
            "removed_user_id": str(user_id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ Member removed and notifications sent")
        print(f"{'='*60}\n")
        
        return {"message": "Member removed successfully"}
        
    except Exception as e:
        print(f"❌ Error removing member: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing member: {str(e)}"
        )


@router.get("/{group_id}/members")
async def get_group_members(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a group with user details"""
    print(f"📋 Fetching members for group {group_id}")
    
    try:
        members = GroupService.get_group_members_with_details(db, group_id=group_id)
        
        print(f"✅ Found {len(members)} members")
        return members
        
    except Exception as e:
        print(f"❌ Error fetching members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching members: {str(e)}"
        )


@router.get("/{group_id}")
async def get_group_details(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group details"""
    print(f"📋 Fetching details for group {group_id}")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is member or admin
    is_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first() is not None
    
    is_admin = group.admin_id == current_user.id
    
    if not (is_member or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "admin_id": str(group.admin_id),
        "is_admin": is_admin,
        "created_at": group.created_at.isoformat()
    }


@router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group message history"""
    print(f"📨 Fetching messages for group {group_id} (limit={limit}, offset={offset})")
    
    try:
        # Verify user is member or admin
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        is_member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        ).first() is not None
        
        is_admin = group.admin_id == current_user.id
        
        if not (is_member or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group"
            )
        
        messages = GroupService.get_group_messages(
            db,
            group_id=group_id,
            limit=limit,
            offset=offset
        )
        
        print(f"✅ Found {len(messages)} messages")
        
        return {
            "group_id": str(group_id),
            "total": len(messages),
            "messages": [
                {
                    "message_id": str(m.id),
                    "sender_id": str(m.sender_id),
                    "encrypted_content": m.encrypted_content.hex(),
                    "encrypted_session_key": m.encrypted_session_key.hex(),
                    "created_at": m.created_at.isoformat()
                } for m in messages
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching messages: {str(e)}"
        )


@router.delete("/{group_id}")
async def delete_group(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a group (Admin only)"""
    print(f"\n{'='*60}")
    print(f"🗑️ DELETE /groups/{group_id} - Deleting group")
    print(f"   Requested by: {current_user.id}")
    
    try:
        # Get group details before deletion for notification
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Get all members before deletion for notifications
        members = db.query(GroupMember).filter(
            GroupMember.group_id == group_id
        ).all()
        
        member_ids = [str(member.user_id) for member in members]
        # Include admin in notification list
        if str(group.admin_id) not in member_ids:
            member_ids.append(str(group.admin_id))
        
        # Delete the group (this will cascade delete members and messages)
        GroupService.delete_group(db, group_id=group_id, user_id=current_user.id)
        
        # Notify all members that group was deleted
        for member_id in member_ids:
            await manager.send_personal_message(member_id, {
                "type": "group_deleted",
                "group_id": str(group_id),
                "group_name": group.name,
                "deleted_by": str(current_user.id),
                "timestamp": datetime.utcnow().isoformat()
            })
        
        print(f"✅ Group deleted and {len(member_ids)} members notified")
        print(f"{'='*60}\n")
        
        return {"message": "Group deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting group: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting group: {str(e)}"
        )
# app/api/groups.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID
from datetime import datetime

from app.database import get_db
from .auth import get_current_user
from app.services.group_service import GroupService
from app.models.user import User
from app.models.group import Group, GroupMember
from app.websocket_manager import manager

router = APIRouter()


@router.get("/")
async def get_user_groups(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all groups the current user is a member of
    FIXED: Now returns groups where user is ADMIN or MEMBER
    """
    print(f"\n{'='*60}")
    print(f"📋 GET /groups - Fetching groups for user: {current_user.id}")
    print(f"   User email: {current_user.email}")
    print(f"   User username: {current_user.username}")
    
    try:
        # 🔥 CRITICAL FIX: Query groups where user is admin OR member
        groups = db.query(Group).outerjoin(GroupMember).filter(
            or_(
                Group.admin_id == current_user.id,      # Groups they created
                GroupMember.user_id == current_user.id  # Groups they're in
            )
        ).distinct().all()
        
        print(f"✅ Query completed - Found {len(groups)} groups (admin + member)")
        
        # Build response with member counts
        groups_with_counts = []
        for group in groups:
            member_count = db.query(GroupMember).filter(
                GroupMember.group_id == group.id
            ).count()
            
            group_data = {
                "id": str(group.id),
                "name": group.name,
                "description": group.description,
                "admin_id": str(group.admin_id),
                "memberCount": member_count + 1,  # +1 for admin
                "created_at": group.created_at.isoformat(),
                "is_admin": group.admin_id == current_user.id  # Flag if user is admin
            }
            
            groups_with_counts.append(group_data)
            print(f"   {len(groups_with_counts)}. {group.name} "
                  f"(ID: {group.id}, Members: {group_data['memberCount']}, "
                  f"Admin: {'YES' if group_data['is_admin'] else 'NO'})")
        
        if not groups_with_counts:
            print(f"   ⚠️ No groups found - user is not admin or member of any groups")
            
            # Debug: Check if user has any group memberships
            memberships = db.query(GroupMember).filter(
                GroupMember.user_id == current_user.id
            ).all()
            print(f"   🔍 Direct membership check: {len(memberships)} memberships found")
            for m in memberships:
                print(f"      - Group ID: {m.group_id}, Role: {m.role}")
        
        print(f"{'='*60}\n")
        return groups_with_counts
        
    except Exception as e:
        print(f"❌ Error fetching groups: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching groups: {str(e)}"
        )


@router.post("/create")
async def create_group(
    name: str,
    description: str = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new group (only creator becomes admin)"""
    print(f"\n{'='*60}")
    print(f"🎨 Creating group '{name}' for user {current_user.id}")
    
    try:
        group = GroupService.create_group(
            db,
            admin_id=current_user.id,
            name=name,
            description=description
        )
        
        print(f"✅ Group created with ID: {group.id}")
        print(f"📤 Sending WebSocket notification to {current_user.id}")
        
        # Notify the creator via WebSocket
        await manager.send_personal_message(str(current_user.id), {
            "type": "group_created",
            "group_id": str(group.id),
            "name": group.name,
            "description": group.description,
            "admin_id": str(group.admin_id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ WebSocket notification sent")
        print(f"{'='*60}\n")
        
        return {
            "group_id": str(group.id),
            "name": group.name,
            "description": group.description,
            "admin_id": str(group.admin_id),
            "created_at": group.created_at.isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error creating group: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating group: {str(e)}"
        )


@router.post("/add-member/{group_id}")
async def add_member_to_group(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add user to group (Admin only)
    FIXED: Now sends real-time notification to added user
    """
    print(f"\n{'='*60}")
    print(f"👥 Adding user {user_id} to group {group_id}")
    print(f"   Requested by: {current_user.id} ({current_user.username})")
    
    try:
        # Get group details first
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Verify requester is admin
        if group.admin_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can add members"
            )
        
        # Check if already a member
        existing = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already in group"
            )
        
        # Add member
        member = GroupService.add_member_to_group(
            db,
            group_id=group_id,
            user_id=user_id,
            added_by=current_user.id
        )
        
        print(f"✅ User {user_id} added to group {group_id}")
        
        # Get added user details
        added_user = db.query(User).filter(User.id == user_id).first()
        added_username = added_user.username if added_user else "Unknown"
        
        # 🔥 CRITICAL FIX: Notify the added user via WebSocket
        print(f"📤 Sending 'added_to_group' notification to {user_id}")
        await manager.send_personal_message(str(user_id), {
            "type": "added_to_group",
            "group_id": str(group_id),
            "group_name": group.name,
            "added_by": current_user.username,
            "added_by_id": str(current_user.id),
            "role": member.role,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # 🔥 CRITICAL FIX: Broadcast to all group members
        print(f"📤 Broadcasting 'member_added' to all group members")
        await manager.broadcast_to_group(str(group_id), {
            "type": "member_added",
            "group_id": str(group_id),
            "new_member_id": str(user_id),
            "new_member_username": added_username,
            "added_by": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ WebSocket notifications sent")
        print(f"{'='*60}\n")
        
        return {
            "message": "User added to group successfully",
            "member_id": str(member.id),
            "user_id": str(member.user_id),
            "username": added_username,
            "role": member.role,
            "added_at": member.added_at.isoformat() if hasattr(member, 'added_at') else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error adding member: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding member: {str(e)}"
        )


@router.delete("/remove-member/{group_id}/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove member from group (Admin only)"""
    print(f"\n{'='*60}")
    print(f"🗑️ Removing user {user_id} from group {group_id}")
    print(f"   Requested by: {current_user.id}")
    
    try:
        GroupService.remove_member_from_group(
            db,
            group_id=group_id,
            user_id=user_id,
            requester_id=current_user.id
        )
        
        # Notify removed user
        await manager.send_personal_message(str(user_id), {
            "type": "removed_from_group",
            "group_id": str(group_id),
            "removed_by": str(current_user.id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Notify remaining members
        await manager.broadcast_to_group(str(group_id), {
            "type": "member_removed",
            "group_id": str(group_id),
            "removed_user_id": str(user_id),
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ Member removed and notifications sent")
        print(f"{'='*60}\n")
        
        return {"message": "Member removed successfully"}
        
    except Exception as e:
        print(f"❌ Error removing member: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing member: {str(e)}"
        )


@router.get("/{group_id}/members")
async def get_group_members(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a group with user details"""
    print(f"📋 Fetching members for group {group_id}")
    
    try:
        members = GroupService.get_group_members_with_details(db, group_id=group_id)
        
        print(f"✅ Found {len(members)} members")
        return members
        
    except Exception as e:
        print(f"❌ Error fetching members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching members: {str(e)}"
        )


@router.get("/{group_id}")
async def get_group_details(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group details"""
    print(f"📋 Fetching details for group {group_id}")
    
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Check if user is member or admin
    is_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first() is not None
    
    is_admin = group.admin_id == current_user.id
    
    if not (is_member or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "admin_id": str(group.admin_id),
        "is_admin": is_admin,
        "created_at": group.created_at.isoformat()
    }


@router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: UUID,
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group message history"""
    print(f"📨 Fetching messages for group {group_id} (limit={limit}, offset={offset})")
    
    try:
        # Verify user is member or admin
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        is_member = db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        ).first() is not None
        
        is_admin = group.admin_id == current_user.id
        
        if not (is_member or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group"
            )
        
        messages = GroupService.get_group_messages(
            db,
            group_id=group_id,
            limit=limit,
            offset=offset
        )
        
        print(f"✅ Found {len(messages)} messages")
        
        return {
            "group_id": str(group_id),
            "total": len(messages),
            "messages": [
                {
                    "message_id": str(m.id),
                    "sender_id": str(m.sender_id),
                    "encrypted_content": m.encrypted_content.hex(),
                    "encrypted_session_key": m.encrypted_session_key.hex(),
                    "created_at": m.created_at.isoformat()
                } for m in messages
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching messages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching messages: {str(e)}"
        )
