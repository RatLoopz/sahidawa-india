import cv2
import numpy as np
import json
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import base64

logger = logging.getLogger(__name__)

class OCRPipeline:
    def __init__(self):
        # We use Gemini 1.5 Flash for the complex extraction (fast and vision capable)
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.0
        )
    
    def preprocess_image(self, image_bytes: bytes) -> bytes:
        """
        Applies OpenCV preprocessing to reduce glare and improve contrast for blister packs.
        """
        try:
            # Decode bytes to cv2 image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return image_bytes
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            # This is excellent for removing glare and balancing lighting on blister packs
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Apply slight Gaussian blur to remove noise
            blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
            
            # Apply adaptive thresholding to bring out the text
            thresh = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Encode back to bytes
            _, buffer = cv2.imencode('.jpg', thresh)
            return buffer.tobytes()
            
        except Exception as e:
            logger.error(f"Error in OpenCV preprocessing: {str(e)}")
            # Fallback to original image if preprocessing fails
            return image_bytes

    async def extract_batch_and_expiry(self, image_bytes: bytes) -> dict:
        """
        Extracts batch_no and expiry_date using the Vision Model.
        """
        # Preprocess the image
        processed_bytes = self.preprocess_image(image_bytes)
        
        # Prepare the payload for LangChain/Gemini
        base64_image = base64.b64encode(processed_bytes).decode('utf-8')
        
        prompt = """
        You are a highly accurate pharmaceutical OCR assistant. 
        Examine the provided image of a medicine strip/packaging. 
        Extract the following information precisely:
        1. Batch Number (often prefixed with B.No, Batch, Lot, B)
        2. Expiry Date (often prefixed with Exp, Expiry, Use By, EXP DATE)

        Return ONLY a raw JSON object with exactly these two keys: "batch_no" and "expiry_date". 
        If a value cannot be found, set it to null.
        Do not include markdown blocks or any other text.
        """
        
        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                }
            ]
        )
        
        try:
            # Invoke the vision model
            response = await self.llm.ainvoke([message])
            text = response.content.strip()
            
            # Strip potential markdown formatting if the LLM ignores instructions
            if text.startswith('```json'):
                text = text[7:]
            if text.endswith('```'):
                text = text[:-3]
                
            data = json.loads(text.strip())
            return {
                "batch_no": data.get("batch_no"),
                "expiry_date": data.get("expiry_date")
            }
        except Exception as e:
            logger.error(f"Failed to extract with Vision model: {str(e)}")
            raise

ocr_pipeline = OCRPipeline()
