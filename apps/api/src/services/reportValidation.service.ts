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

    const { data: rpcResult, error } = await supabase.rpc("validate_report_submission", {
        p_report_hash: reportHash,
        p_medicine_name: payload.medicineName,
        p_pharmacy_name: payload.pharmacyName,
        p_city: payload.city,
        p_district: payload.district,
        p_ip_address: ipAddress || null,
        p_user_id: userId || null,
    });

    if (error) {
        logger.error("RPC validate_report_submission failed", { error });
        // Fail open on database error so legitimate reports aren't blocked entirely
        return {
            passed: true,
            riskScore: 0,
            reasons: ["Validation failed due to database error (fallback pass)"],
            isDuplicate: false,
        };
    }

    const res = rpcResult as any;

    // 1. Deduplication check
    if (res.duplicate_count > 0) {
        isDuplicate = true;
        duplicateGroupId = res.first_dup_id;
        reasons.push(
            `Duplicate report: ${res.duplicate_count} similar report(s) found in last 24h`
        );
        riskScore += 0.3 * Math.min(res.duplicate_count, 5);
    }

    // 1b. Fuzzy duplicate
    if (res.fuzzy_count > 0) {
        if (!isDuplicate) {
            isDuplicate = true;
            duplicateGroupId = res.first_fuzzy_id;
        }
        reasons.push(
            `Fuzzy duplicate: ${res.fuzzy_count} similar pharmacy name(s) found in last 24h`
        );
        riskScore += 0.2 * Math.min(res.fuzzy_count, 3);
    }

    // 2. Burst detection: IP
    if (res.ip_burst_count >= BURST_THRESHOLD_SAME_IP) {
        reasons.push(`Burst detected: ${res.ip_burst_count} reports from same IP in last hour`);
        riskScore += 0.2 * Math.min(res.ip_burst_count / BURST_THRESHOLD_SAME_IP, 3);
    }

    // 3. Burst detection: district
    if (res.district_burst_count >= BURST_THRESHOLD_SAME_DISTRICT) {
        reasons.push(
            `Burst detected: ${res.district_burst_count} reports for district "${payload.district}" in last hour`
        );
        riskScore += 0.25 * Math.min(res.district_burst_count / BURST_THRESHOLD_SAME_DISTRICT, 3);
    }

    // 4. Burst detection: medicine
    if (res.medicine_burst_count >= BURST_THRESHOLD_SAME_MEDICINE) {
        reasons.push(
            `Burst detected: ${res.medicine_burst_count} reports for "${payload.medicineName}" in last hour`
        );
        riskScore += 0.2 * Math.min(res.medicine_burst_count / BURST_THRESHOLD_SAME_MEDICINE, 3);
    }

    // 5. Reporter reputation
    if (res.reputation_count >= 2) {
        reasons.push(`Low reputation: reporter has ${res.reputation_count} false alarm(s)`);
        riskScore += 0.15 * Math.min(res.reputation_count, 5);
    }

    // 6. Geographic diversity
    if (res.geo_count >= 3) {
        reasons.push(
            `Suspicious geographic spread: IP reported in ${res.geo_count} different districts`
        );
        riskScore += 0.15 * Math.min(res.geo_count / 3, 3);
    }

    // 7. Sybil detection: district and medicine
    if (res.sybil_district_count >= 8) {
        reasons.push(
            `Sybil pattern: ${res.sybil_district_count} different reporters for district "${payload.district}" in last hour`
        );
        riskScore += 0.2;
    }

    if (res.sybil_medicine_count >= 5) {
        reasons.push(
            `Sybil pattern: ${res.sybil_medicine_count} different reporters for "${payload.medicineName}" in last hour`
        );
        riskScore += 0.15;
    }

    // 8. Pharmacy verification
    if (payload.pharmacyName && !res.pharmacy_valid) {
        reasons.push("Reported pharmacy is not in the verified pharmacy registry");
        riskScore += 0.1;
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
