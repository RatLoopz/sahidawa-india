import os
import requests
from bs4 import BeautifulSoup
import pdfplumber
import logging
import sys
import sqlite3
import hashlib
import json
import redis
from io import BytesIO
from urllib.parse import urljoin

# Adjust path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from services.alert_extractor import extract_alerts_from_text, extract_alerts_from_pdf_images

logging.basicConfig(level=logging.INFO)

CDSCO_ALERTS_URL = "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/"

API_BASE_URL = os.getenv("API_BASE_URL", "").strip().rstrip("/")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

INGEST_API_URL = API_BASE_URL + "/api/v1/alerts/ingest" if API_BASE_URL else ""
ALERTS_API_URL = API_BASE_URL + "/api/v1/alerts" if API_BASE_URL else ""

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

PENDING_ALERTS_KEY = "cdsco_pending_alerts"

def generate_idempotency_key(pdf_url: str, alert: dict) -> str:
    batch_number = alert.get('batch_number', 'unknown')
    raw_str = f"{pdf_url}_{batch_number}"
    return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()

def enqueue_alerts(pdf_url: str, alerts: list):
    mapping = {}
    for alert in alerts:
        key = generate_idempotency_key(pdf_url, alert)
        mapping[key] = json.dumps(alert)
    if mapping:
        redis_client.hset(PENDING_ALERTS_KEY, mapping=mapping)

def process_pending_queue():
    rows = redis_client.hgetall(PENDING_ALERTS_KEY)
    
    if not rows:
        logging.info("No pending alerts in Redis queue.")
        return
        
    logging.info(f"Found {len(rows)} pending alerts in Redis queue. Processing...")
    
    pending_alerts_map = {k: json.loads(v) for k, v in rows.items()}
    
    new_alerts_map, skipped_keys = deduplicate_alerts_with_keys(pending_alerts_map)
    
    if skipped_keys:
        redis_client.hdel(PENDING_ALERTS_KEY, *skipped_keys)
            
    if not new_alerts_map:
        logging.info("All pending alerts were duplicates. Queue cleared.")
        return
        
    logging.info(f"{len(new_alerts_map)} new alert(s) to ingest.")
    
    success = ingest_alerts(list(new_alerts_map.values()))
    
    if success:
        keys_to_mark = list(new_alerts_map.keys())
        if keys_to_mark:
            redis_client.hdel(PENDING_ALERTS_KEY, *keys_to_mark)
        logging.info("Successfully removed ingested alerts from Redis queue.")
    else:
        logging.warning("Failed to ingest alerts. They will remain pending in the Redis queue for the next run.")

def scrape_cdsco_alerts():
    logging.info(f"Checking {CDSCO_ALERTS_URL} for new alerts...")
    try:
        # TLS verification enabled for security as requested by the review.
        # If CDSCO presents a known CA issue, pin it explicitly.
        response = requests.get(CDSCO_ALERTS_URL, verify=True, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Failed to fetch CDSCO alerts page: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    
    pdf_links = []
    for a in soup.find_all('a', href=True):
        if a['href'].lower().endswith('.pdf'):
            link = urljoin(CDSCO_ALERTS_URL, a['href'])
            pdf_links.append(link)
    
    if not pdf_links:
        logging.info("No PDF links found on the alerts page.")
        return
        
    # FIXED — process all PDFs:
    logging.info(f"Found {len(pdf_links)} PDF(s) on alerts page. Processing all...")
    for pdf_url in pdf_links:
        logging.info(f"Processing alert PDF: {pdf_url}")
        process_alert_pdf(pdf_url)
        
    logging.info("Finished processing all PDFs. Processing pending queue...")
    process_pending_queue()

def process_alert_pdf(pdf_url: str):
    try:
        pdf_response = requests.get(pdf_url, verify=True, timeout=15)
        pdf_response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Failed to download PDF {pdf_url}: {e}")
        return
        
    text_content = ""
    try:
        with pdfplumber.open(BytesIO(pdf_response.content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
    except Exception as e:
        logging.error(f"Error parsing PDF with pdfplumber: {e}")
        return
        
    if not text_content.strip() or len(text_content.strip()) < 100:
        logging.warning("No text or very short text extracted from PDF. It might be image-based. Triggering Gemini Multimodal OCR fallback...")
        alerts = extract_alerts_from_pdf_images(pdf_response.content)
    else:
        logging.info("Extracted text from PDF, sending to LangChain for structural parsing...")
        alerts = extract_alerts_from_text(text_content)
    
    if not alerts:
        logging.warning("No alerts extracted from the text by LangChain.")
        return
        
    logging.info(f"Extracted {len(alerts)} alerts. Enqueuing to Redis database...")
    enqueue_alerts(pdf_url, alerts)

def deduplicate_alerts_with_keys(pending_alerts_map: dict):
    """
    Checks the drug_alerts table via the API for each alert's batch number
    to see if it already exists, avoiding full-table scanning limit issues.
    Returns (alerts_to_ingest_map, keys_of_already_ingested_alerts).
    """
    new_alerts_map = {}
    skipped_keys = []
    for key, a in pending_alerts_map.items():
        batch = a.get("batch_number")
        if not batch:
            new_alerts_map[key] = a
            continue
        try:
            # Query by batch_number specifically
            response = requests.get(ALERTS_API_URL, params={"batch_number": batch, "limit": 1}, timeout=10)
            response.raise_for_status()
            existing = response.json().get("data", [])
            if not existing:
                new_alerts_map[key] = a
            else:
                logging.info(f"Skipping already-ingested alert with batch number: {batch}")
                skipped_keys.append(key)
        except Exception as e:
            logging.warning(f"Could not verify existing alert for batch {batch}: {e}. Proceeding as new.")
            new_alerts_map[key] = a
            
    skipped = len(pending_alerts_map) - len(new_alerts_map)
    if skipped:
        logging.info(f"Deduplicated: skipped {skipped} already-ingested alert(s).")
    return new_alerts_map, skipped_keys


def ingest_alerts(alerts: list):
    headers = {
        "Content-Type": "application/json",
        "x-api-secret": API_SECRET_KEY
    }
    
    payload = {
        "alerts": alerts
    }
    
    try:
        response = requests.post(INGEST_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        logging.info("Successfully ingested alerts to the gateway.")
        return True
    except requests.RequestException as e:
        logging.error(f"Failed to ingest alerts: {e}")
        return False

if __name__ == "__main__":
    if not API_BASE_URL:
        logging.error("API_BASE_URL is not set in environment. Exiting.")
        sys.exit(1)
    if not API_SECRET_KEY:
        logging.error("API_SECRET_KEY is not set in environment. Exiting.")
        sys.exit(1)
        
    logging.info("Starting up. Attempting to clear pending queue before scraping new PDFs...")
    process_pending_queue()
    scrape_cdsco_alerts()
