from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

from services.triage_graph import run_triage_flow

router = APIRouter(prefix="/triage", tags=["Triage"])

class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the sender: 'user' or 'assistant'/'model'.")
    content: str = Field(..., description="The text content of the message.")

class TriageRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="The history of chat messages in the session.")
    locale: Optional[str] = Field("en", description="The preferred language/locale code.")

class TriageResponse(BaseModel):
    response: str = Field(..., description="The generated triage message (clarifying question or final response).")
    emergency: bool = Field(..., description="True if symptoms indicate a potential medical emergency.")
    language: str = Field(..., description="The language detected/used for response.")
    summary: Optional[str] = Field("", description="One sentence summary of symptoms/situation.")
    recommendations: Optional[List[str]] = Field([], description="List of recommended actions.")
    disclaimer: Optional[str] = Field("", description="Safety disclaimer.")
    details: Optional[Dict[str, Any]] = Field({}, description="Extracted symptom details (onset, severity, location, etc.).")

@router.post("/chat", response_model=TriageResponse)
async def triage_chat(payload: TriageRequest):
    """
    Exposes the stateful multi-turn symptom triage graph via a POST request.
    """
    if not payload.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages history cannot be empty."
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

    try:
        logging.info(f"Invoking triage flow for chat of length {len(messages_list)}")
        result = run_triage_flow(messages_list, locale=payload.locale)
        return TriageResponse(
            response=result.get("response", ""),
            emergency=result.get("emergency", False),
            language=result.get("language", "English"),
            summary=result.get("summary", ""),
            recommendations=result.get("recommendations", []),
            disclaimer=result.get("disclaimer", ""),
            details=result.get("details", {})
        )
    except Exception as e:
        logging.error(f"Error in triage_chat route execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Triage agent failed: {str(e)}"
        )
