# app/routes/groups.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.api.auth import get_current_user
from app.services.group_service import GroupService
from app.models.user import User
from app.websocket_manager import manager

router = APIRouter()

@router.get("/")
async def get_user_groups(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all groups the current user is a member of"""
    print(f"\n{'='*60}")
    print(f"📋 GET /groups - Fetching groups for user: {current_user.id}")
    print(f"   User email: {current_user.email}")
    print(f"   User username: {current_user.username}")
    
    groups = GroupService.get_user_groups(db, user_id=current_user.id)
    
    print(f"✅ Query completed - Found {len(groups)} groups")
    if groups:
        for idx, group in enumerate(groups, 1):
            print(f"   {idx}. {group['name']} (ID: {group['id']}, Members: {group.get('memberCount', '?')})")
    else:
        print(f"   ⚠️ No groups found - user might not be a member of any groups")
        
        # Debug: Check if user has any group memberships
        from app.models.group import GroupMember
        memberships = db.query(GroupMember).filter(GroupMember.user_id == current_user.id).all()
        print(f"   🔍 Direct membership check: {len(memberships)} memberships found")
        for m in memberships:
            print(f"      - Group ID: {m.group_id}, Role: {m.role}")
    
    print(f"{'='*60}\n")
    return groups

@router.post("/create")
async def create_group(
    name: str,
    description: str = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new group (only creator becomes admin)"""
    print(f"🎨 Creating group '{name}' for user {current_user.id}")
    
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
        "admin_id": str(group.admin_id)
    })
    
    print(f"✅ WebSocket notification sent")
    
    return {
        "group_id": str(group.id),
        "name": group.name,
        "description": group.description,
        "admin_id": str(group.admin_id),
        "created_at": group.created_at
    }

@router.post("/add-member/{group_id}")
async def add_member_to_group(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add user to group (Admin only)"""
    member = GroupService.add_member_to_group(
        db,
        group_id=group_id,
        user_id=user_id,
        added_by=current_user.id
    )
    
    # Get group details for notification
    from app.models.group import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    
    # Notify the added user via WebSocket that they've been added to a group
    await manager.send_personal_message(str(user_id), {
        "type": "added_to_group",
        "group_id": str(group_id),
        "group_name": group.name if group else "Group",
        "added_by": str(current_user.id),
        "role": member.role
    })
    
    # Also notify the admin who added the member
    await manager.send_personal_message(str(current_user.id), {
        "type": "group_updated",
        "group_id": str(group_id),
        "action": "member_added",
        "user_id": str(user_id)
    })
    
    return {
        "message": "User added to group successfully",
        "member_id": str(member.id),
        "user_id": str(member.user_id),
        "role": member.role
    }

@router.delete("/remove-member/{group_id}/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove member from group (Admin only)"""
    GroupService.remove_member_from_group(
        db,
        group_id=group_id,
        user_id=user_id,
        requester_id=current_user.id
    )
    
    return {"message": "Member removed successfully"}

@router.get("/{group_id}/members")
async def get_group_members(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a group with user details"""
    members = GroupService.get_group_members_with_details(db, group_id=group_id)
    
    return members

@router.get("/{group_id}")
async def get_group_details(
    group_id: UUID,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get group details"""
    from app.models.group import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "admin_id": str(group.admin_id),
        "created_at": group.created_at
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
    messages = GroupService.get_group_messages(
        db,
        group_id=group_id,
        limit=limit,
        offset=offset
    )
    
    return {
        "group_id": str(group_id),
        "messages": [
            {
                "message_id": str(m.id),
                "sender_id": str(m.sender_id),
                "encrypted_content": m.encrypted_content.hex(),
                "encrypted_session_key": m.encrypted_session_key.hex(),
                "created_at": m.created_at
            } for m in messages
        ]
    }
