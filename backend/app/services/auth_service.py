@staticmethod
def register_user(db: Session, user_data: UserRegister, invitation_token: str = None) -> User:
    """Register new user, optionally from invitation"""
    
    # Check if user exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )
    
    # Generate key pair
    private_key, public_key = AuthService.generate_key_pair()
    
    # Determine user role based on invitation
    user_role = 'user'  # Default role
    if invitation_token:
        # User registered via invitation is a regular user
        user_role = 'user'
    else:
        # First user or self-registered becomes admin
        user_count = db.query(User).count()
        user_role = 'admin' if user_count == 0 else 'user'
    
    # Create user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=AuthService.hash_password(user_data.password),
        public_key=public_key,
        full_name=user_data.full_name,
        role=user_role
    )
    
    db.add(new_user)
    db.flush()  # Flush to get the user ID
    
    # Accept invitation if provided
    if invitation_token:
        try:
            InvitationService.accept_invitation(
                db=db,
                token=invitation_token,
                new_user_id=new_user.id
            )
        except Exception as e:
            # Log but don't fail registration
            print(f"Warning: Could not accept invitation: {str(e)}")
    
    db.commit()
    db.refresh(new_user)
    
    return new_user