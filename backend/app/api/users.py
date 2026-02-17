from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserResponse
from app.models.user import User
from app.api.auth import get_active_public_key
from typing import List
import uuid

router = APIRouter()

@router.get("/{user_id}")
async def get_user_by_id(
    user_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Get user by ID with their public key (for encryption)"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get active public key
    public_key = get_active_public_key(user.public_keys) if user.public_keys else None
    
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "public_key": public_key,
        "is_active": user.is_active,
        "last_seen": user.last_seen
    }

@router.get("/search", response_model=List[UserResponse])
async def search_users(
    email: str = Query(..., description="Email to search for"),
    db: Session = Depends(get_db)
):
    """Search for users by email"""
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email parameter is required"
        )
    
    # Search for users with similar email
    users = db.query(User).filter(
        User.email.ilike(f"%{email}%")
    ).limit(10).all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active
        )
        for user in users
    ]

@router.get("/by-email", response_model=UserResponse)
async def get_user_by_email(
    email: str = Query(..., description="Exact email to find"),
    db: Session = Depends(get_db)
):
    """Get user by exact email"""
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active
    )