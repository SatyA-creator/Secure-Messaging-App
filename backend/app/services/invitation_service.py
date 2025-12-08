import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.invitation import Invitation
from app.models.user import User
from app.models.contact import Contact
from app.config import settings
import uuid

class InvitationService:
    
    @staticmethod
    def generate_token() -> str:
        """Generate secure random token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def send_invitation_email(invitee_email: str, invitation_token: str, inviter_name: str):
        """Send invitation email via SMTP"""
        try:
            # Create invitation link
            invitation_link = f"{settings.FRONTEND_URL}/accept-invitation/{invitation_token}"
            
            # Create email
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"{inviter_name} invited you to Secure Messaging App"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = invitee_email
            
            # HTML email body
            html = f"""
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 30px; border-radius: 10px;">
                  <h2 style="color: #333;">You've been invited!</h2>
                  <p style="font-size: 16px; color: #666;">
                    <strong>{inviter_name}</strong> wants to connect with you on Secure Messaging App.
                  </p>
                  <p style="margin: 30px 0;">
                    <a href="{invitation_link}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </p>
                  <p style="font-size: 14px; color: #999;">
                    Or copy this link: <br>
                    <span style="color: #4CAF50;">{invitation_link}</span>
                  </p>
                  <p style="font-size: 12px; color: #999; margin-top: 30px;">
                    This invitation expires in 7 days.
                  </p>
                </div>
              </body>
            </html>
            """
            
            msg.attach(MIMEText(html, "html"))
            
            # Send email
            print(f"🔄 Attempting to send email to {invitee_email}...")
            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            
            print(f"✅ Email sent successfully to {invitee_email}")
            return True
        except Exception as e:
            print(f"❌ Failed to send email: {str(e)}")
            return False
    
    @staticmethod
    def create_invitation(db: Session, inviter_id: uuid.UUID, invitee_email: str) -> Invitation:
        """Create new invitation"""
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == invitee_email).first()
        if existing_user:
            raise ValueError("User already registered. Add them directly as a contact.")
        
        # Check if invitation already sent and not expired
        existing_invitation = db.query(Invitation).filter(
            Invitation.inviter_id == inviter_id,
            Invitation.invitee_email == invitee_email,
            Invitation.is_accepted == False,
            Invitation.expires_at > datetime.utcnow()
        ).first()
        
        if existing_invitation:
            # Resend email
            inviter = db.query(User).filter(User.id == inviter_id).first()
            InvitationService.send_invitation_email(
                invitee_email, 
                existing_invitation.invitation_token,
                inviter.username
            )
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
        
        # Send email
        inviter = db.query(User).filter(User.id == inviter_id).first()
        InvitationService.send_invitation_email(invitee_email, token, inviter.username)
        
        return invitation
    
    @staticmethod
    def accept_invitation(db: Session, token: str, new_user_id: uuid.UUID):
        """Accept invitation and create bidirectional contact"""
        invitation = db.query(Invitation).filter(Invitation.invitation_token == token).first()
        
        if not invitation:
            raise ValueError("Invalid invitation token")
        
        if invitation.is_accepted:
            raise ValueError("Invitation already accepted")
        
        if invitation.expires_at < datetime.utcnow():
            raise ValueError("Invitation expired")
        
        # Mark as accepted
        invitation.is_accepted = True
        invitation.accepted_at = datetime.utcnow()
        
        # Create bidirectional contacts
        contact1 = Contact(user_id=invitation.inviter_id, contact_id=new_user_id)
        contact2 = Contact(user_id=new_user_id, contact_id=invitation.inviter_id)
        
        db.add(contact1)
        db.add(contact2)
        db.commit()
        
        return invitation
