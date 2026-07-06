import os
import requests
from bs4 import BeautifulSoup
import pdfplumber
import logging
import sys
import sqlite3
import hashlib
import json
from io import BytesIO
from urllib.parse import urljoin

# Adjust path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from services.alert_extractor import extract_alerts_from_text, extract_alerts_from_pdf_images

logging.basicConfig(level=logging.INFO)

DB_FILE = os.path.join(os.path.dirname(__file__), "alerts_queue.db")

CDSCO_ALERTS_URL = "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/"

API_BASE_URL = os.getenv("API_BASE_URL", "").strip().rstrip("/")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

INGEST_API_URL = API_BASE_URL + "/api/v1/alerts/ingest" if API_BASE_URL else ""
ALERTS_API_URL = API_BASE_URL + "/api/v1/alerts" if API_BASE_URL else ""

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
        
    logging.info(f"Extracted {len(alerts)} alerts. Sending to Ingest API...")
    
    # Deduplicate against existing DB records
    new_alerts = deduplicate_alerts(alerts)
    if not new_alerts:
        logging.info("All extracted alerts already exist in the database. Skipping ingest.")
        return
    
    logging.info(f"{len(new_alerts)} new alert(s) to queue after deduplication.")
    queue_alerts(new_alerts, pdf_url)

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alert_queue (
            idempotency_key TEXT PRIMARY KEY,
            alert_data TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def queue_alerts(alerts: list, pdf_url: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    added_count = 0
    for alert in alerts:
        batch = alert.get("batch_number", "UNKNOWN_BATCH")
        key_string = f"{pdf_url}-{batch}"
        idempotency_key = hashlib.sha256(key_string.encode('utf-8')).hexdigest()
        
        cursor.execute("SELECT status FROM alert_queue WHERE idempotency_key = ?", (idempotency_key,))
        existing = cursor.fetchone()
        
        if not existing:
            cursor.execute("INSERT INTO alert_queue (idempotency_key, alert_data, status) VALUES (?, ?, 'pending')", 
                           (idempotency_key, json.dumps(alert)))
            added_count += 1
            
    conn.commit()
    conn.close()
    if added_count > 0:
        logging.info(f"Queued {added_count} new alerts for ingestion.")
    else:
        logging.info("No new alerts added to queue (all were duplicates by idempotency key).")

def process_queue():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT idempotency_key, alert_data FROM alert_queue WHERE status = 'pending'")
    rows = cursor.fetchall()
    
    if not rows:
        logging.info("No pending alerts in queue.")
        conn.close()
        return

    alerts_to_send = []
    keys_to_update = []
    
    for row in rows:
        key = row[0]
        try:
            alert = json.loads(row[1])
            alerts_to_send.append(alert)
            keys_to_update.append(key)
        except json.JSONDecodeError:
            logging.error(f"Failed to parse alert data for key {key}")
            
    if alerts_to_send:
        # Process in batches of 50
        batch_size = 50
        for i in range(0, len(alerts_to_send), batch_size):
            batch_alerts = alerts_to_send[i:i+batch_size]
            batch_keys = keys_to_update[i:i+batch_size]
            
            logging.info(f"Attempting to ingest batch of {len(batch_alerts)} pending alerts...")
            success = ingest_alerts(batch_alerts)
            if success:
                placeholders = ','.join('?' for _ in batch_keys)
                cursor.execute(f"UPDATE alert_queue SET status = 'processed' WHERE idempotency_key IN ({placeholders})", batch_keys)
                conn.commit()
                logging.info(f"Queue batch of {len(batch_keys)} items marked as processed.")
            else:
                logging.warning("Ingestion batch failed. Alerts remain in pending status.")
            
    conn.close()

def deduplicate_alerts(alerts: list) -> list:
    """
    Checks the drug_alerts table via the API for each alert's batch number
    to see if it already exists, avoiding full-table scanning limit issues.
    """
    new_alerts = []
    for a in alerts:
        batch = a.get("batch_number")
        if not batch:
            new_alerts.append(a)
            continue
        try:
            # Query by batch_number specifically
            response = requests.get(ALERTS_API_URL, params={"batch_number": batch, "limit": 1}, timeout=10)
            response.raise_for_status()
            existing = response.json().get("data", [])
            if not existing:
                new_alerts.append(a)
            else:
                logging.info(f"Skipping already-ingested alert with batch number: {batch}")
        except Exception as e:
            logging.warning(f"Could not verify existing alert for batch {batch}: {e}. Proceeding as new.")
            new_alerts.append(a)
            
    skipped = len(alerts) - len(new_alerts)
    if skipped:
        logging.info(f"Deduplicated: skipped {skipped} already-ingested alert(s).")
    return new_alerts


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
        
    init_db()
    
    logging.info("Checking for pending alerts in queue on startup...")
    process_queue()
    
    scrape_cdsco_alerts()
    
    logging.info("Processing newly queued alerts...")
    process_queue()

