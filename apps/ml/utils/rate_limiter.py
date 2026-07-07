# apps/ml/utils/rate_limiter.py
from fastapi import Request, HTTPException, status, Depends
import redis.asyncio as aioredis
from utils.database import get_redis

class RateLimiter:
    def __init__(self, requests: int, window_seconds: int):
        self.requests = requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request, redis: aioredis.Redis = Depends(get_redis)):
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        
        redis_key = f"rate_limit:{path}:{ip}"
        
        # Atomically increment hit count and inspect TTL
        async with redis.pipeline(transaction=True) as pipe:
            await pipe.incr(redis_key)
            await pipe.ttl(redis_key)
            current_hits, ttl = await pipe.execute()
        
        if current_hits == 1 or ttl == -1:
            await redis.expire(redis_key, self.window_seconds)
            ttl = self.window_seconds

        if current_hits > self.requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(ttl)}
            )