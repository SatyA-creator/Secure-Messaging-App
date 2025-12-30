from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.invitation_service import InvitationService
from app.models.user import User
from app.models.invitation import Invitation
from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid

router = APIRouter()

class SendInvitationRequest(BaseModel):
    inviter_email: EmailStr  # Change to email since frontend sends email
    invitee_email: EmailStr

class AcceptInvitationRequest(BaseModel):
    token: str
    new_user_id: uuid.UUID

@router.post("/send")
async def send_invitation(request: SendInvitationRequest, db: Session = Depends(get_db)):
    """Send invitation email to a new user"""
    try:
        # Find inviter by email
        inviter = db.query(User).filter(User.email == request.inviter_email).first()
        if not inviter:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Inviter not found"
            )
        
        invitation = InvitationService.create_invitation(
            db, 
            inviter.id,  # Use the found user's UUID
            request.invitee_email
        )
        
        return {
            "status": "success",
            "message": f"Invitation sent to {request.invitee_email}",
            "invitation_id": str(invitation.id)
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send invitation: {str(e)}")

@router.get("/verify/{token}")
async def verify_invitation(token: str, db: Session = Depends(get_db)):
    """Verify invitation token and get inviter details"""
    from app.models.contact import Contact
    
    invitation = db.query(Invitation).filter(Invitation.invitation_token == token).first()
    
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation")
    
    # Check if invitation was accepted but contacts no longer exist (re-invitation after removal)
    if invitation.is_accepted:
        # Check if contacts still exist
        existing_user = db.query(User).filter(User.email == invitation.invitee_email).first()
        if existing_user:
            existing_contact = db.query(Contact).filter(
                Contact.user_id == invitation.inviter_id,
                Contact.contact_id == existing_user.id
            ).first()
            if existing_contact:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already accepted")
            # If no contact exists, allow re-acceptance (user was removed and is rejoining)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already accepted")
    
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation expired")
    
    inviter = db.query(User).filter(User.id == invitation.inviter_id).first()
    
    return {
        "inviter_name": inviter.username,
        "inviter_avatar": inviter.avatar_url if hasattr(inviter, 'avatar_url') else None,
        "invitee_email": invitation.invitee_email
    }

@router.post("/accept")
async def accept_invitation(request: AcceptInvitationRequest, db: Session = Depends(get_db)):
    """Accept invitation after registration"""
    try:
        invitation = InvitationService.accept_invitation(db, request.token, request.new_user_id)
        
        return {
            "status": "success",
            "message": "Invitation accepted and contact added"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
