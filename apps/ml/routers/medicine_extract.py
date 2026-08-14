from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from services.medicine_extractor import extract_medicines_from_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicine-extract", tags=["Medicine Extraction"])

# A single spoken utterance is short; 2k characters is a generous ceiling that
# still guards the LLM call against oversized payloads.
MAX_TEXT_LENGTH = 2000


class MedicineExtractRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)


class MedicineExtractResponse(BaseModel):
    medicines: List[str]


@router.post("", response_model=MedicineExtractResponse)
async def medicine_extract(payload: MedicineExtractRequest) -> MedicineExtractResponse:
    # extract_medicines_from_text makes a blocking LLM call — keep the event loop free.
    medicines = await run_in_threadpool(extract_medicines_from_text, payload.text)
    return MedicineExtractResponse(medicines=medicines)
