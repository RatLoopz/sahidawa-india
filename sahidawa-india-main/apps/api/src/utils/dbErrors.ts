/**
 * Maps database error codes (like PostgreSQL/Supabase) to standard HTTP status codes.
 */
export function getDbErrorStatus(code: string): number | null {
  switch (code) {
    case '23505':
      return 409; // Conflict (Unique violation)
    case '23503':
      return 422; // Unprocessable Entity (Foreign key violation)
    default:
      return null;
  }
}
