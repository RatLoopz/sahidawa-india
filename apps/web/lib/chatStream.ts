type ReadTextResponseStreamOptions = {
    signal?: AbortSignal;
};

function createAbortError() {
    if (typeof DOMException !== "undefined") {
        return new DOMException("The operation was aborted.", "AbortError");
    }

    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
}

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw createAbortError();
    }
}

export function isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
}

export async function readTextResponseStream(
    response: Response,
    onChunk: (chunk: string) => void,
    options: ReadTextResponseStreamOptions = {}
) {
    throwIfAborted(options.signal);

    const reader = response.body?.getReader();

    if (!reader) {
        throw new Error("AI response stream is unavailable.");
    }

    const decoder = new TextDecoder();
    let text = "";

    try {
        while (true) {
            throwIfAborted(options.signal);

            const { done, value } = await reader.read();

            throwIfAborted(options.signal);

            if (done) {
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
                text += chunk;
                onChunk(chunk);
            }
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
            throwIfAborted(options.signal);
            text += finalChunk;
            onChunk(finalChunk);
        }

        return text;
    } finally {
        if (options.signal?.aborted) {
            await reader.cancel().catch(() => undefined);
        }

        reader.releaseLock();
    }
}

export async function readChatErrorMessage(response: Response, fallback: string) {
    try {
        const data = await response.json();
        return typeof data.error === "string" && data.error.trim().length > 0
            ? data.error
            : fallback;
    } catch {
        return fallback;
    }
}
