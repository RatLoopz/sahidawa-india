import json
import logging
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import PydanticOutputParser
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

class AlertList(BaseModel):
    alerts: List[AlertInfo] = Field(description="List of alerts extracted from the text")

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
        # parser = PydanticOutputParser(pydantic_object=AlertList)
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
                            brand = alert.get("reported_brand_name", "")
                            batch = alert.get("batch_number", "")
                            mfg = alert.get("manufacturer", "")
                            alert_dict = alert
                        else:
                            brand = getattr(alert, "reported_brand_name", "")
                            batch = getattr(alert, "batch_number", "")
                            mfg = getattr(alert, "manufacturer", "")
                            alert_dict = alert.dict() if hasattr(alert, "dict") else dict(alert)
                            
                        # Unique key for in-memory deduplication across chunks
                        key = (
                            str(brand).strip().lower(),
                            str(batch).strip().lower(),
                            str(mfg).strip().lower()
                        )
                        if key not in seen_keys:
                            seen_keys.add(key)
                            all_alerts.append(alert_dict)
            except Exception as chunk_exc:
                logging.error(f"Error extracting alerts from chunk {i + 1}: {chunk_exc}")
                
        return all_alerts
    except Exception as e:
        logging.error(f"Error extracting alerts: {e}")
        return []
