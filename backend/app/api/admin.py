from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.contact import Contact
from typing import List
from pydantic import BaseModel
import uuid

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
    """Manually remove a user from contacts (admin only)"""
    
    # Verify requester is admin
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or admin.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove contacts"
        )
    
    # Remove bidirectional contacts
    db.query(Contact).filter(
        ((Contact.user_id == admin_id) & (Contact.contact_id == user_id)) |
        ((Contact.user_id == user_id) & (Contact.contact_id == admin_id))
    ).delete()
    
    db.commit()
    
    return {"status": "success", "message": "Contact removed successfully"}
