const DEFAULT_API_ORIGIN = "http://localhost:4000";
const ADMIN_API_PATH = "/api/v1/admin";

export function buildAdminApiBase(apiOrigin = process.env.NEXT_PUBLIC_API_URL): string {
    const configuredOrigin = apiOrigin?.trim();
    const normalizedOrigin = (configuredOrigin || DEFAULT_API_ORIGIN).replace(/\/+$/, "");

    if (normalizedOrigin.endsWith(ADMIN_API_PATH)) {
        return normalizedOrigin;
    }

    return `${normalizedOrigin}${ADMIN_API_PATH}`;
}

export const ADMIN_API_BASE = buildAdminApiBase();
