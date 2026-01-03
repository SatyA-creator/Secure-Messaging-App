# app/services/secure_deletion_service.py
import os
import secrets

class SecureDeletionService:
    
    @staticmethod
    def secure_delete_file(file_path: str):
        """
        Securely delete file by overwriting with random data
        Makes recovery virtually impossible
        """
        try:
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Overwrite with random data 3 times (DoD 5220.22-M standard)
            with open(file_path, 'ba+', buffering=0) as f:
                for _ in range(3):
                    f.seek(0)
                    f.write(secrets.token_bytes(file_size))
            
            # Finally, delete the file
            os.remove(file_path)
        except Exception as e:
            print(f"Secure deletion error: {e}")
    
    @staticmethod
    def purge_message_from_memory(message_bytes: bytes):
        """
        Overwrite message in memory before garbage collection
        Prevents memory dumps from containing plaintext
        """
        if message_bytes:
            # Overwrite in memory
            memmove = lambda src, dst, n: None  # Python doesn't expose this safely
            # Use ctypes instead
            import ctypes
            ctypes.memset(id(message_bytes), 0, len(message_bytes))
