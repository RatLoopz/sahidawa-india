/**
 * Cross-app numeric limits and thresholds shared between apps/web and apps/api.
 *
 * Centralizing these avoids client/server drift — e.g. a UI that allows
 * selecting more items than the API is willing to accept, which previously
 * happened with the interaction checker (frontend allowed 50, backend
 * enforced 20).
 */

/** Max number of medicines a user can select in the drug interaction checker. */
export const MAX_INTERACTION_MEDICINES = 50;

/** Max number of line items accepted per bulk pharmacy inventory upload request. */
export const MAX_BULK_UPLOAD_ITEMS = 500;
