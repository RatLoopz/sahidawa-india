import hmac
import logging
import os

from fastapi import Depends, HTTPException, WebSocketException, status
from starlette.requests import HTTPConnection

from utils.database import get_redis
from utils.ws_ticket import verify_stream_ticket

logger = logging.getLogger(__name__)


async def verify_api_key(conn: HTTPConnection, redis=Depends(get_redis)):
    """Authenticate every ML route.

    HTTP callers (the API and the Next.js server routes) send the shared
    x-api-key header. WebSocket callers are browsers, which cannot set headers
    on the handshake, so they present a short-lived signed ticket instead. Both
    paths are handled here so no route can be added without authentication.

    Only "/" and "/health" are exempt; they are declared on the app directly.
    """
    if conn.scope["type"] == "websocket":
        ok, reason = await verify_stream_ticket(conn.query_params.get("ticket"), redis)
        if not ok:
            # 1008 = policy violation.
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=reason)
        return

    expected = os.getenv("ML_API_KEY")
    if not expected:
        # Fail closed. Without a configured key we cannot authenticate anyone,
        # and serving the models anyway is how this service ended up open.
        logger.error("ML_API_KEY is not set; refusing to serve authenticated routes.")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ML service is not configured for authentication",
        )

    api_key = conn.headers.get("x-api-key")
    if api_key is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing API key")

    # compare_digest keeps the comparison time independent of how many leading
    # characters happen to match.
    if not hmac.compare_digest(api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
