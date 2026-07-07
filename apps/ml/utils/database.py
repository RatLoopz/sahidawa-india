# apps/ml/utils/database.py
import os
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Single global connection pool instance
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

async def get_redis():
    """FastAPI Dependency providing the Redis client."""
    return redis_client