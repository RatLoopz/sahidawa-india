# apps/ml/utils/ws_ticket.py
"""Short-lived tickets for browser WebSocket connections.

Browsers cannot set custom headers on a WebSocket handshake, so /asr/stream
cannot use the x-api-key header the HTTP routes use. Handing the shared key to
the browser is not an option either, since anything the page holds is readable
by whoever is using it.

Instead the API mints a ticket for an already-authenticated user, signed with
the shared ML_API_KEY. The browser gets a credential that is useless after a
minute and cannot be replayed, while the key itself never leaves the server.

Ticket format:  v1.<expiry_epoch>.<nonce>.<hex_hmac_sha256>
Signed payload: v1.<expiry_epoch>.<nonce>
"""

import hashlib
import hmac
import logging
import os
import time

logger = logging.getLogger(__name__)

TICKET_VERSION = "v1"
# Generous enough to survive a slow page load, short enough that a leaked URL
# in a log or referrer is worthless by the time anyone reads it.
MAX_TICKET_LIFETIME_SECONDS = 120


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def build_ticket(expiry_epoch: int, nonce: str, secret: str) -> str:
    """Mint a ticket. Used by tests; the API mints these in production."""
    payload = f"{TICKET_VERSION}.{expiry_epoch}.{nonce}"
    return f"{payload}.{_sign(payload, secret)}"


async def verify_stream_ticket(ticket: str | None, redis) -> tuple[bool, str]:
    """Validate a WebSocket ticket. Returns (ok, reason)."""
    secret = os.getenv("ML_API_KEY")
    if not secret:
        logger.error("ML_API_KEY is not set; refusing WebSocket connections.")
        return False, "server not configured for authentication"

    if not ticket:
        return False, "missing ticket"

    parts = ticket.split(".")
    if len(parts) != 4:
        return False, "malformed ticket"

    version, raw_expiry, nonce, signature = parts
    if version != TICKET_VERSION:
        return False, "unsupported ticket version"

    payload = f"{version}.{raw_expiry}.{nonce}"
    if not hmac.compare_digest(_sign(payload, secret), signature):
        return False, "bad signature"

    # Signature is valid, so the values below were produced by the API.
    try:
        expiry = int(raw_expiry)
    except ValueError:
        return False, "malformed expiry"

    now = int(time.time())
    if expiry <= now:
        return False, "expired ticket"

    # A signed ticket with an absurd lifetime should still be refused, so a
    # bug in the minting side cannot produce a long-lived browser credential.
    if expiry - now > MAX_TICKET_LIFETIME_SECONDS:
        return False, "ticket lifetime too long"

    # Single use. SET NX fails if this nonce was already redeemed, which stops
    # a ticket captured from a URL from being replayed while still fresh.
    try:
        claimed = await redis.set(f"ws_ticket:{nonce}", "1", nx=True, ex=expiry - now)
    except Exception as error:
        # Fail closed: without Redis we cannot prevent replay.
        logger.error("Redis unavailable while redeeming WebSocket ticket: %s", error)
        return False, "unable to verify ticket"

    if not claimed:
        return False, "ticket already used"

    return True, ""
