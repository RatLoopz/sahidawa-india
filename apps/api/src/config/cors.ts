import { CorsOptions } from "cors";

const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:8000",
];

function parseAllowedOrigins(value: string | undefined): string[] {
    if (!value) {
        return [];
    }

    return value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

/**
 * Builds the trusted browser origins list from defaults and deployment env vars.
 */
export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
    const configuredOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const frontendOrigin = parseAllowedOrigins(env.FRONTEND_URL);

    return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...frontendOrigin, ...configuredOrigins])];
}

/**
 * Creates Express CORS options that allow configured origins and deny unknown origins.
 */
export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
    const allowedOrigins = getAllowedOrigins(env);

    return {
        origin(origin, callback) {
            if (origin && allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(null, false);
        },
        credentials: true,
    };
}
