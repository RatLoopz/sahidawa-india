const DEFAULT_API_ORIGIN = "http://localhost:4000";
const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_ORIGIN).trim();

export const API_BASE = configuredApiUrl.replace(/\/+$/, "");
