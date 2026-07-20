# apps/ml/utils/rate_limiter.py
import ipaddress
import os

from fastapi import Request, HTTPException, status, Depends
import redis.asyncio as aioredis
from utils.database import get_redis


def _trust_proxy_headers() -> bool:
    return os.getenv("TRUST_PROXY_HEADERS", "").strip().lower() in {"1", "true", "yes"}


def _trusted_proxy_hops() -> int:
    """How many trusted reverse proxies sit between the internet and this app.

    Defaults to 1 (a single load balancer / nginx). Values below 1 are treated
    as 1 so proxy trust is never silently disabled once the headers are trusted.
    """
    try:
        hops = int(os.getenv("TRUSTED_PROXY_HOPS", "1").strip())
    except ValueError:
        return 1
    return max(hops, 1)


def _valid_ip(value: str) -> str | None:
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def client_ip(request: Request) -> str:
    """Resolve the caller's IP for rate limiting.

    Behind a proxy every request carries the proxy's address, which puts all
    callers in one bucket and lets a single noisy client throttle everyone.
    X-Forwarded-For fixes that, but it is attacker-controlled: each proxy only
    appends the address it received the connection from, so anything left of the
    entries our own proxies wrote is caller-supplied and forgeable.

    The real client is therefore the entry TRUSTED_PROXY_HOPS positions from the
    right, and everything further left is ignored. Reading the left-most value
    instead would let anyone forge a fresh IP per request and dodge the limit.
    Proxy headers are only consulted when TRUST_PROXY_HEADERS is set.
    """
    peer = request.client.host if request.client else "unknown"
    if not _trust_proxy_headers():
        return peer

    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    hops = _trusted_proxy_hops()
    if len(parts) >= hops:
        candidate = _valid_ip(parts[-hops])
        if candidate:
            return candidate

    return peer


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
