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
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePendingSearchQueue } from "@/hooks/usePendingSearchQueue";
import { getSearchQueue, removeFromSearchQueue } from "@/lib/db/searchQueue";
import { toast } from "sonner";

jest.mock("@/lib/db/searchQueue", () => ({
    getSearchQueue: jest.fn(),
    removeFromSearchQueue: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const entries = [
    { id: "old", query: "same", timestamp: 1 },
    { id: "new", query: "same", timestamp: 2 },
    { id: "third", query: "other", timestamp: 0 },
];

describe("usePendingSearchQueue", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSearchQueue as jest.Mock).mockResolvedValue(entries);
        (removeFromSearchQueue as jest.Mock).mockResolvedValue(undefined);
    });

    it("executes and removes only the most recent entry on repeated online events", async () => {
        let resolveExecution!: () => void;
        const onSync = jest.fn(() => new Promise<void>((resolve) => (resolveExecution = resolve)));
        const { result } = renderHook(() => usePendingSearchQueue(onSync));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            window.dispatchEvent(new Event("online"));
            window.dispatchEvent(new Event("online"));
        });
        await waitFor(() => expect(onSync).toHaveBeenCalledWith("same"));
        expect(onSync).toHaveBeenCalledTimes(1);

        await act(async () => resolveExecution());
        await waitFor(() => expect(removeFromSearchQueue).toHaveBeenCalledWith("new"));
        expect(getSearchQueue).toHaveBeenCalledTimes(3);
    });

    it("keeps an entry when automatic execution fails", async () => {
        const onSync = jest.fn().mockRejectedValue(new Error("failed"));
        renderHook(() => usePendingSearchQueue(onSync));
        await act(async () => window.dispatchEvent(new Event("online")));
        await waitFor(() => expect(onSync).toHaveBeenCalled());
        expect(removeFromSearchQueue).not.toHaveBeenCalled();
    });

    it("allows only one queued item to execute at a time", async () => {
        let resolveExecution!: () => void;
        const onSync = jest.fn(() => new Promise<void>((resolve) => (resolveExecution = resolve)));
        const { result } = renderHook(() => usePendingSearchQueue(onSync));
        await waitFor(() => expect(result.current.pendingSearches).toEqual(entries));

        let firstExecution!: Promise<boolean>;
        let secondResult!: boolean;
        act(() => {
            firstExecution = result.current.execute(entries[0]);
        });
        await waitFor(() => expect(result.current.executingId).toBe("old"));
        await act(async () => {
            secondResult = await result.current.execute(entries[2]);
        });

        expect(secondResult).toBe(false);
        expect(onSync).toHaveBeenCalledTimes(1);
        expect(onSync).toHaveBeenCalledWith("same");
        await act(async () => resolveExecution());
        await expect(firstExecution).resolves.toBe(true);
        expect(removeFromSearchQueue).toHaveBeenCalledWith("old");
    });

    it("returns success after deletion when the subsequent refresh fails", async () => {
        (getSearchQueue as jest.Mock)
            .mockResolvedValueOnce(entries)
            .mockRejectedValueOnce(new Error("refresh failed"));
        const onSync = jest.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => usePendingSearchQueue(onSync));
        await waitFor(() => expect(result.current.pendingSearches).toEqual(entries));

        let succeeded!: boolean;
        await act(async () => {
            succeeded = await result.current.execute(entries[1]);
        });

        expect(succeeded).toBe(true);
        expect(removeFromSearchQueue).toHaveBeenCalledWith("new");
        expect(result.current.pendingSearches.map(({ id }) => id)).toEqual(["old", "third"]);
        expect(toast.error).toHaveBeenCalledWith("Could not load saved searches");
        expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Could not run"));
    });

    it("does not reload the queue when an inline callback changes identity", async () => {
        const { rerender } = renderHook(
            ({ version }) => {
                const onSync = jest.fn(() => version);
                return usePendingSearchQueue(onSync);
            },
            { initialProps: { version: 1 } }
        );
        await waitFor(() => expect(getSearchQueue).toHaveBeenCalledTimes(1));

        rerender({ version: 2 });

        await act(async () => Promise.resolve());
        expect(getSearchQueue).toHaveBeenCalledTimes(1);
    });
});
