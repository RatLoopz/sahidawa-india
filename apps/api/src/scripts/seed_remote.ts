import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const medicines = [
    {
        barcode_id: "8901111111111",
        brand_name: "Augmentin 625 Duo",
        generic_name: "Amoxicillin + Clavulanic Acid",
        manufacturer: "GlaxoSmithKline plc",
        batch_number: "B23059",
        cdsco_approval_status: "recalled",
        is_counterfeit_alert: true,
        mrp: 189.5,
        jan_aushadhi_price: 96.5,
    },
    {
        barcode_id: "8902222222222",
        brand_name: "Pan 40",
        generic_name: "Pantoprazole",
        manufacturer: "Alkem Laboratories Ltd",
        batch_number: "UP992",
        cdsco_approval_status: "recalled",
        is_counterfeit_alert: true,
        mrp: 168.0,
        jan_aushadhi_price: 31.5,
    },
    {
        barcode_id: "8903333333333",
        brand_name: "Paracetamol 500mg",
        generic_name: "Paracetamol",
        manufacturer: "Cipla Ltd",
        batch_number: "HR4410",
        cdsco_approval_status: "approved",
        is_counterfeit_alert: false,
        mrp: 20.0,
        jan_aushadhi_price: 8.0,
    },
    {
        barcode_id: "8904444444444",
        brand_name: "Cetirizine 10mg",
        generic_name: "Cetirizine",
        manufacturer: "Sun Pharmaceutical Industries Ltd",
        batch_number: "CT1010",
        cdsco_approval_status: "approved",
        is_counterfeit_alert: false,
        mrp: 25.0,
        jan_aushadhi_price: 5.0,
    },
];

async function seed() {
    console.log("Seeding Medicines...");
    const { data: medData, error: medError } = await supabase
        .from("medicines")
        .upsert(medicines, { onConflict: "barcode_id" })
        .select();

    if (medError) {
        console.error("Error inserting medicines:", medError);
        return;
    }
    console.log(`Inserted ${medData.length} medicines.`);

    console.log("Seeding Drug Alerts (Linked to Medicines)...");
    const alerts = [];

    for (const med of medData) {
        if (med.is_counterfeit_alert) {
            alerts.push({
                medicine_id: med.id, // Explicitly linking to avoid the NULL bug
                reported_brand_name: med.brand_name,
                manufacturer: med.manufacturer,
                batch_number: med.batch_number,
                alert_type: "recalled",
                state: "Maharashtra",
                district: "Mumbai",
                reported_at: new Date().toISOString(),
            });
        }
    }

    // Adding some dummy CDSCO alerts
    const dummyAlerts = [
        { brand: "Dolo 650", mfg: "Micro Labs", batch: "DL991" },
        { brand: "Azithral 500", mfg: "Alembic", batch: "AZ002" },
        { brand: "Telma 40", mfg: "Glenmark", batch: "TL77" },
    ];

    for (const dummy of dummyAlerts) {
        alerts.push({
            medicine_id: null, // these don't exist in medicines table
            reported_brand_name: dummy.brand,
            manufacturer: dummy.mfg,
            batch_number: dummy.batch,
            alert_type: "nsq",
            state: "Delhi",
            district: "New Delhi",
            reported_at: new Date().toISOString(),
        });
    }

    const { data: alertData, error: alertError } = await supabase
        .from("drug_alerts")
        .upsert(alerts, { onConflict: "batch_number,manufacturer,reported_brand_name" })
        .select();

    if (alertError) {
        console.error("Error inserting alerts:", alertError);
        return;
    }
    console.log(`Inserted ${alertData.length} drug alerts.`);
    console.log("Done! Your remote database now has real-looking data.");
}

seed();
