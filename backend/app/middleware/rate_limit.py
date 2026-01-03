# app/middleware/rate_limit.py
from fastapi import Request, HTTPException, status
from datetime import datetime, timedelta
import redis

class RateLimitMiddleware:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def check_rate_limit(
        self,
        request: Request,
        user_id: str,
        action: str,
        max_attempts: int = 5,
        window_seconds: int = 300
    ):
        """
        Rate limit user actions
        Example: Max 5 login attempts per 5 minutes
        """
        key = f"rate_limit:{user_id}:{action}"
        
        # Check current attempts
        attempts = self.redis.get(key)
        current_attempts = int(attempts) if attempts else 0
        
        if current_attempts >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again later."
            )
        
        # Increment counter
        self.redis.incr(key)
        self.redis.expire(key, window_seconds)
