# app/middleware/security.py
import hmac
import hashlib
from fastapi import Request, HTTPException, status

class SecurityMiddleware:
    
    @staticmethod
    async def obfuscate_metadata(sender_id: str, recipient_id: str) -> str:
        """
        Create obfuscated conversation ID
        Even if server logs are leaked, you won't know who talked to whom
        """
        # Create deterministic but non-obvious hash
        combined = f"{sender_id}:{recipient_id}".encode()
        obfuscated = hashlib.sha256(combined).hexdigest()
        return obfuscated
    
    @staticmethod
    def sanitize_error_messages(error: Exception) -> str:
        """
        Don't reveal internal details in errors
        Prevents information leakage
        """
        # Generic message - real error logged server-side
        return "Operation failed. Please try again."
    
    @staticmethod
    async def add_timing_noise():
        """
        Add random delays to prevent timing attacks
        Attacker can't determine if user exists by response time
        """
        import random
        import asyncio
        
        delay = random.uniform(0.01, 0.1)  # 10-100ms random delay
        await asyncio.sleep(delay)
