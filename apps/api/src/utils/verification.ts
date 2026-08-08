/**
 * Medicine verification helpers.
 *
 * Centralizes the business rule that decides whether a medicine record is
 * reported as "verified" to clients. Used by the verify-brand endpoints so the
 * verdict is always derived from the actual medicine status instead of being
 * hardcoded.
 */

export interface VerificationFields {
    is_cdsco_verified?: boolean | null;
    is_counterfeit_alert?: boolean | null;
}

/**
 * Compute the top-level `verified` status for a medicine.
 *
 * A medicine is reported as verified only when its data has been matched
 * against the CDSCO database (`is_cdsco_verified`) AND it has no active
 * counterfeit alert (`is_counterfeit_alert`).
 */
export function computeVerifiedStatus(medicine: VerificationFields): boolean {
    return medicine.is_cdsco_verified === true && medicine.is_counterfeit_alert !== true;
}
