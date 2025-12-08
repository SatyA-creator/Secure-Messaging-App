from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import getdb
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.invitation_service import InvitationService
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/invitations", tags=["invitations"])

class SendInvitationRequest(BaseModel):
    invitee_email: EmailStr
    frontend_url: str = "http://localhost:5173"

class InvitationResponse(BaseModel):
    id: str
    inviter_id: str
    invitee_email: str
    is_accepted: bool
    expires_at: str

@router.post("/send")
async def send_invitation(
    request: SendInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(getdb)
):
    """Send invitation to new user via email"""
    
    invitation = InvitationService.send_invitation_email(
        db=db,
        inviter_id=current_user.id,
        invitee_email=request.invitee_email,
        frontend_url=request.frontend_url
    )
    
    return {
        "message": f"Invitation sent to {request.invitee_email}",
        "invitation_id": str(invitation.id),
        "expires_at": invitation.expires_at.isoformat()
    }

@router.get("/verify/{token}")
async def verify_invitation(token: str, db: Session = Depends(getdb)):
    """Verify if invitation token is valid"""
    
    invitation = db.query(Invitation).filter(
        Invitation.invitation_token == token
    ).first()
    
    if not invitation or not invitation.is_valid():
        raise HTTPException(
            status_code=status.HTTP400_BAD_REQUEST,
            detail="Invalid or expired invitation"
        )
    
    inviter = db.query(User).filter(User.id == invitation.inviter_id).first()
    
    return {
        "valid": True,
        "inviter_name": inviter.username,
        "inviter_avatar": inviter.avatar_url,
        "expires_at": invitation.expires_at.isoformat()
    }

@router.post("/accept/{token}")
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(getdb)
):
    """Accept invitation after user registration"""
    
    invitation = InvitationService.accept_invitation(
        db=db,
        token=token,
        new_user_id=current_user.id
    )
    
    inviter = db.query(User).filter(User.id == invitation.inviter_id).first()
    
    return {
        "message": f"Connected with {inviter.username}!",
        "contact_id": str(inviter.id),
        "contact_name": inviter.username
    }