/**
 * Shared pagination utilities for standardized paginated responses.
 *
 * Usage:
 *   const result = await cursorPaginate(query, { cursor, limit, orderBy: 'created_at' });
 *   // Returns { data, nextCursor, hasMore, total? }
 */

export interface PaginatedResponse<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
}

export interface CursorPaginationOptions {
    /** Cursor value (the value of the ordering column from the last item) */
    cursor?: string;
    /** Number of items per page (default: 20, max: 100) */
    limit?: number;
    /** Column to order by (default: 'created_at') */
    orderBy?: string;
    /** Sort direction (default: 'desc') */
    orderDirection?: 'asc' | 'desc';
}

export interface OffsetPaginationOptions {
    /** Page number (1-based, default: 1) */
    page?: number;
    /** Number of items per page (default: 20, max: 100) */
    limit?: number;
    /** Column to order by (default: 'created_at') */
    orderBy?: string;
    /** Sort direction (default: 'desc') */
    orderDirection?: 'asc' | 'desc';
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Normalize and validate pagination limit.
 */
function normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) return DEFAULT_LIMIT;
    return Math.min(limit, MAX_LIMIT);
}

/**
 * Parse a cursor value. Returns null if invalid.
 */
function parseCursor(cursor?: string): string | null {
    if (!cursor || cursor.trim() === '') return null;
    return cursor;
}

/**
 * Cursor-based pagination for Supabase queries.
 *
 * @param queryBuilder - A Supabase query builder (must return a chainable object)
 * @param options - Pagination options
 * @returns Paginated response with data, nextCursor, and hasMore
 *
 * @example
 *   const result = await cursorPaginate(
 *     supabase.from('reports'),
 *     { cursor: lastCreatedAt, limit: 20, orderBy: 'created_at' }
 *   );
 */
export function buildCursorQuery<T extends Record<string, unknown>>(
    baseQuery: { select: (cols: string) => any },
    selectColumns: string,
    options: CursorPaginationOptions = {}
): { query: any; limit: number; orderColumn: string; orderDirection: string } {
    const limit = normalizeLimit(options.limit);
    const orderColumn = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';
    const cursor = parseCursor(options.cursor);

    let query = baseQuery.select(selectColumns);

    // Apply cursor filter (exclusive: we want items AFTER the cursor)
    if (cursor) {
        if (orderDirection === 'desc') {
            query = query.lt(orderColumn, cursor);
        } else {
            query = query.gt(orderColumn, cursor);
        }
    }

    // Apply ordering and limit (+1 to detect if there are more items)
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });
    query = query.limit(limit + 1);

    return { query, limit, orderColumn, orderDirection };
}

/**
 * Process cursor pagination results - extracts the extra row to determine hasMore.
 */
export function processCursorResults<T extends Record<string, unknown>>(
    data: T[] | null,
    limit: number,
    orderColumn: string
): PaginatedResponse<T> {
    if (!data || data.length === 0) {
        return { data: [], nextCursor: null, hasMore: false };
    }

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? String(lastItem[orderColumn]) : null;

    return { data: items, nextCursor, hasMore };
}

/**
 * Offset-based pagination helper.
 * Returns query parameters to apply to a Supabase query.
 */
export function getOffsetParams(options: OffsetPaginationOptions = {}): {
    offset: number;
    limit: number;
    page: number;
    orderColumn: string;
    orderDirection: string;
} {
    const limit = normalizeLimit(options.limit);
    const page = Math.max(1, options.page || 1);
    const offset = (page - 1) * limit;
    const orderColumn = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';

    return { offset, limit, page, orderColumn, orderDirection };
}

/**
 * Process offset pagination results with a total count query.
 */
export function processOffsetResults<T>(
    data: T[] | null,
    total: number | null,
    page: number,
    limit: number
): PaginatedResponse<T> {
    const totalPages = total ? Math.ceil(total / limit) : 0;

    return {
        data: data || [],
        nextCursor: page < totalPages ? String(page + 1) : null,
        hasMore: page < totalPages,
        total: total || 0,
    };
}

/**
 * Validate that a cursor string is a valid ISO timestamp or UUID.
 */
export function isValidCursor(cursor: string): boolean {
    // Accept ISO timestamps or UUIDs
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return isoRegex.test(cursor) || uuidRegex.test(cursor);
}
