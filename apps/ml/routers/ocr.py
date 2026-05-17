from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import pytesseract
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])

@router.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """
    Extracts text from an uploaded medicine strip image using Tesseract OCR.
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File uploaded is not an image.")

    try:
        # Read image content
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Perform OCR to extract text
        # We can also use lang='eng+hin' if we want to support Hindi
        text = pytesseract.image_to_string(image)
        
        # Extract detailed data to calculate overall confidence
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        
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
