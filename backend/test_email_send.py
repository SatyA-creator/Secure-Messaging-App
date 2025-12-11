from app.services.invitation_service import InvitationService

# Test email sending
result = InvitationService.send_invitation_email(
    invitee_email="test@gmail.com",
    invitation_token="test_token_123",
    inviter_name="Test User"
)

print("Email sent successfully!" if result else "Email sending failed!")
