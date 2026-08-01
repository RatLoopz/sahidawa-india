import { toast } from "sonner";

/**
 * Pull a human-readable message out of an error value — an `Error` instance, a
 * plain string, or an already-parsed API error body in any of the common
 * shapes: `{ error: "..." }`, `{ message: "..." }`, `{ error: { message } }`,
 * or `{ errors: [...] }`.
 *
 * Purely synchronous, so a `Response` body must be read (`await res.json()`) by
 * the caller before passing the parsed value here. Never returns an object, so
 * it is safe to pass straight into `new Error(...)` or a toast.
 */
export function parseApiErrorString(error: unknown, fallback: string): string {
    if (error && typeof error === "object" && !(error instanceof Error)) {
        const anyError = error as Record<string, unknown>;

        if (typeof anyError.error === "string") return anyError.error;
        if (typeof anyError.message === "string") return anyError.message;

        if (anyError.error && typeof anyError.error === "object") {
            const nested = anyError.error as { message?: unknown };
            if (typeof nested.message === "string") return nested.message;
        }

        if (Array.isArray(anyError.errors)) {
            const joined = anyError.errors
                .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message))
                .filter(Boolean)
                .join(" ");
            if (joined) return joined;
        }

        return fallback;
    }

    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return fallback;
}

export async function handleApiError(
    error: unknown,
    fallbackMessage = "Something went wrong"
): Promise<void> {
    try {
        if (process.env.NODE_ENV === "development") {
            console.error(error);
        }

        if (error instanceof Response) {
            try {
                const data = await error.clone().json();
                toast.error(parseApiErrorString(data, fallbackMessage));
                return;
            } catch {
                toast.error(fallbackMessage);
                return;
            }
        }

        toast.error(parseApiErrorString(error, fallbackMessage));
    } catch {
        toast.error(fallbackMessage);
    }
}
