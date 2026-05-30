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
        parser = PydanticOutputParser(pydantic_object=AlertList)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert at extracting structured information from pharmaceutical recall and alert notices."),
            ("human", "Extract the list of recalled or NSQ (Not of Standard Quality) medicines from the following text.\n\n{format_instructions}\n\nTEXT:\n{text}")
        ])
        
        chain = prompt | llm | parser
        
        # We can implement chunking here if needed for very large PDFs, 
        # but for now we rely on the large context window of gemini-1.5-pro.
        result = chain.invoke({
            "text": text,
            "format_instructions": parser.get_format_instructions()
        })
        
        # result is now an AlertList instance
        return [alert.dict() for alert in result.alerts]
    except Exception as e:
        logging.error(f"Error extracting alerts: {e}")
        return []
