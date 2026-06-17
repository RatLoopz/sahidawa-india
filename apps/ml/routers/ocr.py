from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.concurrency import run_in_threadpool
from PIL import Image
import pytesseract
import io
import logging
#Added for the fuzz string matching 
from pydantic import BaseModel
from typing import List
from services.matcher import find_matches
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB limit

@router.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """
    Extracts text from an uploaded medicine strip image using Tesseract OCR.
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File uploaded is not an image.")

    # Validate file size to prevent Denial of Service (DoS) via memory exhaustion
    if file.size and file.size > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    try:
        # Read image content
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Perform OCR to extract text
        # We can also use lang='eng+hin' if we want to support Hindi
        text = await run_in_threadpool(pytesseract.image_to_string, image)
        
        # Extract detailed data to calculate overall confidence
        data = await run_in_threadpool(
            pytesseract.image_to_data, 
            image, 
            output_type=pytesseract.Output.DICT
        )
        
        # Tesseract returns confidence as integers from 0 to 100. -1 indicates no text.
        valid_confidences = [
            int(conf) for conf, word in zip(data['conf'], data['text']) 
            if word.strip() and int(conf) != -1
        ]
        
        if valid_confidences:
            # Calculate average confidence and scale to 0.0 - 1.0 range
            avg_conf = sum(valid_confidences) / len(valid_confidences)
            confidence = round(avg_conf / 100.0, 2)
        else:
            confidence = 0.0

        logger.info(f"OCR extracted text length: {len(text)}")

        return {
            "text": text.strip(),
            "confidence": confidence,
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

# For issue 17: Request payload validation schema
class MatchRequest(BaseModel):
    query: str
    medicines: List[str]

# Response validation schema
class MatchResponse(BaseModel):
    name: str
    score: int

@router.post("/match", response_model=List[MatchResponse])
async def match_medicine(payload: MatchRequest):
    """
    Takes a messy OCR text string and matches it against a list of valid medicine names,
    returning the top 3 closest matches based on Levenshtein distance.
    """
    try:
        matches = find_matches(payload.query, payload.medicines)
        return matches
    except Exception as e:
        logger.error(f"Fuzzy matching error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fuzzy matching failed: {str(e)}")