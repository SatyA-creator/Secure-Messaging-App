from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.models.user import User
import bcrypt
import jwt
from datetime import datetime, timedelta
from app.config import settings
import base64
import uuid

router = APIRouter()
security = HTTPBearer()

def create_public_key_entry(username: str, public_key_data: str = None) -> list:
    """Helper: Create initial public_keys array for new user.
    If public_key_data is provided (base64-encoded JWK from client), use it directly.
    Otherwise generate a placeholder that the client will replace on first login.
    """
    if public_key_data:
        key_data = public_key_data
    else:
        key_data = base64.b64encode(f"pubkey_{username}".encode('utf-8')).decode('utf-8')
    return [{
        "key_id": f"key-{uuid.uuid4()}",
        "algorithm": "SECP256R1",
        "key_data": key_data,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active"
    }]

def get_active_public_key(public_keys: list) -> str:
    """Helper: Get active public key from public_keys array"""
    if not public_keys:
        return None
    # Return first active key's data (base64 encoded)
    for key in public_keys:
        if key.get("status") == "active":
            return key.get("key_data")
    # Fallback to first key if no active key found
    return public_keys[0].get("key_data") if public_keys else None

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user_id"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def get_current_user(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Get current user from database"""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

@router.post("/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user and return access token"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.email == user.email) | (User.username == user.username)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email or username already exists"
            )
        
        # Hash password
        password_hash = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())
        
        # Create public_keys array - use client-provided key if available
        public_keys = create_public_key_entry(user.username, user.public_key)
        
        # Create user
        db_user = User(
            email=user.email,
            username=user.username,
            password_hash=password_hash.decode(),
            full_name=user.full_name,
            public_keys=public_keys
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # ✅ Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(db_user.id)}, 
            expires_delta=access_token_expires
        )
        
        # Get active public key from public_keys array
        public_key_str = get_active_public_key(db_user.public_keys)
        
        # Return token and user data
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(db_user.id),
                "email": db_user.email,
                "username": db_user.username,
                "full_name": db_user.full_name,
                "public_key": public_key_str,
                "is_active": db_user.is_active,
                "avatar_url": db_user.avatar_url,
                "role": db_user.role,
                "created_at": db_user.created_at.isoformat() if db_user.created_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token"""
    # Find user
    db_user = db.query(User).filter(User.email == user.email).first()
    
    if not db_user or not bcrypt.checkpw(user.password.encode(), db_user.password_hash.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    
    # Get active public key from public_keys array
    public_key_str = get_active_public_key(db_user.public_keys) if db_user.public_keys else None

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user.id),
            "email": db_user.email,
            "username": db_user.username,
            "full_name": db_user.full_name,
            "public_key": public_key_str,
            "is_active": db_user.is_active,
            "role": db_user.role
        }
    }


@router.put("/public-key")
async def update_public_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: dict = None
):
    """Update the current user's public key (called by frontend after key generation)"""
    from fastapi import Body

    # Accept public_key from request body
    if not body or "public_key" not in body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="public_key is required"
        )

    new_public_key = body["public_key"]

    # Create new public_keys entry with the client-provided key
    new_keys = [{
        "key_id": f"key-{uuid.uuid4()}",
        "algorithm": "SECP256R1",
        "key_data": new_public_key,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active"
    }]

    # Deactivate old keys and append new one
    existing_keys = current_user.public_keys or []
    for key in existing_keys:
        key["status"] = "inactive"

    current_user.public_keys = existing_keys + new_keys
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "public_key": new_public_key
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    # Get active public key from public_keys array
    public_key_str = get_active_public_key(current_user.public_keys) if current_user.public_keys else None
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        public_key=public_key_str,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        is_verified=current_user.is_verified,
        role=current_user.role,  # ✅ Added role field
        created_at=current_user.created_at
    )

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt