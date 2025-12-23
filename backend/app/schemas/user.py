from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    """Schema for user creation"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    public_key: Optional[str] = None
    role: Optional[str] = "user"


# ✅ Add UserRegister (alias for UserCreate for compatibility)
class UserRegister(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    public_key: Optional[str] = None
    role: Optional[str] = "user"


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response (without password)"""
    id: UUID
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_verified: bool = False
    created_at: Optional[datetime] = None
    public_key: Optional[str] = None
    role: Optional[str] = "user"  # ✅ Added role field

    class Config:
        from_attributes = True


# ✅ Add Token schemas for authentication
class Token(BaseModel):
    """Schema for authentication token"""
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    """Schema for token payload data"""
    email: Optional[str] = None
    sub: Optional[str] = None
