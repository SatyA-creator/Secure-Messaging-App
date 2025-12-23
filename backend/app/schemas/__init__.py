from app.schemas.user import (
    UserCreate, 
    UserRegister,  # ✅ Added
    UserLogin, 
    UserResponse,
    Token,  # ✅ Added
    TokenData  # ✅ Added
)
from app.schemas.message import MessageCreate, MessageResponse
from app.schemas.contact import ContactCreate, ContactResponse


__all__ = [
    "UserCreate",
    "UserRegister",  # ✅ Added
    "UserLogin", 
    "UserResponse",
    "Token",  # ✅ Added
    "TokenData",  # ✅ Added
    "MessageCreate",
    "MessageResponse",
    "ContactCreate",
    "ContactResponse"
]
