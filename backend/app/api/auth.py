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

router = APIRouter()
security = HTTPBearer()

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
        # Check if email was previously deleted
        from app.models.deleted_user import DeletedUser
        deleted_user = db.query(DeletedUser).filter(DeletedUser.email == user.email).first()
        if deleted_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This email was previously removed by an administrator and cannot be re-registered"
            )
        
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
        
        # ✅ Generate public key as BYTES (not string)
        import base64
        public_key_string = f"pubkey_{user.username}"
        public_key_bytes = public_key_string.encode('utf-8')  # Convert to bytes
        
        # Create user
        db_user = User(
            email=user.email,
            username=user.username,
            password_hash=password_hash.decode(),
            full_name=user.full_name,
            public_key=public_key_bytes  # ✅ Store as bytes
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
        
        # ✅ Convert public_key bytes to string for JSON response
        public_key_str = base64.b64encode(db_user.public_key).decode('utf-8')
        
        # ✅ Return token and user data
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(db_user.id),
                "email": db_user.email,
                "username": db_user.username,
                "full_name": db_user.full_name,
                "public_key": public_key_str,  # ✅ Return as base64 string
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
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": str(db_user.id),
            "email": db_user.email,
            "username": db_user.username,
            "full_name": db_user.full_name,
            "is_active": db_user.is_active,
            "role": db_user.role
        }
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    import base64
    
    # Convert public_key bytes to base64 string if exists
    public_key_str = None
    if current_user.public_key:
        if isinstance(current_user.public_key, bytes):
            public_key_str = base64.b64encode(current_user.public_key).decode('utf-8')
        else:
            public_key_str = current_user.public_key
    
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