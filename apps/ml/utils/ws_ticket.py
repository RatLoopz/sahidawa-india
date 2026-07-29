# apps/ml/utils/ws_ticket.py
"""Short-lived tickets for browser WebSocket connections.

Browsers cannot set custom headers on a WebSocket handshake, so /asr/stream
cannot use the x-api-key header the HTTP routes use. Handing the shared key to
the browser is not an option either, since anything the page holds is readable
by whoever is using it.

Instead the API mints a ticket for an already-authenticated user, signed with
the shared ML_API_KEY. The browser gets a credential that is useless after a
minute and cannot be replayed, while the key itself never leaves the server.

Ticket formats:
  v2:  v2.<expiry_epoch>.<nonce>.<user_id>.<hex_hmac_sha256>   (current)
  v1:  v1.<expiry_epoch>.<nonce>.<hex_hmac_sha256>             (legacy, accepted)

The v2 format embeds the authenticated user_id in the signed payload so the ML
service can map a live socket back to a user and force-close it when that user's
access is revoked. v1 tickets are still accepted during rollout — they simply
carry no identity, so those (short-lived) sessions are not force-closable.

Keep the v2 payload/signature layout in sync with apps/api/src/routes/ml.ts.
"""

import hashlib
import hmac
import logging
import os
import time

logger = logging.getLogger(__name__)

TICKET_VERSION = "v2"
LEGACY_TICKET_VERSION = "v1"
# Generous enough to survive a slow page load, short enough that a leaked URL
# in a log or referrer is worthless by the time anyone reads it.
MAX_TICKET_LIFETIME_SECONDS = 120


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def build_ticket(expiry_epoch: int, nonce: str, user_id: str, secret: str) -> str:
    """Mint a v2 ticket. Used by tests; the API mints these in production."""
    payload = f"{TICKET_VERSION}.{expiry_epoch}.{nonce}.{user_id}"
    return f"{payload}.{_sign(payload, secret)}"


def _split_ticket(ticket: str) -> tuple[str, str, str, str | None, str] | None:
    """Parse a ticket into (version, raw_expiry, nonce, user_id, signature).

    Returns ``user_id`` as ``None`` for legacy v1 tickets, or ``None`` overall
    if the ticket does not match a supported layout. The nonce (hex), expiry
    (int) and user_id (uuid) never contain ".", so splitting is unambiguous.
    """
    parts = ticket.split(".")
    if len(parts) == 5 and parts[0] == TICKET_VERSION:
        version, raw_expiry, nonce, user_id, signature = parts
        return version, raw_expiry, nonce, user_id, signature
    if len(parts) == 4 and parts[0] == LEGACY_TICKET_VERSION:
        version, raw_expiry, nonce, signature = parts
        return version, raw_expiry, nonce, None, signature
    return None


def _signed_payload(version: str, raw_expiry: str, nonce: str, user_id: str | None) -> str:
    if user_id is None:
        return f"{version}.{raw_expiry}.{nonce}"
    return f"{version}.{raw_expiry}.{nonce}.{user_id}"


async def verify_stream_ticket(ticket: str | None, redis) -> tuple[bool, str]:
    """Validate a WebSocket ticket. Returns (ok, reason)."""
    secret = os.getenv("ML_API_KEY")
    if not secret:
        logger.error("ML_API_KEY is not set; refusing WebSocket connections.")
        return False, "server not configured for authentication"

    if not ticket:
        return False, "missing ticket"

    parsed = _split_ticket(ticket)
    if parsed is None:
        return False, "malformed ticket"

    version, raw_expiry, nonce, user_id, signature = parsed
    payload = _signed_payload(version, raw_expiry, nonce, user_id)
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


def extract_ticket_user_id(ticket: str | None) -> str | None:
    """Return the authenticated user_id embedded in a v2 ticket, else None.

    Re-checks the HMAC signature so a tampered user_id is ignored, but does NOT
    touch Redis: expiry and single-use replay have already been enforced by
    ``verify_stream_ticket`` (a mandatory route dependency) before the socket
    handler that calls this runs. Legacy v1 tickets carry no identity and yield
    None.
    """
    secret = os.getenv("ML_API_KEY")
    if not secret or not ticket:
        return None

    parsed = _split_ticket(ticket)
    if parsed is None:
        return None

    version, raw_expiry, nonce, user_id, signature = parsed
    if user_id is None:
        return None

    payload = _signed_payload(version, raw_expiry, nonce, user_id)
    if not hmac.compare_digest(_sign(payload, secret), signature):
        return None

    return user_id or None
