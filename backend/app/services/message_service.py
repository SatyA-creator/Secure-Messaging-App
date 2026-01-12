from sqlalchemy.orm import Session
from app.models.message import Message
from uuid import UUID
from datetime import datetime


class MessageService:
    """Service for managing one-to-one messages"""
    
    @staticmethod
    def mark_as_delivered(db: Session, message_id: str):
        """Mark a message as delivered"""
        try:
            message = db.query(Message).filter(Message.id == UUID(message_id)).first()
            if message:
                message.is_delivered = True
                message.delivered_at = datetime.utcnow()
                db.commit()
                return True
            return False
        except Exception as e:
            print(f"❌ Error marking message as delivered: {e}")
            db.rollback()
            return False
    
    @staticmethod
    def mark_as_read(db: Session, message_id: str):
        """Mark a message as read"""
        try:
            message = db.query(Message).filter(Message.id == UUID(message_id)).first()
            if message:
                message.is_read = True
                message.read_at = datetime.utcnow()
                db.commit()
                return True
            return False
        except Exception as e:
            print(f"❌ Error marking message as read: {e}")
            db.rollback()
            return False
