import secrets
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.invitation import Invitation
from app.models.user import User
from app.models.contact import Contact
from app.config import settings


logger = logging.getLogger(__name__)


class InvitationService:
    
    @staticmethod
    def generate_token() -> str:
        """Generate secure random token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    async def queue_invitation_email(
        invitee_email: str,
        invitation_token: str,
        inviter_name: str
    ) -> bool:
        """
        Queue invitation email for asynchronous sending
        Returns immediately without waiting for email to send
        """
        from app.services.email_queue import EmailQueue
        try:
            # Create full invitation link
            invitation_link = f"{settings.FRONTEND_URL}/accept-invitation/{invitation_token}"
            
            # Add to email queue
            return await EmailQueue.add_email_task(
                invitee_email=invitee_email,
                invitation_link=invitation_link,
                inviter_name=inviter_name
            )
        except Exception as e:
            logger.error(f"❌ Failed to queue invitation email: {str(e)}")
            return False
    
    @staticmethod
    def create_invitation(
        db: Session,
        inviter_id: UUID,
        invitee_email: str
    ) -> Invitation:
        """
        Create new invitation and queue email for sending
        This is synchronous but returns immediately (email is queued)
        """
        from app.services.email_queue import EmailQueue
        # Check if user already exists AND is already a contact
        existing_user = db.query(User).filter(User.email == invitee_email).first()
        if existing_user:
            # Check if they're already a contact
            existing_contact = db.query(Contact).filter(
                Contact.user_id == inviter_id,
                Contact.contact_id == existing_user.id
            ).first()
            if existing_contact:
                raise ValueError("User already registered and is already your contact.")
            # If user exists but is not a contact, allow re-invitation
            # The invitation will re-add them as a contact when accepted
            logger.info(f"Creating invitation for existing user {invitee_email} to rejoin as contact")
        
        # Check if invitation already sent and not expired
        existing_invitation = db.query(Invitation).filter(
            Invitation.inviter_id == inviter_id,
            Invitation.invitee_email == invitee_email,
            Invitation.is_accepted == False,
            Invitation.expires_at > datetime.utcnow()
        ).first()
        
        if existing_invitation:
            # Resend email (queue it again)
            inviter = db.query(User).filter(User.id == inviter_id).first()
            
            # Queue email asynchronously in background
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If event loop is running, schedule as task
                    asyncio.create_task(
                        InvitationService.queue_invitation_email(
                            invitee_email,
                            existing_invitation.invitation_token,
                            inviter.username
                        )
                    )
                else:
                    # If no loop running, run it in a new loop
                    asyncio.run(
                        InvitationService.queue_invitation_email(
                            invitee_email,
                            existing_invitation.invitation_token,
                            inviter.username
                        )
                    )
            except RuntimeError:
                # Fallback: create new loop
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                new_loop.run_until_complete(
                    InvitationService.queue_invitation_email(
                        invitee_email,
                        existing_invitation.invitation_token,
                        inviter.username
                    )
                )
            
            logger.info(f"📧 Resending invitation to {invitee_email}")
            return existing_invitation
        
        # Create new invitation
        token = InvitationService.generate_token()
        invitation = Invitation(
            inviter_id=inviter_id,
            invitee_email=invitee_email,
            invitation_token=token,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        
        # Get inviter details
        inviter = db.query(User).filter(User.id == inviter_id).first()
        
        # Queue email asynchronously in background (non-blocking)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If event loop is running, schedule as task
                asyncio.create_task(
                    InvitationService.queue_invitation_email(
                        invitee_email,
                        token,
                        inviter.username
                    )
                )
            else:
                # If no loop running, run it in a new loop
                asyncio.run(
                    InvitationService.queue_invitation_email(
                        invitee_email,
                        token,
                        inviter.username
                    )
                )
        except RuntimeError:
            # Fallback: create new loop
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            new_loop.run_until_complete(
                InvitationService.queue_invitation_email(
                    invitee_email,
                    token,
                    inviter.username
                )
            )
        
        logger.info(f"✅ Invitation created for {invitee_email} (email queued)")
        return invitation
    
    @staticmethod
    def accept_invitation(
        db: Session,
        token: str,
        new_user_id: UUID
    ) -> Invitation:
        """
        Accept invitation and create bidirectional contact connection
        Handles both new users registering and existing users rejoining
        """
        invitation = db.query(Invitation).filter(
            Invitation.invitation_token == token
        ).first()
        
        if not invitation:
            raise ValueError("Invalid invitation token")
        
        if invitation.is_accepted:
            # Check if contacts already exist
            existing_contact = db.query(Contact).filter(
                Contact.user_id == invitation.inviter_id,
                Contact.contact_id == new_user_id
            ).first()
            
            if existing_contact:
                logger.info(f"✅ Invitation already processed - contacts exist")
                return invitation
            else:
                # If invitation was accepted before but contacts don't exist,
                # reset it and continue (handles re-invitation after removal)
                logger.info(f"Resetting previously accepted invitation for re-joining")
                invitation.is_accepted = False
                invitation.accepted_at = None
        
        if invitation.expires_at < datetime.utcnow():
            raise ValueError("Invitation expired")
        
        # Check if contacts already exist (edge case)
        existing_contact1 = db.query(Contact).filter(
            Contact.user_id == invitation.inviter_id,
            Contact.contact_id == new_user_id
        ).first()
        existing_contact2 = db.query(Contact).filter(
            Contact.user_id == new_user_id,
            Contact.contact_id == invitation.inviter_id
        ).first()
        
        # Create contacts only if they don't exist
        if not existing_contact1:
            contact1 = Contact(
                user_id=invitation.inviter_id,
                contact_id=new_user_id
            )
            db.add(contact1)
            logger.info(f"Created contact: {invitation.inviter_id} -> {new_user_id}")
        
        if not existing_contact2:
            contact2 = Contact(
                user_id=new_user_id,
                contact_id=invitation.inviter_id
            )
            db.add(contact2)
            logger.info(f"Created contact: {new_user_id} -> {invitation.inviter_id}")
        
        # Mark as accepted
        invitation.is_accepted = True
        invitation.accepted_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"✅ Invitation {token} accepted - contacts created")
        return invitation