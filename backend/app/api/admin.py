from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models.user import User
from app.models.contact import Contact
from app.models.message import Message
from app.models.invitation import Invitation
from app.models.deleted_user import DeletedUser
from app.models.group import Group, GroupMember, GroupMessage, GroupReadReceipt
from typing import List
from pydantic import BaseModel
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class UserListResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    role: str
    is_contact: bool
    created_at: str

class AddContactRequest(BaseModel):
    admin_id: uuid.UUID
    user_id: uuid.UUID

@router.get("/all-users/{admin_id}", response_model=List[UserListResponse])
async def get_all_users(admin_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all registered users with contact status (admin only)"""
    
    # Verify requester is admin
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or admin.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all users"
        )
    
    # Get all users except the admin
    all_users = db.query(User).filter(User.id != admin_id).all()
    
    # Get admin's contacts
    admin_contacts = db.query(Contact).filter(Contact.user_id == admin_id).all()
    contact_ids = {str(contact.contact_id) for contact in admin_contacts}
    
    # Build response
    users_list = []
    for user in all_users:
        users_list.append(UserListResponse(
            id=str(user.id),
            email=user.email,
            username=user.username,
            full_name=user.full_name or "",
            role=user.role,
            is_contact=str(user.id) in contact_ids,
            created_at=user.created_at.isoformat() if user.created_at else ""
        ))
    
    return users_list

@router.post("/add-contact")
async def add_contact_manually(request: AddContactRequest, db: Session = Depends(get_db)):
    """Manually add a user as contact (admin only)"""
    
    # Verify requester is admin
    admin = db.query(User).filter(User.id == request.admin_id).first()
    if not admin or admin.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add contacts"
        )
    
    # Check if contact already exists
    existing = db.query(Contact).filter(
        Contact.user_id == request.admin_id,
        Contact.contact_id == request.user_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact already exists"
        )
    
    # Create bidirectional contacts
    contact1 = Contact(
        user_id=request.admin_id,
        contact_id=request.user_id
    )
    contact2 = Contact(
        user_id=request.user_id,
        contact_id=request.admin_id
    )
    
    db.add(contact1)
    db.add(contact2)
    db.commit()
    
    return {"status": "success", "message": "Contact added successfully"}

@router.delete("/remove-contact/{admin_id}/{user_id}")
async def remove_contact_manually(admin_id: uuid.UUID, user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Manually remove a user from contacts (admin only) - Deletes user account completely"""
    
    try:
        # Verify requester is admin
        admin = db.query(User).filter(User.id == admin_id).first()
        if not admin or admin.role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can remove contacts"
            )
        
        # Get the user to be removed
        removed_user = db.query(User).filter(User.id == user_id).first()
        if not removed_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Store user details for logging
        deleted_email = removed_user.email
        deleted_username = removed_user.username
        
        # Delete group read receipts for this user
        db.query(GroupReadReceipt).filter(GroupReadReceipt.user_id == user_id).delete(synchronize_session=False)
        
        # Delete group messages sent by this user
        db.query(GroupMessage).filter(GroupMessage.sender_id == user_id).delete(synchronize_session=False)
        
        # Delete group memberships
        db.query(GroupMember).filter(GroupMember.user_id == user_id).delete(synchronize_session=False)
        
        # Delete groups where this user is the admin
        db.query(Group).filter(Group.admin_id == user_id).delete(synchronize_session=False)
        
        # Delete all messages sent by or to this user
        db.query(Message).filter(
            (Message.sender_id == user_id) | (Message.recipient_id == user_id)
        ).delete(synchronize_session=False)
        
        # Delete all contacts (bidirectional)
        db.query(Contact).filter(
            (Contact.user_id == user_id) | (Contact.contact_id == user_id)
        ).delete(synchronize_session=False)
        
        # Delete all invitations related to this user
        db.query(Invitation).filter(
            (Invitation.inviter_id == user_id) | (Invitation.invitee_email == removed_user.email)
        ).delete(synchronize_session=False)
        
        # Delete the user account itself
        db.delete(removed_user)
        
        db.commit()
        
        logger.info(f"Admin {admin_id} removed user {user_id} ({deleted_email}) from system")
        
        return {"status": "success", "message": "User account and all related data removed successfully", "deleted_email": deleted_email}
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log and handle unexpected errors
        logger.error(f"Error removing user {user_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

@router.post("/fix-media-table/{admin_id}")
async def fix_media_table(admin_id: uuid.UUID, db: Session = Depends(get_db)):
    """Fix media_attachments table to allow nullable message_id (admin only)"""
    
    # Verify requester is admin
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or admin.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can run migrations"
        )
    
    try:
        # Make message_id nullable
        db.execute(text(
            "ALTER TABLE media_attachments ALTER COLUMN message_id DROP NOT NULL;"
        ))
        db.commit()
        
        logger.info(f"Admin {admin_id} ran media_attachments migration successfully")
        return {"status": "success", "message": "Media table fixed - message_id is now nullable"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to fix media table: {str(e)}")
        return {"status": "error", "message": f"Migration already applied or error: {str(e)}"}

