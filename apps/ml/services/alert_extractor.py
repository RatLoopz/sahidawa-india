import json
import logging
import os
from typing import List, Dict, Any, Optional
import re
from datetime import datetime, date
from pydantic import BaseModel, Field, ValidationError, field_validator

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    logging.warning("LangChain or langchain-google-genai is not installed. Extractor will mock or fail if called.")

class AlertInfo(BaseModel):
    reported_brand_name: str = Field(description="The brand name of the medicine")
    batch_number: str = Field(description="The batch number or lot number")
    manufacturer: str = Field(description="The company that manufactured the medicine")
    alert_type: str = Field(description="The type of alert, e.g., 'NSQ', 'Spurious', 'Banned'")
    state: Optional[str] = Field(description="The state mentioned")
    district: Optional[str] = Field(description="The district mentioned")
    reported_at: Optional[str] = Field(description="The date of the alert in YYYY-MM-DD if possible")
    proof_image_url: Optional[str] = Field(default=None, description="The Cloudinary URL of the original document snapshot proof")

class AlertList(BaseModel):
    alerts: List[AlertInfo] = Field(description="List of alerts extracted from the text")


# Validation and normalization layer

NULL_LIKE_VALUES = {
    "",
    "-",
    "N/A",
    "NA",
    "NULL",
    "UNKNOWN",
}

def normalize_text(value: str) -> str:
    if not value:
        return ""

    value = str(value).strip()
    value = re.sub(r"\s+", " ", value)
    return value

def is_ocr_noise(value: str) -> bool:
    if not value:
        return True

    value = value.strip()

    # Mostly symbols
    if re.fullmatch(r"[\W_]+", value):
        return True

    # Very short garbage
    if len(value) <= 2 and not value.isalnum():
        return True

    return False


class ValidatedAlert(BaseModel):
    reported_brand_name: str
    batch_number: str
    manufacturer: str
    alert_type: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    reported_at: Optional[str] = None
    proof_image_url: Optional[str] = None

    @field_validator("reported_brand_name", "batch_number", "manufacturer", "alert_type", "state", "district", mode="before")
    @classmethod
    def normalize_fields(cls, value):
        if value is None:
            return value

        return normalize_text(value)


    @field_validator("reported_brand_name", "batch_number", "manufacturer")
    @classmethod
    def validate_required_fields(cls, value):

        if value is None:
            raise ValueError("Missing required field")

        value = str(value)

        if value.upper() in NULL_LIKE_VALUES:
            raise ValueError("Null-like value detected")

        if is_ocr_noise(value):
            raise ValueError("OCR noise detected")

        return value

    @field_validator("reported_at")
    @classmethod
    def validate_date(cls, value):
        if not value:
            return value

        # Support multiple date formats and normalize all valid dates to YYYY-MM-DD.
        formats = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %b %Y",     
            "%d %B %Y",      
        ]

        parsed_date = None

        for fmt in formats:
            try:
                parsed_date = datetime.strptime(value.strip(), fmt).date()
                break
            except ValueError:
                continue

        if parsed_date is None:
            raise ValueError("Invalid date format")

        if parsed_date > date.today():
            raise ValueError("Future date detected")

        return parsed_date.strftime("%Y-%m-%d")

def validate_alert(alert_dict):
    try:
        validated = ValidatedAlert(**alert_dict)
        return validated.model_dump()

    except ValidationError as e:
        logging.warning(f"Rejected alert during validation: {e}")
        return None


def extract_alerts_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Extracts structured alert information from unstructured PDF text using LangChain and Gemini.
    """
    if not LANGCHAIN_AVAILABLE:
        logging.error("LangChain dependencies missing.")
        return []

    try:
        # Check if API key is set
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logging.warning("GOOGLE_API_KEY not set. Cannot extract alerts using Gemini.")
            return []

        llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0, google_api_key=api_key)
        structured_llm = llm.with_structured_output(AlertList)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert at extracting structured information from pharmaceutical recall and alert notices."),
            ("human", "Extract the list of recalled or NSQ (Not of Standard Quality) medicines from the following text.\n\nTEXT:\n{text}")
        ])
        
        chain = prompt | structured_llm
        
        # Define chunk size and overlap for handling very large PDFs.
        # 40k characters (~8k-10k tokens) ensures we stay well within context/generation limits.


        # The context is a CDSCO alert pdf which is well structured and defined. 
        # Therefore, for the extraction task, sticking with the character/token-based sliding window with overlap is recommended. 
        # It guarantees exhaustive scanning (no alerts are missed).
        # It has zero additional latency/cost (no pre-chunking embedding calls).
        # The overlap (e.g., 2,000 characters) is a highly reliable, low-cost safety net that ensures any record split on a boundary is captured completely in the adjacent chunk.
    
        max_chunk_size = 40000
        overlap = 2000
        
        chunks = []
        if len(text) <= max_chunk_size:
            chunks.append(text)
        else:
            start = 0
            while start < len(text):
                end = min(start + max_chunk_size, len(text))
                chunks.append(text[start:end])
                if end == len(text):
                    break
                start = end - overlap

        all_alerts = []
        seen_keys = set()
        
        for i, chunk in enumerate(chunks):
            logging.info(f"Processing PDF chunk {i + 1}/{len(chunks)} ({len(chunk)} characters)...")
            try:
                result = chain.invoke({"text": chunk})
                
                if result:
                    alerts_to_add = []
                    if hasattr(result, "alerts"):
                        alerts_to_add = result.alerts
                    elif isinstance(result, dict) and "alerts" in result:
                        alerts_to_add = result["alerts"]
                        
                    for alert in alerts_to_add:
                        if isinstance(alert, dict):
                            alert_dict = alert
                        else:
                            alert_dict = (alert.model_dump() if hasattr(alert, "model_dump") else dict(alert))
                            
                        validated_alert = validate_alert(alert_dict)

                        # Skip alerts that fail validation
                        if not validated_alert:
                            continue

                        key = (
                            validated_alert["reported_brand_name"].strip().lower(),
                            validated_alert["batch_number"].strip().lower(),
                            validated_alert["manufacturer"].strip().lower()
                        )

                        if key not in seen_keys:
                            seen_keys.add(key)
                            all_alerts.append(validated_alert)

            except Exception as chunk_exc:
                logging.error(f"Error extracting alerts from chunk {i + 1}: {chunk_exc}")
                
        return all_alerts
    except Exception as e:
        logging.error(f"Error extracting alerts: {e}")
        return []

def extract_alerts_from_pdf_images(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extracts structured alert information from scanned/image-based PDFs
    by rendering pages to PNG images and analyzing them with Gemini-1.5-Flash.
    Also uploads the page screenshots to Cloudinary to serve as audit proof.
    """
    if not LANGCHAIN_AVAILABLE:
        logging.error("LangChain dependencies missing.")
        return []

    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logging.warning("GOOGLE_API_KEY not set. Cannot extract alerts using Gemini.")
            return []

        # Configure Cloudinary if credentials are available
        cloudinary_configured = False
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        api_key_cloud = os.getenv("CLOUDINARY_API_KEY")
        api_secret_cloud = os.getenv("CLOUDINARY_API_SECRET")

        if cloud_name and api_key_cloud and api_secret_cloud:
            try:
                import cloudinary
                import cloudinary.uploader
                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=api_key_cloud,
                    api_secret=api_secret_cloud,
                    secure=True
                )
                cloudinary_configured = True
                logging.info("Cloudinary client configured successfully for CDSCO scraper proof archiving.")
            except Exception as config_exc:
                logging.warning(f"Failed to configure Cloudinary SDK: {config_exc}")
        else:
            logging.warning("Cloudinary environment variables missing, skipping proof uploads.")

        # Use fitz (PyMuPDF) to render PDF pages
        import fitz
        import base64
        from langchain_core.messages import HumanMessage

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            logging.warning("Empty PDF document.")
            return []

        # Use gemini-1.5-flash since it's highly optimized for multimodal tasks (and cost-efficient)
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, google_api_key=api_key)
        structured_llm = llm.with_structured_output(AlertList)

        all_alerts = []
        seen_keys = set()

        for page_num in range(len(doc)):
            logging.info(f"Rendering and parsing PDF page {page_num + 1}/{len(doc)} using Gemini Multimodal...")
            page = doc.load_page(page_num)
            pix = page.get_pixmap(dpi=150) # Render at 150 DPI for good text legibility and reasonable file size
            png_bytes = pix.tobytes("png")
            b64_image = base64.b64encode(png_bytes).decode("utf-8")

            # Upload the rendered page snapshot to Cloudinary if configured
            proof_image_url = None
            if cloudinary_configured:
                try:
                    import cloudinary.uploader
                    import time
                    timestamp = int(time.time())
                    public_id = f"cdsco_alert_page_{page_num + 1}_{timestamp}"
                    
                    logging.info(f"Uploading page {page_num + 1} screenshot to Cloudinary as {public_id}...")
                    upload_res = cloudinary.uploader.upload(
                        png_bytes,
                        folder="sahidawa/cdsco_proofs",
                        public_id=public_id,
                        overwrite=True,
                        resource_type="image"
                    )
                    proof_image_url = upload_res.get("secure_url")
                    logging.info(f"Cloudinary upload success: {proof_image_url}")
                except Exception as upload_exc:
                    logging.error(f"Cloudinary upload failed for page {page_num + 1}: {upload_exc}")

            # Prepare the multimodal prompt
            prompt_text = (
                "You are an expert at extracting structured information from pharmaceutical recall and alert notices.\n"
                "Please analyze this image of a CDSCO drug recall page and extract all the recalled or NSQ (Not of Standard Quality) medicines.\n"
                "Extract the brand name, batch number, manufacturer, alert type (e.g., NSQ, Spurious, Banned), state, district, and date (YYYY-MM-DD if possible).\n"
                "Ensure that you are extremely precise with spelling, especially for drug brand names and batch numbers."
            )

            message = HumanMessage(
                content=[
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_image}"}
                    }
                ]
            )

            try:
                result = structured_llm.invoke([message])
                if result:
                    alerts_to_add = []
                    if hasattr(result, "alerts"):
                        alerts_to_add = result.alerts
                    elif isinstance(result, dict) and "alerts" in result:
                        alerts_to_add = result["alerts"]

                    for alert in alerts_to_add:
                        if isinstance(alert, dict):
                            alert_dict = alert
                        else:
                            alert_dict = (alert.model_dump() if hasattr(alert, "model_dump") else dict(alert))

                        alert_dict["proof_image_url"] = proof_image_url

                        validated_alert = validate_alert(alert_dict)

                        # Skip alerts that fail validation
                        if not validated_alert:
                            continue

                        key = (
                            validated_alert["reported_brand_name"].strip().lower(),
                            validated_alert["batch_number"].strip().lower(),
                            validated_alert["manufacturer"].strip().lower()
                        )

                        if key not in seen_keys:
                            seen_keys.add(key)
                            all_alerts.append(validated_alert)
                        
            except Exception as page_exc:
                logging.error(f"Error extracting alerts from page {page_num + 1} with Gemini: {page_exc}")

        return all_alerts

    except Exception as e:
        logging.error(f"Error in extract_alerts_from_pdf_images: {e}")
        return []

