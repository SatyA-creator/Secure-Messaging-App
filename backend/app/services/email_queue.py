"""
Async Email Queue Service for Background Email Processing
Handles sending emails without blocking the main request
"""

import asyncio
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class EmailQueue:
    """Queue for asynchronous email sending"""
    
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
        """Send invitation email via Resend API"""
        try:
            import requests
            
            logger.info(f"🔄 Sending email to {invitee_email} via Resend")
            
            response = requests.post(
                'https://api.resend.com/emails',
                headers={
                    'Authorization': f'Bearer {settings.RESEND_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    # 'from': f'Secure Messaging <onboarding@resend.dev>',
                    'from': 'Secure Messaging App <priyamsatya08@gmail.com>',
                    'to': [invitee_email],
                    'subject': f'{inviter_name} invited you to Secure Messaging App',
                    'html': f"""
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
                            <span style="color: #4CAF50; word-break: break-all;">{invitation_link}</span>
                          </p>
                          <p style="font-size: 12px; color: #999; margin-top: 30px;">
                            This invitation expires in 7 days.
                          </p>
                        </div>
                      </body>
                    </html>
                    """
                }
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ Email sent successfully to {invitee_email}")
                return True
            else:
                logger.error(f"❌ Resend API error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Unexpected error sending email: {str(e)}")
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
                
                await asyncio.to_thread(
                    cls.send_invitation_email_sync,
                    email_data['invitee_email'],
                    email_data['invitation_link'],
                    email_data['inviter_name']
                )
                
                cls._queue.task_done()
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"❌ Email worker error: {str(e)}")
                await asyncio.sleep(5)
