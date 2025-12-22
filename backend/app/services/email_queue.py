"""
Async Email Queue Service for Background Email Processing
Handles sending emails without blocking the main request
Uses Resend API for reliable email delivery
"""

import asyncio
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class EmailQueue:
    """Queue for asynchronous email sending via Resend API"""
    
    _queue: asyncio.Queue = None
    _worker_task: Optional[asyncio.Task] = None
    
    @classmethod
    def initialize(cls):
        """Initialize the email queue"""
        if cls._queue is None:
            cls._queue = asyncio.Queue()
            logger.info("✅ Email queue initialized")
    
    @classmethod
    async def add_email_task(
        cls,
        invitee_email: str,
        invitation_link: str,
        inviter_name: str
    ) -> bool:
        """Add email task to queue without waiting"""
        try:
            if cls._queue is None:
                cls.initialize()
            
            await cls._queue.put({
                'invitee_email': invitee_email,
                'invitation_link': invitation_link,
                'inviter_name': inviter_name
            })
            
            logger.info(f"📧 Email queued for {invitee_email}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to queue email: {str(e)}")
            return False
    
    @staticmethod
    def send_invitation_email_sync(
        invitee_email: str,
        invitation_link: str,
        inviter_name: str
    ) -> bool:
        """Send invitation email via Resend API (most reliable)"""
        try:
            import requests
            
            logger.info(f"🔄 Sending email to {invitee_email} via Resend API")
            
            # Validate Resend API key exists
            if not hasattr(settings, 'RESEND_API_KEY') or not settings.RESEND_API_KEY:
                logger.error(
                    "❌ RESEND_API_KEY not configured in .env\n"
                    "   → Get API key from: https://resend.com\n"
                    "   → Add RESEND_API_KEY=xxx to backend/.env"
                )
                return False
            
            # Build HTML email content with anti-spam improvements
            html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You have been invited to QuantChat</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">You have been invited to QuantChat</h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                                Hi there,
                            </p>
                            <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #3f3f46;">
                                <strong>{inviter_name}</strong> has invited you to join QuantChat, a secure messaging platform. Click the button below to accept the invitation and start chatting.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{invitation_link}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center;">Accept Invitation</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; padding: 12px; background-color: #f4f4f5; border-radius: 4px; font-size: 13px; line-height: 18px; color: #3f3f46; word-break: break-all; font-family: monospace;">
                                {invitation_link}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
                            <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa;">
                                This invitation will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            """
            
            # ✅ Use verified domain if available, fallback to Resend default
            from_email = (
                f'QuantChat <noreply@{settings.VERIFIED_DOMAIN}>'
                if hasattr(settings, 'VERIFIED_DOMAIN') and settings.VERIFIED_DOMAIN
                else 'Secure Messaging <onboarding@resend.dev>'
            )
            
            logger.info(f"📧 Sending from: {from_email}")
            
            # Send via Resend API
            response = requests.post(
                'https://api.resend.com/emails',
                headers={
                    'Authorization': f'Bearer {settings.RESEND_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'from': from_email,
                    'to': [invitee_email],
                    'subject': f'{inviter_name} invited you to QuantChat',
                    'html': html_content
                },
                timeout=10
            )
            
            # Handle response
            if response.status_code in [200, 201]:
                logger.info(f"✅ Email sent successfully to {invitee_email}")
                response_data = response.json()
                logger.info(f"   Email ID: {response_data.get('id', 'N/A')}")
                return True
            elif response.status_code == 403:
                error_data = response.json()
                logger.error(
                    f"❌ Resend API Error (403): {error_data.get('message', 'Unknown')}\n"
                    f"   → Domain verification issue\n"
                    f"   → Check: https://resend.com/domains"
                )
                return False
            elif response.status_code == 401:
                logger.error(
                    "❌ Resend API Authentication Error (401)\n"
                    "   → Check RESEND_API_KEY in .env"
                )
                return False
            else:
                logger.error(
                    f"❌ Resend API Error: {response.status_code}\n"
                    f"   Response: {response.text}"
                )
                return False
                
        except ImportError:
            logger.error("❌ requests library not installed\n   → Run: pip install requests")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error sending email: {str(e)}", exc_info=True)
            return False
    
    @classmethod
    async def start_worker(cls):
        """Start background worker to process email queue"""
        if cls._queue is None:
            cls.initialize()
        
        logger.info("🚀 Email queue worker started")
        
        while True:
            try:
                email_data = await asyncio.wait_for(cls._queue.get(), timeout=60)
                
                # Send email in background thread
                await asyncio.to_thread(
                    cls.send_invitation_email_sync,
                    email_data['invitee_email'],
                    email_data['invitation_link'],
                    email_data['inviter_name']
                )
                
                cls._queue.task_done()
                
            except asyncio.TimeoutError:
                # Queue is empty, continue waiting
                continue
            except Exception as e:
                logger.error(f"❌ Email worker error: {str(e)}", exc_info=True)
                await asyncio.sleep(5)
