/**
 * Maps database error codes (like PostgreSQL/Supabase) to standard HTTP status codes
 * and user-safe messages that don't leak internal schema details.
 */

interface DbErrorInfo {
    status: number;
    clientMessage: string;
}

const DB_ERROR_MAP: Record<string, DbErrorInfo> = {
    "23505": {
        status: 409,
        clientMessage: "A record with the same value already exists.",
    },
    "23503": {
        status: 422,
        clientMessage: "The operation could not be completed due to a conflicting reference.",
    },
};

export function getDbErrorStatus(code: string): number | null {
    return DB_ERROR_MAP[code]?.status ?? null;
}

export function getDbErrorMessage(code: string): string | null {
    return DB_ERROR_MAP[code]?.clientMessage ?? null;
}
