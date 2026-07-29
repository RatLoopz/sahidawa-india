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

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    from supabase import create_client
    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase_client = None

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None
    logging.warning("Failed to initialize Redis client. Check REDIS_URL.")

PENDING_ALERTS_KEY = "cdsco_pending_alerts"
RETRY_COUNTER_PREFIX = "cdsco_alert_retry:"
DLQ_KEY = "cdsco_dlq_alerts"
MAX_RETRIES = int(os.getenv("CDSCO_ALERT_MAX_RETRIES", 3))

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
        for skey in skipped_keys:
            redis_client.delete(f"{RETRY_COUNTER_PREFIX}{skey}")  
    if not new_alerts_map:
        logging.info("All pending alerts were duplicates. Queue cleared.")
        return
        
    logging.info(f"{len(new_alerts_map)} new alert(s) to ingest.")
    
    success = ingest_alerts(list(new_alerts_map.values()))
    
    if success:
        keys_to_mark = list(new_alerts_map.keys())
        if keys_to_mark:
            redis_client.hdel(PENDING_ALERTS_KEY, *keys_to_mark)
            for key in keys_to_mark:
                redis_client.delete(f"{RETRY_COUNTER_PREFIX}{key}")
        logging.info("Successfully removed ingested alerts from Redis queue.")
    else:
        logging.warning("Failed to ingest alerts. They will remain pending in the Redis queue for the next run.")
        for key in new_alerts_map.keys():
            retry_count = redis_client.incr(f"{RETRY_COUNTER_PREFIX}{key}")
            
            if retry_count >= MAX_RETRIES:
                payload = redis_client.hget(PENDING_ALERTS_KEY, key)
                if payload:
                    redis_client.hset(DLQ_KEY, key, payload)
                
                redis_client.hdel(PENDING_ALERTS_KEY, key)
                redis_client.delete(f"{RETRY_COUNTER_PREFIX}{key}")
                logging.warning(f"Alert {key} moved to DLQ after {MAX_RETRIES} failed attempts.")
                
def scrape_cdsco_alerts():
    logging.info(f"Checking {CDSCO_ALERTS_URL} for new alerts...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    try:
        # TLS verification stays on. Alerts scraped here are written to
        # drug_alerts with the service role key and pushed to users, so an
        # unverified connection lets a network attacker fabricate recalls.
        response = requests.get(CDSCO_ALERTS_URL, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"Failed to fetch CDSCO alerts page: {e}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    
    pdf_links = []
    for a in soup.find_all('a', href=True):
        href = a['href'].lower()
        if href.endswith('.pdf') or 'download_file_division.jsp' in href:
            link = urljoin(CDSCO_ALERTS_URL, a['href'])
            pdf_links.append(link)
    
    if not pdf_links:
        logging.info("No PDF links found on the alerts page.")
        return
        
    # Process the next 5 PDFs to quickly seed real data without hitting rate limits
    for pdf_url in pdf_links[1:6]:
        logging.info(f"Processing alert PDF: {pdf_url}")
        process_alert_pdf(pdf_url)
        
    logging.info("Finished processing all PDFs.")

def process_alert_pdf(pdf_url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/pdf,*/*;q=0.8"
    }
    try:
        logging.info(f"Downloading PDF (or wrapper): {pdf_url}")
        response = requests.get(pdf_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        content = response.content
        # Check if it's an HTML wrapper containing an iframe (CDSCO does this)
        if b"<iframe" in content.lower():
            logging.info("Found HTML wrapper, extracting real PDF URL from iframe...")
            soup = BeautifulSoup(content, 'html.parser')
            iframe = soup.find('iframe')
            if iframe and iframe.has_attr('src'):
                real_pdf_path = iframe['src']
                # If path has spaces, it might need quoting, but urljoin handles it mostly.
                # In Python requests, we might need to properly encode it.
                real_pdf_url = urljoin(CDSCO_ALERTS_URL, real_pdf_path)
                real_pdf_url = real_pdf_url.replace(" ", "%20")
                logging.info(f"Downloading real PDF: {real_pdf_url}")
                response = requests.get(real_pdf_url, headers=headers, timeout=30)
                response.raise_for_status()
                content = response.content
    except requests.RequestException as e:
        logging.error(f"Failed to download PDF {pdf_url}: {e}")
        return
        
    text_content = ""
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
    except Exception as e:
        logging.error(f"Error parsing PDF with pdfplumber: {e}")
        return
        
    if not text_content.strip() or len(text_content.strip()) < 100:
        logging.warning("No text or very short text extracted from PDF. It might be image-based. Triggering Gemini Multimodal OCR fallback...")
        alerts = extract_alerts_from_pdf_images(content)
    else:
        logging.info("Extracted text from PDF, sending to LangChain for structural parsing...")
        alerts = extract_alerts_from_text(text_content)
    
    if not alerts:
        logging.warning("No alerts extracted from the text by LangChain.")
        return
        
    logging.info(f"Extracted {len(alerts)} alerts. Skipping Redis and ingesting directly for local testing...")
    # Bypassing Redis and deduplication for immediate local run
    success = ingest_alerts(alerts)
    if success:
        logging.info("Successfully ingested extracted alerts directly to the database!")
    else:
        logging.error("Failed to ingest alerts directly.")

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
            if not supabase_client:
                raise Exception("Supabase client not initialized")
            # Query by batch_number specifically
            res = supabase_client.table("drug_alerts").select("id").eq("batch_number", batch).limit(1).execute()
            existing = getattr(res, "data", [])
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
    if not supabase_client:
        logging.error("Cannot ingest: Supabase client not initialized.")
        return False
        
    try:
        # Strip proof_image_url if it exists to avoid schema cache issues
        for a in alerts:
            a.pop("proof_image_url", None)
            
        # We don't have a unique constraint on batch_number,manufacturer,reported_brand_name in the schema.
        # For now, just insert. In production, we'd add the constraint or check existence first.
        result = supabase_client.table("drug_alerts").insert(alerts).execute()
        logging.info(f"Successfully inserted {len(result.data)} alerts to Supabase.")
        
        # Skip updating medicines table for now since schema might not match
        return True
    except Exception as e:
        logging.error(f"Failed to ingest alerts via Supabase: {e}")
        return False

if __name__ == "__main__":
    if not SUPABASE_URL:
        logging.error("SUPABASE_URL is not set in environment. Exiting.")
        sys.exit(1)
    if not SUPABASE_KEY:
        logging.error("SUPABASE_SERVICE_ROLE_KEY is not set in environment. Exiting.")
        sys.exit(1)
    
    # Bypassed Redis for local test
    logging.info("Starting up. Fetching PDFs directly...")
    scrape_cdsco_alerts()
