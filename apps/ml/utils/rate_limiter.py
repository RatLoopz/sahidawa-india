# apps/ml/utils/rate_limiter.py
import os

from fastapi import Request, HTTPException, status, Depends
import redis.asyncio as aioredis
from utils.database import get_redis


def _trust_proxy_headers() -> bool:
    return os.getenv("TRUST_PROXY_HEADERS", "").strip().lower() in {"1", "true", "yes"}


def client_ip(request: Request) -> str:
    """Resolve the caller's IP for rate limiting.

    Behind a proxy every request carries the proxy's address, which puts all
    callers in one bucket and lets a single noisy client throttle everyone.
    X-Forwarded-For fixes that, but it is attacker-controlled and trusting it
    unconditionally would let anyone dodge the limit by forging a new IP per
    request, so it is only read when TRUST_PROXY_HEADERS is set.
    """
    if _trust_proxy_headers():
        forwarded = request.headers.get("x-forwarded-for", "")
        # Left-most entry is the original client; the rest are proxy hops.
        client = forwarded.split(",")[0].strip()
        if client:
            return client

    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(self, requests: int, window_seconds: int):
        self.requests = requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request, redis: aioredis.Redis = Depends(get_redis)):
        ip = client_ip(request)
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