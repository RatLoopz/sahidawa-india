import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY");
    process.exit(1);
}

if (typeof global.WebSocket === "undefined") {
    global.WebSocket = class WebSocket {
        constructor() {}
        close() {}
        send() {}
        addEventListener() {}
        removeEventListener() {}
    } as any;
}
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

const BANNED_REASON = "Banned due to lack of therapeutic justification and safety concerns.";
const NSQ_REASON = "Not of Standard Quality (NSQ) - Fails dissolution or assay tests.";

const alertsData = [
    {
        alert_type: "banned",
        reported_brand_name: "Nimesulide + Paracetamol Dispersible Tablet",
        manufacturer: "Unapproved combinations",
        batch_number: "ALL",
        reported_at: "2024-08-15T00:00:00.000Z",
        source_url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/1",
        risk_level: "high",
    },
    {
        alert_type: "recalled",
        reported_brand_name: "Pan-D Capsule",
        manufacturer: "Alkem Laboratories Ltd",
        batch_number: "23498A",
        reported_at: "2024-09-01T00:00:00.000Z",
        source_url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/2",
        risk_level: "high",
    },
    {
        alert_type: "banned",
        reported_brand_name: "Chlorpheniramine Maleate + Codeine Syrup",
        manufacturer: "Multiple Manufacturers",
        batch_number: "ALL-C",
        reported_at: "2024-07-20T00:00:00.000Z",
        source_url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/3",
        risk_level: "high",
    },
    {
        alert_type: "counterfeit",
        reported_brand_name: "Shelcal 500",
        manufacturer: "Torrent Pharmaceuticals",
        batch_number: "S12345",
        reported_at: "2024-09-10T00:00:00.000Z",
        source_url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/4",
        risk_level: "high",
    },
    {
        alert_type: "recalled",
        reported_brand_name: "Telma-H",
        manufacturer: "Glenmark Pharmaceuticals",
        batch_number: "TH9087",
        reported_at: "2024-09-15T00:00:00.000Z",
        source_url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/5",
        risk_level: "high",
    },
];

async function seed() {
    console.log("Seeding realistic CDSCO drug alerts...");
    for (const alert of alertsData) {
        const { error } = await supabase.from("drug_alerts").insert([alert]);
        if (error) {
            console.error(`Error inserting ${alert.reported_brand_name}:`, error);
        } else {
            console.log(`Inserted: ${alert.reported_brand_name} - ${alert.alert_type}`);
        }
    }
    console.log("Done.");
}

seed();
