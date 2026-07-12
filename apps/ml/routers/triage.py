from fastapi import APIRouter, HTTPException, status, Depends  
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import asyncio
import uuid


from services.triage_graph import run_triage_flow, clear_session
from utils.rate_limiter import RateLimiter  

router = APIRouter(prefix="/triage", tags=["Triage"])
MAX_CONCURRENT_TRIAGE_REQUESTS = 10  
_triage_semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRIAGE_REQUESTS)

# Define the limit: 5 requests per 60 seconds per IP
triage_limiter = RateLimiter(requests=5, window_seconds=60)


class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the sender: 'user' or 'assistant'/'model'.")
    content: str = Field(..., max_length=2000, description="The text content of the message.")


class TriageRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., max_length=50, description="The history of chat messages in the session.")
    locale: Optional[str] = Field("en", description="The preferred language/locale code.")
    session_id: Optional[str] = Field(
        None,
        description="Session ID to persist triage state across multiple turns of the "
        "same conversation. Omit on the first request to start a new session; "
        "the response will include a session_id to reuse on subsequent requests.",
    )

class TriageResponse(BaseModel):
    response: str = Field(
        ...,
        description="The generated triage message (clarifying question or final response).",
    )
    emergency: bool = Field(
        ...,
        description="True if symptoms indicate a potential medical emergency.",
    )
    language: str = Field(
        ..., description="The language detected/used for response."
    )
    summary: Optional[str] = Field(
        "", description="One sentence summary of symptoms/situation."
    )
    recommendations: Optional[List[str]] = Field(
        [], description="List of recommended actions."
    )
    disclaimer: Optional[str] = Field("", description="Safety disclaimer.")
    details: Optional[Dict[str, Any]] = Field(
        {},
        description="Extracted symptom details (onset, severity, location, etc.).",
    )
    session_id: str = Field(
        ...,
        description="Session ID for this triage conversation. Pass this back in "
        "subsequent requests to preserve context across turns.",
    )


class ClearSessionRequest(BaseModel):
    session_id: str = Field(
        ...,
        min_length=1,
        description="The session ID whose persisted triage state should be deleted.",
    )


class ClearSessionResponse(BaseModel):
    session_id: str = Field(..., description="The session ID that was requested to clear.")
    cleared: bool = Field(
        ...,
        description="True if a stored session was found and removed; False if there "
        "was nothing to clear (unknown or already-expired session).",
    )


# Attach the rate limiter here via the dependencies parameter
@router.post(
    "/chat", response_model=TriageResponse, dependencies=[Depends(triage_limiter)]
)
async def triage_chat(payload: TriageRequest):
    """Exposes the stateful multi-turn symptom triage graph via a POST request."""
    if not payload.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages history cannot be empty.",
        )

    # Standardize roles to 'user' and 'assistant' for the graph
    messages_list = []
    for msg in payload.messages:
        role = msg.role.strip().lower()
        if role in ["model", "assistant", "ai"]:
            role = "assistant"
        else:
            role = "user"
        messages_list.append({"role": role, "content": msg.content.strip()})
    if _triage_semaphore.locked():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Triage service is at maximum capacity. Please try again shortly.",
        )

    # Generate a new session_id if the client didn't supply one (first message
    # of a new conversation), or reuse theirs to resume an existing session.
    session_id = payload.session_id or str(uuid.uuid4())

    async with _triage_semaphore:
        try:
            logging.info(
                f"Invoking triage flow for chat of length {len(messages_list)} "
                f"(session_id={session_id})"
            )
            result = await run_triage_flow(
                messages_list, locale=payload.locale, session_id=session_id
            )
            return TriageResponse(
                response=result.get("response", ""),
                emergency=result.get("emergency", False),
                language=result.get("language", "English"),
                summary=result.get("summary", ""),
                recommendations=result.get("recommendations", []),
                disclaimer=result.get("disclaimer", ""),
                details=result.get("details", {}),
                session_id=session_id,
            )
        except Exception as e:
            logging.error(f"Error in triage_chat route execution: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Triage service temporarily unavailable. Please try again."
            )


# The limiter keys on request path + IP, so /clear gets its own quota bucket
# and doesn't eat into a client's /chat allowance.
@router.post(
    "/clear",
    response_model=ClearSessionResponse,
    dependencies=[Depends(triage_limiter)],
)
async def triage_clear(payload: ClearSessionRequest):
    """Deletes a triage session's persisted state from Redis so the user can
    start fresh without waiting for the 30-minute TTL to expire.

    Clearing an unknown or already-expired session is not an error; the
    response simply reports cleared=False.
    """
    try:
        cleared = await clear_session(payload.session_id)
    except Exception as e:
        logging.error(f"Error clearing triage session '{payload.session_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not clear the triage session. Please try again.",
        )

    logging.info(
        "Clear requested for triage session '%s' (existed=%s)",
        payload.session_id,
        cleared,
    )
    return ClearSessionResponse(session_id=payload.session_id, cleared=cleared)
