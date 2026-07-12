import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { readChatErrorMessage, readTextResponseStream } from "../lib/chatStream";

function streamFrom(chunks: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

describe("readTextResponseStream", () => {
    it("appends decoded response chunks as they arrive", async () => {
        const onChunk = jest.fn();

        const result = await readTextResponseStream(
            new Response(streamFrom(["Hello", " streaming", " chat"])),
            onChunk
        );

        expect(result).toBe("Hello streaming chat");
        expect(onChunk).toHaveBeenNthCalledWith(1, "Hello");
        expect(onChunk).toHaveBeenNthCalledWith(2, " streaming");
        expect(onChunk).toHaveBeenNthCalledWith(3, " chat");
    });

    it("throws a useful error when a response has no readable body", async () => {
        await expect(readTextResponseStream(new Response(null), jest.fn())).rejects.toThrow(
            "AI response stream is unavailable."
        );
    });

    it("stops without appending chunks when the stream is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        const onChunk = jest.fn();

        await expect(
            readTextResponseStream(new Response(streamFrom(["late chunk"])), onChunk, {
                signal: controller.signal,
            })
        ).rejects.toMatchObject({ name: "AbortError" });
        expect(onChunk).not.toHaveBeenCalled();
    });
});

describe("readChatErrorMessage", () => {
    it("uses an API error message from a JSON response", async () => {
        await expect(
            readChatErrorMessage(
                Response.json({ error: "Too many requests. Please wait." }, { status: 429 }),
                "Fallback error"
            )
        ).resolves.toBe("Too many requests. Please wait.");
    });

    it("falls back when the error body is not JSON", async () => {
        await expect(
            readChatErrorMessage(new Response("not json", { status: 500 }), "Fallback error")
        ).resolves.toBe("Fallback error");
    });
});
