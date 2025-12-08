@staticmethod
def register_user(db: Session, user_data: UserRegister, invitation_token: str = None) -> User:
    """Register new user, optionally from invitation"""
    
    # Check if user exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP400_BAD_REQUEST,
            detail="Email or username already registered"
        )
    
    # Generate key pair
    private_key, public_key = AuthService.generate_key_pair()
    
    # Create user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=AuthService.hash_password(user_data.password),
        public_key=public_key,
        full_name=user_data.full_name
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