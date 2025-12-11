import asyncio
from app.services.invitation_service import InvitationService

class EmailQueue:
    @staticmethod
    async def send_email_async(invitee_email: str, invitation_token: str, inviter_name: str):
        """Send email in background without blocking"""
        try:
            InvitationService.send_invitation_email(
                invitee_email, 
                invitation_token, 
                inviter_name
            )
        except Exception as e:
            print(f"❌ Failed to send email to {invitee_email}: {str(e)}")
