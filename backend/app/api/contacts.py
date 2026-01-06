from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.contact import ContactCreate, ContactResponse
from app.models.contact import Contact
from app.models.user import User
from typing import List
import uuid

router = APIRouter()

@router.post("/add", response_model=ContactResponse)
async def add_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Add a new contact"""
    # Check if contact user exists
    contact_user = db.query(User).filter(User.id == contact.contact_id).first()
    if not contact_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if contact already exists
    existing_contact = db.query(Contact).filter(
        (Contact.user_id == contact.user_id) & (Contact.contact_id == contact.contact_id)
    ).first()
    
    if existing_contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact already exists"
        )
    
    # Create contact
    db_contact = Contact(
        user_id=contact.user_id,
        contact_id=contact.contact_id,
        nickname=contact.nickname
    )
    
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    return ContactResponse(
        id=db_contact.id,
        user_id=db_contact.user_id,
        contact_id=db_contact.contact_id,
        nickname=db_contact.nickname,
        created_at=db_contact.created_at
    )

@router.get("/", response_model=List[ContactResponse])
async def get_contacts(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all contacts for a user based on their role"""
    
    # Get the requesting user
    requesting_user = db.query(User).filter(User.id == user_id).first()
    if not requesting_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # For group creation, we need to return all users except the requesting user
    # Admin can see all users
    # Regular users can see all users for group creation
    
    # Get all users except the requesting user
    all_users = db.query(User).filter(User.id != user_id).all()
    
    # Get existing contacts for this user
    existing_contacts = db.query(Contact).filter(Contact.user_id == user_id).all()
    contact_ids = {contact.contact_id for contact in existing_contacts}
    
    # Build response with all users, marking which are already contacts
    results = []
    for user in all_users:
        # Check if this user is already a contact
        existing_contact = next(
            (c for c in existing_contacts if c.contact_id == user.id),
            None
        )
        
        results.append(ContactResponse(
            id=existing_contact.id if existing_contact else user.id,
            user_id=user_id,
            contact_id=user.id,
            nickname=existing_contact.nickname if existing_contact else None,
            created_at=existing_contact.created_at if existing_contact else user.created_at,
            contact_email=user.email,
            contact_username=user.username,
            contact_full_name=user.full_name,
            contact_public_key=user.public_key,
            contact_last_seen=user.last_seen
        ))
    
    return results

@router.delete("/{contact_id}")
async def remove_contact(contact_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove a contact"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    db.delete(contact)
    db.commit()
    
    return {"status": "Contact removed"}