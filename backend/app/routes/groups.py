# app/routes/groups.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.group_service import GroupService
from app.models.user import User

router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.post("/create")
async def create_group(
    name: str,
    description: str = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new group (only creator becomes admin)"""
    group = GroupService.create_group(
        db,
        admin_id=current_user.id,
        name=name,
        description=description
    )
    
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
    """Get all members of a group"""
    members = GroupService.get_group_members(db, group_id=group_id)
    
    return {
        "group_id": str(group_id),
        "members": [
            {
                "user_id": str(m.user_id),
                "role": m.role,
                "joined_at": m.joined_at
            } for m in members
        ]
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
