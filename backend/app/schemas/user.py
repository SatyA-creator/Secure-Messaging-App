from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: Optional[str] = None
    role: Optional[str] = 'user'
    is_active: bool
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_verified: bool = False
    created_at: Optional[datetime] = None
    public_key: Optional[str] = None

    class Config:
        from_attributes = True