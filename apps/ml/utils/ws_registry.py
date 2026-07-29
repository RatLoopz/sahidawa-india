# apps/ml/utils/ws_registry.py
"""In-process registry of active user WebSockets + revocation listener.

When an API key is revoked, the Next.js API publishes the affected ``user_id``
to a Redis Pub/Sub channel. Every ML worker runs ``listen_for_revocations`` as a
background task; on a message it force-closes any of that user's live sockets it
is holding. Redis fan-out delivers the message to all workers, so a revocation
tears down the user's sessions across the whole fleet even though each worker
only knows about its own connections.

The registry is per-process (asyncio, single-threaded) so plain dict/set access
needs no locking.
"""

import asyncio
import hashlib
import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)

API_KEY_REVOKED_CHANNEL = "api_key_revoked_channel"
# RFC 6455 policy-violation close code — the same code the handshake uses to
# reject an invalid ticket, so a revoked client sees a consistent signal.
WS_POLICY_VIOLATION_CODE = 1008

# user_id -> set of live WebSocket connections owned by THIS worker process.
_connections: dict[str, set[WebSocket]] = {}


def _mask_user_id(user_id: str) -> str:
    """Return a stable, non-reversible tag for a user_id for log correlation.

    Revocation events must be traceable in logs (e.g. to confirm a user's
    sockets were torn down) without writing the raw identifier — a sensitive,
    user-identifying value — to log aggregators. A short SHA-256 prefix groups a
    given user's events together and can be matched against a known id during an
    incident, but cannot be reversed back to the user_id.
    """
    if not user_id:
        return "unknown"
    return hashlib.sha256(user_id.encode()).hexdigest()[:12]


def register_connection(user_id: str, websocket: WebSocket) -> None:
    """Track a live socket so it can be force-closed if the user is revoked."""
    _connections.setdefault(user_id, set()).add(websocket)


def unregister_connection(user_id: str, websocket: WebSocket) -> None:
    """Stop tracking a socket (call on disconnect)."""
    sockets = _connections.get(user_id)
    if sockets is None:
        return
    sockets.discard(websocket)
    if not sockets:
        _connections.pop(user_id, None)


async def close_user_connections(user_id: str, *, reason: str = "API Key Revoked") -> int:
    """Force-close every tracked socket for ``user_id``. Returns the count closed."""
    sockets = _connections.get(user_id)
    if not sockets:
        return 0

    # Iterate a copy: closing a socket (and its handler's cleanup) mutates the set.
    closed = 0
    for websocket in list(sockets):
        try:
            await websocket.close(code=WS_POLICY_VIOLATION_CODE, reason=reason)
            closed += 1
        except Exception as error:  # already closing / disconnected — best effort
            logger.warning(
                "Failed to close revoked socket for user %s: %s",
                _mask_user_id(user_id),
                error,
            )
        finally:
            unregister_connection(user_id, websocket)
    return closed


def _parse_revoked_user_id(data) -> str | None:
    """Extract the user_id from a revocation message payload."""
    if not data:
        return None
    try:
        payload = json.loads(data)
    except (TypeError, ValueError):
        return None
    if isinstance(payload, dict):
        user_id = payload.get("user_id")
        if isinstance(user_id, str) and user_id:
            return user_id
    return None


async def listen_for_revocations(redis) -> None:
    """Background task: subscribe to the revoke channel and disconnect sockets.

    Runs for the lifetime of the process; cancelled during app shutdown.
    """
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(API_KEY_REVOKED_CHANNEL)
        logger.info("Listening on '%s' for API-key revocations.", API_KEY_REVOKED_CHANNEL)

        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            user_id = _parse_revoked_user_id(message.get("data"))
            if not user_id:
                continue
            closed = await close_user_connections(user_id)
            if closed:
                logger.info(
                    "Force-closed %d ML WebSocket(s) for revoked user %s.",
                    closed,
                    _mask_user_id(user_id),
                )
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("API-key revocation listener stopped unexpectedly.")
    finally:
        try:
            await pubsub.unsubscribe(API_KEY_REVOKED_CHANNEL)
        except Exception:
            pass
        # redis-py renamed PubSub.close() to aclose(); support whichever exists.
        closer = getattr(pubsub, "aclose", None) or getattr(pubsub, "close", None)
        if closer is not None:
            try:
                await closer()
            except Exception:
                pass
