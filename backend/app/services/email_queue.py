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
            
            # Build HTML email content
            html_content = f"""
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 30px; border-radius: 10px;">
                  <h2 style="color: #333;">🔐 You've been invited!</h2>
                  <p style="font-size: 16px; color: #666;">
                    <strong>{inviter_name}</strong> wants to connect with you on Secure Messaging App.
                  </p>
                  <p style="margin: 30px 0;">
                    <a href="{invitation_link}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px; font-weight: bold;">
                      Accept Invitation
                    </a>
                  </p>
                  <p style="font-size: 14px; color: #666;">
                    Or copy this link:<br>
                    <code style="background-color: #e8e8e8; padding: 5px 10px; border-radius: 3px; word-break: break-all;">
                      {invitation_link}
                    </code>
                  </p>
                  <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                    ⏰ This invitation expires in 7 days.
                  </p>
                </div>
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
