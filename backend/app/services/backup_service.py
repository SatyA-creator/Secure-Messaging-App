# app/services/backup_service.py
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import json
import base64

class BackupService:
    
    @staticmethod
    def create_encrypted_backup(
        messages: list,
        encryption_key: bytes,
        backup_password: str
    ) -> str:
        """Create encrypted backup file"""
        
        # Serialize messages
        backup_data = json.dumps([
            {
                "id": str(m.id),
                "content": m.encrypted_content.hex(),
                "timestamp": m.created_at.isoformat()
            } for m in messages
        ])
        
        # Encrypt backup
        nonce = os.urandom(16)
        cipher = Cipher(
            algorithms.AES(encryption_key),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(backup_data.encode()) + encryptor.finalize()
        
        # Create backup package
        backup_package = {
            "version": "1.0",
            "encrypted_data": base64.b64encode(encrypted).decode(),
            "nonce": base64.b64encode(nonce).decode(),
            "tag": base64.b64encode(encryptor.tag).decode()
        }
        
        return json.dumps(backup_package)
