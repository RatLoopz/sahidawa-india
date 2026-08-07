import { z } from "zod";

/**
 * Standard page-based pagination schema.
 * Coerces string query params to numbers and applies sensible defaults/clamps.
 *
 * Usage:
 *   const { page, limit } = paginationSchema.parse(req.query);
 *   const offset = (page - 1) * limit;
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Cursor-based pagination schema for keyset pagination.
 * Returns `limit` and an optional opaque `cursor` string.
 */
export const cursorPaginationSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Generic paginated response wrapper.
 * Use this as the return type for paginated endpoints.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PaginatedResponse<T> {
    data: T[];
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPageCount: number;
    nextCursor?: string;
}
