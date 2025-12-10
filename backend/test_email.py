import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Test Gmail SMTP
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "priyamsatya08@gmail.com"
SMTP_PASSWORD = "bsdk ivzr idqc pxvo"  # App Password
SMTP_FROM_EMAIL = "priyamsatya08@gmail.com"

def test_email(to_email):
    try:
        msg = MIMEMultipart()
        msg["Subject"] = "Test Email from Messaging App"
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = to_email
        
        body = "This is a test email. If you received this, SMTP is working!"
        msg.attach(MIMEText(body, "plain"))
        
        print(f"🔄 Connecting to {SMTP_SERVER}:{SMTP_PORT}...")
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            print("🔄 Starting TLS...")
            server.starttls()
            
            print(f"🔄 Logging in as {SMTP_USERNAME}...")
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            
            print(f"🔄 Sending email to {to_email}...")
            server.send_message(msg)
            
        print("✅ Email sent successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False

if __name__ == "__main__":
    test_email("priyamsatya08@gmail.com")  # Send to yourself
