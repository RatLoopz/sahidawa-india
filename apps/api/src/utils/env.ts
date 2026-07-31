/**
 * Cloud-platform env vars that are always present once the app is deployed,
 * regardless of how NODE_ENV was configured for that deploy. Mirrors the guard
 * in src/index.ts: NODE_ENV alone is not a reliable signal that the process is
 * running on a developer's machine, because it is trivially set to
 * "development" in cloud/staging environments.
 */
const CLOUD_PLATFORM_ENV_VARS = [
    "RAILWAY_ENVIRONMENT_NAME",
    "VERCEL",
    "RENDER",
    "FLY_APP_NAME",
    "AWS_EXECUTION_ENV",
    "KUBERNETES_SERVICE_HOST",
    "DYNO", // Heroku
];

/**
 * True only on a genuine local development machine.
 *
 * Used to decide whether SMS/WhatsApp deliveries may be mocked when provider
 * credentials are missing. Mocks must never run in production — a mocked
 * delivery would otherwise be reported as successful even though no message
 * reaches the recipient.
 */
export function isLocalDevelopment(): boolean {
    return (
        process.env.NODE_ENV === "development" &&
        !CLOUD_PLATFORM_ENV_VARS.some((key) => Boolean(process.env[key]))
    );
}
