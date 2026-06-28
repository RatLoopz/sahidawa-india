import type { VerifiedMedicine, VerifyResult } from "./api";
import { getSiteUrl } from "./env";

const DEFAULT_VERIFY_URL = getSiteUrl();

export type VerificationShareCopy = {
    realStatus: string;
    suspiciousStatus: string;
    warningPrefix: string;
    verifiedBy: string;
    batchLabel: string;
    manufacturerLabel: string;
    avoidAndReport: string;
    verifyYourself: string;
    unknownMedicine: string;
    unknownBatch: string;
    unknownManufacturer: string;
};

export type VerificationShareInput = {
    result: VerifyResult | null;
    batchNumber?: string;
    brandName?: string;
    appUrl?: string;
    copy: VerificationShareCopy;
};

function getMedicineName(
    medicine: VerifiedMedicine | null,
    fallback: string | undefined,
    copy: VerificationShareCopy
) {
    return medicine?.brand_name?.trim() || fallback?.trim() || copy.unknownMedicine;
}

function getBatchNumber(
    medicine: VerifiedMedicine | null,
    fallback: string | undefined,
    copy: VerificationShareCopy
) {
    return medicine?.batch_number?.trim() || fallback?.trim() || copy.unknownBatch;
}

export function buildVerificationShareText({
    result,
    batchNumber,
    brandName,
    appUrl = DEFAULT_VERIFY_URL,
    copy,
}: VerificationShareInput): string {
    const medicine = result?.verified ? result.medicine : null;
    const medicineName = getMedicineName(medicine, brandName, copy);
    const batch = getBatchNumber(medicine, batchNumber, copy);

    if (medicine && !medicine.is_counterfeit_alert) {
        const manufacturer = medicine.manufacturer?.trim() || copy.unknownManufacturer;

        return [
            `✅ ${medicineName} — ${copy.realStatus} ${copy.verifiedBy}`,
            `${copy.batchLabel}: ${batch} | ${copy.manufacturerLabel}: ${manufacturer}`,
            `${copy.verifyYourself}: ${appUrl}`,
        ].join("\n");
    }

    return [
        `⚠️ ${copy.warningPrefix}: ${medicineName} — ${copy.suspiciousStatus} ${copy.verifiedBy}`,
        `${copy.batchLabel}: ${batch} | ${copy.avoidAndReport}`,
    ].join("\n");
}
