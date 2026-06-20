import { supabase } from "../db/client";
import crypto from "crypto";
import logger from "../utils/logger";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const BURST_WINDOW_MS = 1 * 60 * 60 * 1000;
const BURST_THRESHOLD_SAME_IP = 5;
const BURST_THRESHOLD_SAME_DISTRICT = 10;
const BURST_THRESHOLD_SAME_MEDICINE = 5;

export interface ReportPayload {
    medicineName: string;
    manufacturer: string;
    description: string;
    pharmacyName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    district: string;
}

export interface ValidationResult {
    passed: boolean;
    riskScore: number;
    reasons: string[];
    duplicateGroupId?: string;
    isDuplicate: boolean;
}

export function computeReportHash(payload: ReportPayload): string {
    const normalized = [
        payload.medicineName.trim().toLowerCase(),
        payload.manufacturer.trim().toLowerCase(),
        payload.pharmacyName.trim().toLowerCase(),
        payload.city.trim().toLowerCase(),
        payload.pincode.trim(),
    ].join("|");
    return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function anonymizeIp(ip: string | undefined): string | undefined {
    if (!ip) return undefined;
    return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function validateReport(
    payload: ReportPayload,
    ipAddress: string | undefined,
    userId: string | undefined | null
): Promise<ValidationResult> {
    const reasons: string[] = [];
    let riskScore = 0;
    let isDuplicate = false;
    let duplicateGroupId: string | undefined;

    const reportHash = computeReportHash(payload);

    // 1. Deduplication check: same hash in last 24 hours
    const dedupDeadline = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: duplicates, error: dedupError } = await supabase
        .from("counterfeit_reports")
        .select("id, created_at, status")
        .eq("report_hash", reportHash)
        .gte("created_at", dedupDeadline)
        .order("created_at", { ascending: false })
        .limit(5);

    if (dedupError) {
        logger.error("Dedup lookup failed", { error: dedupError.message });
    } else if (duplicates && duplicates.length > 0) {
        isDuplicate = true;
        duplicateGroupId = duplicates[0].id;
        reasons.push(`Duplicate report: ${duplicates.length} similar report(s) found in last 24h`);
        riskScore += 0.3 * Math.min(duplicates.length, 5);
    }

    // 1b. Fuzzy duplicate: same medicine + city + similar pharmacy name
    // Catches variations like "Apollo Pharmacy" vs "Apollo Medical"
    if (payload.pharmacyName.trim().length >= 4) {
        const prefix = payload.pharmacyName.trim().substring(0, 4);
        const { data: fuzzyDups, error: fuzzyError } = await supabase
            .from("counterfeit_reports")
            .select("id")
            .eq("reported_brand_name", payload.medicineName)
            .eq("city", payload.city)
            .ilike("pharmacy_name", `${prefix}%`)
            .gte("created_at", dedupDeadline)
            .limit(3);

        if (!fuzzyError && fuzzyDups && fuzzyDups.length > 0) {
            if (!isDuplicate) {
                isDuplicate = true;
                duplicateGroupId = fuzzyDups[0].id;
            }
            reasons.push(
                `Fuzzy duplicate: ${fuzzyDups.length} similar pharmacy name(s) found in last 24h`
            );
            riskScore += 0.2 * Math.min(fuzzyDups.length, 3);
        }
    }

    // 2. Burst detection: too many reports from same IP in last hour
    if (ipAddress) {
        const burstDeadline = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
        const { count: ipCount, error: ipError } = await supabase
            .from("counterfeit_reports")
            .select("*", { count: "exact", head: true })
            .eq("ip_address", ipAddress)
            .gte("created_at", burstDeadline);

        if (!ipError && ipCount && ipCount >= BURST_THRESHOLD_SAME_IP) {
            reasons.push(`Burst detected: ${ipCount} reports from same IP in last hour`);
            riskScore += 0.2 * Math.min(ipCount / BURST_THRESHOLD_SAME_IP, 3);
        }
    }

    // 3. Burst detection: too many reports for same district in last hour
    const burstDeadline = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
    const { count: districtCount, error: districtError } = await supabase
        .from("counterfeit_reports")
        .select("*", { count: "exact", head: true })
        .eq("district", payload.district)
        .gte("created_at", burstDeadline);

    if (!districtError && districtCount && districtCount >= BURST_THRESHOLD_SAME_DISTRICT) {
        reasons.push(
            `Burst detected: ${districtCount} reports for district "${payload.district}" in last hour`
        );
        riskScore += 0.25 * Math.min(districtCount / BURST_THRESHOLD_SAME_DISTRICT, 3);
    }

    // 4. Burst detection: too many reports for same medicine in last hour
    const { count: medicineCount, error: medicineError } = await supabase
        .from("counterfeit_reports")
        .select("*", { count: "exact", head: true })
        .eq("reported_brand_name", payload.medicineName)
        .gte("created_at", burstDeadline);

    if (!medicineError && medicineCount && medicineCount >= BURST_THRESHOLD_SAME_MEDICINE) {
        reasons.push(
            `Burst detected: ${medicineCount} reports for "${payload.medicineName}" in last hour`
        );
        riskScore += 0.2 * Math.min(medicineCount / BURST_THRESHOLD_SAME_MEDICINE, 3);
    }

    // 5. Reporter reputation: check if user has submitted false_alarm reports
    if (userId) {
        const { count: falseAlarmCount, error: repError } = await supabase
            .from("counterfeit_reports")
            .select("*", { count: "exact", head: true })
            .eq("reporter_id", userId)
            .eq("status", "false_alarm");

        if (!repError && falseAlarmCount && falseAlarmCount >= 2) {
            reasons.push(`Low reputation: reporter has ${falseAlarmCount} false alarm(s)`);
            riskScore += 0.15 * Math.min(falseAlarmCount, 5);
        }
    }

    // 6. Geographic diversity: same IP reporting for many different districts
    if (ipAddress) {
        const { data: geoRows, error: geoError } = await supabase
            .from("counterfeit_reports")
            .select("district")
            .eq("ip_address", ipAddress)
            .gte("created_at", burstDeadline);
        const distinctCount = geoRows ? new Set(geoRows.map((r) => r.district)).size : 0;
        if (!geoError && distinctCount >= 3) {
            reasons.push(
                `Suspicious geographic spread: IP reported in ${distinctCount} different districts`
            );
            riskScore += 0.15 * Math.min(distinctCount / 3, 3);
        }
    }

    // 7. Sybil detection: many distinct IPs reporting for same district or medicine
    // Catches slow coordinated attacks across multiple accounts/IPs
    if (ipAddress) {
        const { data: districtRows, error: sybilDistError } = await supabase
            .from("counterfeit_reports")
            .select("ip_address")
            .eq("district", payload.district)
            .gte("created_at", burstDeadline);
        const distinctIpsForDistrict = districtRows
            ? new Set(districtRows.map((r) => r.ip_address)).size
            : 0;
        if (!sybilDistError && distinctIpsForDistrict >= 8) {
            reasons.push(
                `Sybil pattern: ${distinctIpsForDistrict} different reporters for district "${payload.district}" in last hour`
            );
            riskScore += 0.2;
        }
        const { data: medicineRows, error: sybilMedError } = await supabase
            .from("counterfeit_reports")
            .select("ip_address")
            .eq("reported_brand_name", payload.medicineName)
            .gte("created_at", burstDeadline);
        const distinctIpsForMedicine = medicineRows
            ? new Set(medicineRows.map((r) => r.ip_address)).size
            : 0;
        if (!sybilMedError && distinctIpsForMedicine >= 5) {
            reasons.push(
                `Sybil pattern: ${distinctIpsForMedicine} different reporters for "${payload.medicineName}" in last hour`
            );
            riskScore += 0.15;
        }
    }

    // 8. Pharmacy verification: reported pharmacy not in the verified registry
    if (payload.pharmacyName) {
        const { data: pharmacy, error: pharmError } = await supabase
            .from("pharmacies")
            .select("id")
            .ilike("name", `%${payload.pharmacyName}%`)
            .limit(1)
            .maybeSingle();

        if (!pharmError && !pharmacy) {
            reasons.push("Reported pharmacy is not in the verified pharmacy registry");
            riskScore += 0.1;
        }
    }

    const passed = riskScore < 0.8;

    return {
        passed,
        riskScore: Math.min(riskScore, 1.0),
        reasons,
        duplicateGroupId,
        isDuplicate,
    };
}
