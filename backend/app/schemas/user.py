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
    full_name: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True
    avatar_url: Optional[str]
    bio: Optional[str]
    is_verified: bool
    public_key: str
    created_at: datetime

    class Config:
        from_attributes = True