import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load .env
load_dotenv(dotenv_path="../../.env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

supabase: Client = create_client(url, key)

medicines = [
  {
    "barcode_id": "8901111111111",
    "brand_name": "Augmentin 625 Duo",
    "generic_name": "Amoxicillin + Clavulanic Acid",
    "manufacturer": "GlaxoSmithKline plc",
    "batch_number": "B23059",
    "cdsco_approval_status": "recalled",
    "is_counterfeit_alert": True,
    "mrp": 189.50,
    "jan_aushadhi_price": 96.50
  },
  {
    "barcode_id": "8902222222222",
    "brand_name": "Pan 40",
    "generic_name": "Pantoprazole",
    "manufacturer": "Alkem Laboratories Ltd",
    "batch_number": "UP992",
    "cdsco_approval_status": "recalled",
    "is_counterfeit_alert": True,
    "mrp": 168.00,
    "jan_aushadhi_price": 31.50
  },
  {
    "barcode_id": "8903333333333",
    "brand_name": "Paracetamol 500mg",
    "generic_name": "Paracetamol",
    "manufacturer": "Cipla Ltd",
    "batch_number": "HR4410",
    "cdsco_approval_status": "approved",
    "is_counterfeit_alert": False,
    "mrp": 20.00,
    "jan_aushadhi_price": 8.00
  },
  {
    "barcode_id": "8904444444444",
    "brand_name": "Cetirizine 10mg",
    "generic_name": "Cetirizine",
    "manufacturer": "Sun Pharmaceutical Industries Ltd",
    "batch_number": "CT1010",
    "cdsco_approval_status": "approved",
    "is_counterfeit_alert": False,
    "mrp": 25.00,
    "jan_aushadhi_price": 5.00
  }
]

print("Seeding Medicines...")
med_res = supabase.table("medicines").upsert(medicines, on_conflict="barcode_id").execute()
med_data = med_res.data
print(f"Inserted {len(med_data)} medicines.")

print("Seeding Drug Alerts (Linked to Medicines)...")
alerts = []
for med in med_data:
    if med.get("is_counterfeit_alert"):
        alerts.append({
            "medicine_id": med["id"],
            "reported_brand_name": med["brand_name"],
            "manufacturer": med["manufacturer"],
            "batch_number": med["batch_number"],
            "alert_type": "recalled",
            "state": "Maharashtra",
            "district": "Mumbai",
            "reported_at": "2026-07-20T00:00:00Z"
        })

dummy_alerts = [
    {"brand": "Dolo 650", "mfg": "Micro Labs", "batch": "DL991", "type": "nsq"},
    {"brand": "Azithral 500", "mfg": "Alembic", "batch": "AZ002", "type": "nsq"},
    {"brand": "Telma 40", "mfg": "Glenmark", "batch": "TL77", "type": "nsq"},
    {"brand": "Vicks Action 500", "mfg": "P&G", "batch": "VK123", "type": "banned"},
    {"brand": "Corex Syrup", "mfg": "Pfizer", "batch": "CX456", "type": "banned"},
    {"brand": "Shelcal 500 (Fake)", "mfg": "Unknown", "batch": "SH999", "type": "counterfeit"}
]

for dummy in dummy_alerts:
    alerts.append({
        "medicine_id": None,
        "reported_brand_name": dummy["brand"],
        "manufacturer": dummy["mfg"],
        "batch_number": dummy["batch"],
        "alert_type": dummy["type"],
        "state": "Delhi",
        "district": "New Delhi",
        "reported_at": "2026-07-20T00:00:00Z"
    })

alert_res = supabase.table("drug_alerts").insert(alerts).execute()
print(f"Inserted {len(alert_res.data)} drug alerts.")
print("Done! Your remote database now has real-looking data.")
