import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

import { renderHook, act } from "@testing-library/react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

import { toast } from "sonner";

describe("useCopyToClipboard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });

        jest.clearAllTimers();
        jest.useRealTimers();
    });
    it("copies text successfully", async () => {
        const writeText: jest.MockedFunction<(text: string) => Promise<void>> = jest.fn();

        writeText.mockResolvedValue(undefined);

        Object.assign(navigator, {
            clipboard: {
                writeText,
            },
        });

        const { result } = renderHook(() => useCopyToClipboard());

        let copied = false;

        await act(async () => {
            copied = await result.current[1]("hello");
        });

        expect(copied).toBe(true);
        expect(writeText).toHaveBeenCalledWith("hello");
        expect(toast.success).toHaveBeenCalled();
        expect(result.current[0]).toBe(true);
    });

    it("resets copied state after delay", async () => {
        const writeText: jest.MockedFunction<(text: string) => Promise<void>> = jest.fn();
        writeText.mockResolvedValue(undefined);

        Object.assign(navigator, {
            clipboard: {
                writeText,
            },
        });

        const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 1000 }));

        await act(async () => {
            await result.current[1]("hello");
        });

        expect(result.current[0]).toBe(true);

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current[0]).toBe(false);
    });

    it("returns false for empty text", async () => {
        const { result } = renderHook(() => useCopyToClipboard());

        let copied = true;

        await act(async () => {
            copied = await result.current[1]("");
        });

        expect(copied).toBe(false);
    });

    it("handles clipboard write failure", async () => {
        const writeText: jest.MockedFunction<(text: string) => Promise<void>> = jest.fn();
        writeText.mockRejectedValue(new Error("Failed"));

        Object.assign(navigator, {
            clipboard: {
                writeText,
            },
        });

        const { result } = renderHook(() => useCopyToClipboard());

        let copied = true;

        await act(async () => {
            copied = await result.current[1]("hello");
        });

        expect(copied).toBe(false);
        expect(writeText).toHaveBeenCalledWith("hello");
        expect(toast.error).toHaveBeenCalled();
    });

    it("shows the custom success message", async () => {
        const writeText: jest.MockedFunction<(text: string) => Promise<void>> = jest.fn();
        writeText.mockResolvedValue(undefined);

        Object.assign(navigator, {
            clipboard: { writeText },
        });

        const { result } = renderHook(() =>
            useCopyToClipboard({
                successMessage: "Copied successfully!",
            })
        );

        await act(async () => {
            await result.current[1]("Hello");
        });

        expect(toast.success).toHaveBeenCalledWith("Copied successfully!");
    });

    it("shows the custom error message when copying fails", async () => {
        const writeText: jest.MockedFunction<(text: string) => Promise<void>> = jest.fn();
        writeText.mockRejectedValue(new Error("Clipboard failed"));

        Object.assign(navigator, {
            clipboard: { writeText },
        });

        document.execCommand = jest.fn(() => false) as typeof document.execCommand;

        const { result } = renderHook(() =>
            useCopyToClipboard({
                errorMessage: "Unable to copy",
            })
        );

        await act(async () => {
            const copied = await result.current[1]("Hello");
            expect(copied).toBe(false);
        });

        expect(toast.error).toHaveBeenCalledWith("Unable to copy");
    });

    it("uses the fallback copy mechanism when Clipboard API is unavailable", async () => {
        Object.assign(navigator, {
            clipboard: undefined,
        });

        document.execCommand = jest.fn(() => true) as typeof document.execCommand;

        const { result } = renderHook(() => useCopyToClipboard());

        await act(async () => {
            const copied = await result.current[1]("Fallback");
            expect(copied).toBe(true);
        });

        expect(document.execCommand).toHaveBeenCalledWith("copy");
        expect(toast.success).toHaveBeenCalled();
    });
});
