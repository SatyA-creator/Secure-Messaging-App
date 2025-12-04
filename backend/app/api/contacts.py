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
        display_name=contact.display_name
    )
    
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    return ContactResponse(
        id=db_contact.id,
        user_id=db_contact.user_id,
        contact_id=db_contact.contact_id,
        display_name=db_contact.display_name,
        created_at=db_contact.created_at
    )

@router.get("/", response_model=List[ContactResponse])
async def get_contacts(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all contacts for a user"""
    contacts = db.query(Contact).filter(Contact.user_id == user_id).all()
    
    return [
        ContactResponse(
            id=contact.id,
            user_id=contact.user_id,
            contact_id=contact.contact_id,
            display_name=contact.display_name,
            created_at=contact.created_at
        )
        for contact in contacts
    ]

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