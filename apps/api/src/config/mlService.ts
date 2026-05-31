import logger from "../utils/logger";

const MISSING_ML_SERVICE_URL_MESSAGE =
    "ML_SERVICE_URL is not configured. Set it to the ML service origin before using ML-backed routes.";

export function getMlServiceUrl(): string | null {
    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    return configuredUrl ? configuredUrl.replace(/\/+$/, "") : null;
}

export function validateMlServiceConfig(): void {
    if (getMlServiceUrl()) return;

    const metadata = {
        missingVars: { ML_SERVICE_URL: true },
        environment: process.env.NODE_ENV || "development",
    };

    if (process.env.NODE_ENV === "production") {
        logger.error(`CRITICAL ERROR: ${MISSING_ML_SERVICE_URL_MESSAGE}`, metadata);
        process.exit(1);
    }

    logger.warn(MISSING_ML_SERVICE_URL_MESSAGE, metadata);
}

export { MISSING_ML_SERVICE_URL_MESSAGE };
