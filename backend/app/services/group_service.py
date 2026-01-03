# app/services/group_service.py
from sqlalchemy.orm import Session
from uuid import UUID
from fastapi import HTTPException, status
from datetime import datetime

from app.models.group import Group, GroupMember, GroupMessage, GroupReadReceipt
from app.models.user import User

class GroupService:
    
    @staticmethod
    def create_group(
        db: Session,
        admin_id: UUID,
        name: str,
        description: str = None,
        avatar_url: str = None
    ) -> Group:
        """Create new group (Admin only)"""
        new_group = Group(
            name=name,
            description=description,
            admin_id=admin_id,
            avatar_url=avatar_url
        )
        
        db.add(new_group)
        db.commit()
        db.refresh(new_group)
        
        # Add admin as member
        admin_member = GroupMember(
            group_id=new_group.id,
            user_id=admin_id,
            role="admin",
            added_by=admin_id
        )
        db.add(admin_member)
        db.commit()
        
        return new_group
    
    @staticmethod
    def add_member_to_group(
        db: Session,
        group_id: UUID,
        user_id: UUID,
        added_by: UUID
    ) -> GroupMember:
        """Add user to group (Admin can add any user, whether they exist or not)"""
        # Verify group exists
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Verify requester is admin
        admin_check = db.query(GroupMember).filter(
            (GroupMember.group_id == group_id) &
            (GroupMember.user_id == added_by) &
            (GroupMember.role == "admin")
        ).first()
        
        if not admin_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can add members"
            )
        
        # Check if user already in group
        existing_member = db.query(GroupMember).filter(
            (GroupMember.group_id == group_id) &
            (GroupMember.user_id == user_id)
        ).first()
        
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already in group"
            )
        
        # Check if user exists (but allow adding even if not)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Create a placeholder user or allow the invite
            # Option 1: Allow adding non-existent users (pending invite)
            pass
        
        # Add member
        new_member = GroupMember(
            group_id=group_id,
            user_id=user_id,
            role="member",
            added_by=added_by
        )
        
        db.add(new_member)
        db.commit()
        db.refresh(new_member)
        
        return new_member
    
    @staticmethod
    def remove_member_from_group(
        db: Session,
        group_id: UUID,
        user_id: UUID,
        requester_id: UUID
    ):
        """Remove member from group (Admin only)"""
        # Verify requester is admin
        admin_check = db.query(GroupMember).filter(
            (GroupMember.group_id == group_id) &
            (GroupMember.user_id == requester_id) &
            (GroupMember.role == "admin")
        ).first()
        
        if not admin_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can remove members"
            )
        
        # Remove member
        member = db.query(GroupMember).filter(
            (GroupMember.group_id == group_id) &
            (GroupMember.user_id == user_id)
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not in group"
            )
        
        db.delete(member)
        db.commit()
    
    @staticmethod
    def get_group_members(
        db: Session,
        group_id: UUID
    ) -> list:
        """Get all members of a group"""
        members = db.query(GroupMember).filter(
            GroupMember.group_id == group_id
        ).all()
        
        return members
    
    @staticmethod    def get_group_members_with_details(
        db: Session,
        group_id: UUID
    ) -> list:
        \"\"\"Get all members of a group with user details\"\"\"
        members = db.query(GroupMember, User).join(
            User, GroupMember.user_id == User.id
        ).filter(
            GroupMember.group_id == group_id
        ).all()
        
        return [
            {
                \"id\": str(member.User.id),
                \"user_id\": str(member.User.id),
                \"username\": member.User.username,
                \"email\": member.User.email,
                \"full_name\": member.User.full_name,
                \"public_key\": member.User.public_key,
                \"avatar_url\": member.User.avatar_url,
                \"role\": member.GroupMember.role,
                \"joined_at\": member.GroupMember.joined_at
            } for member in members
        ]
    
    @staticmethod
    def get_user_groups(
        db: Session,
        user_id: UUID
    ) -> list:
        \"\"\"Get all groups a user is a member of\"\"\"
        groups = db.query(Group, GroupMember).join(
            GroupMember, Group.id == GroupMember.group_id
        ).filter(
            GroupMember.user_id == user_id
        ).all()
        
        return [
            {
                \"id\": str(group.Group.id),
                \"name\": group.Group.name,
                \"description\": group.Group.description,
                \"avatar_url\": group.Group.avatar_url,
                \"admin_id\": str(group.Group.admin_id),
                \"is_encrypted\": group.Group.is_encrypted,
                \"role\": group.GroupMember.role,
                \"created_at\": group.Group.created_at
            } for group in groups
        ]
    
    @staticmethod    def send_group_message(
        db: Session,
        group_id: UUID,
        sender_id: UUID,
        encrypted_content: bytes,
        encrypted_session_key: bytes
    ) -> GroupMessage:
        """Send encrypted message to group"""
        # Verify sender is member
        member = db.query(GroupMember).filter(
            (GroupMember.group_id == group_id) &
            (GroupMember.user_id == sender_id)
        ).first()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not in group"
            )
        
        new_message = GroupMessage(
            group_id=group_id,
            sender_id=sender_id,
            encrypted_content=encrypted_content,
            encrypted_session_key=encrypted_session_key
        )
        
        db.add(new_message)
        db.commit()
        db.refresh(new_message)
        
        return new_message
    
    @staticmethod
    def get_group_messages(
        db: Session,
        group_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> list:
        """Get group message history"""
        messages = db.query(GroupMessage).filter(
            GroupMessage.group_id == group_id
        ).order_by(GroupMessage.created_at.desc()).limit(limit).offset(offset).all()
        
        return messages
