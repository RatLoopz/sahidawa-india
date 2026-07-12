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
/**
 * @jest-environment jsdom
 */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useOnlineRetry } from "../hooks/useOnlineRetry";
import { offlineRequestQueue } from "../lib/apiWithRetry";
import { toast } from "sonner";

const registerRetryCallback = jest.fn();
const unregisterRetryCallback = jest.fn();

jest.mock("../hooks/useOfflineStatus", () => ({
    useOfflineStatus: () => ({
        registerRetryCallback,
        unregisterRetryCallback,
    }),
}));

jest.mock("sonner", () => ({
    toast: {
        loading: jest.fn(),
        success: jest.fn(),
        error: jest.fn(),
        dismiss: jest.fn(),
    },
}));

function Harness() {
    useOnlineRetry();
    return createElement("div");
}

describe("useOnlineRetry", () => {
    let root: Root;
    let container: HTMLDivElement;

    beforeEach(() => {
        jest.clearAllMocks();

        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });

        container.remove();
    });

    it("registers retry callback on mount", async () => {
        await act(async () => {
            root.render(createElement(Harness));
        });

        expect(registerRetryCallback).toHaveBeenCalledTimes(1);
        expect(registerRetryCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it("unregisters retry callback on unmount", async () => {
        await act(async () => {
            root.render(createElement(Harness));
        });

        act(() => {
            root.unmount();
        });

        expect(unregisterRetryCallback).toHaveBeenCalledTimes(1);
        expect(unregisterRetryCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it("retries queued requests successfully", async () => {
        const queuedRequest = {
            id: "req-1",
            url: "/api/test",
            options: { method: "GET" },
            timestamp: Date.now(),
            retryCount: 0,
        };

        jest.spyOn(offlineRequestQueue, "getAll").mockReturnValue([queuedRequest]);
        const removeSpy = jest.spyOn(offlineRequestQueue, "remove");

        (toast.loading as jest.Mock).mockReturnValue("toast-id");

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
        } as Response);

        await act(async () => {
            root.render(createElement(Harness));
        });

        const retryCallback = registerRetryCallback.mock.calls[0][0];

        await act(async () => {
            await retryCallback();
        });

        expect(fetch).toHaveBeenCalledWith(queuedRequest.url, queuedRequest.options);

        expect(removeSpy).toHaveBeenCalledWith("req-1");

        expect(toast.success).toHaveBeenCalledWith("1 request(s) retried successfully", {
            id: "toast-id",
        });
    });

    it("shows error toast when request retry fails", async () => {
        const queuedRequest = {
            id: "req-1",
            url: "/api/test",
            options: { method: "GET" },
            timestamp: Date.now(),
            retryCount: 0,
        };

        jest.spyOn(offlineRequestQueue, "getAll").mockReturnValue([queuedRequest]);

        (toast.loading as jest.Mock).mockReturnValue("toast-id");

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
        } as Response);

        await act(async () => {
            root.render(createElement(Harness));
        });

        const retryCallback = registerRetryCallback.mock.calls[0][0];

        await act(async () => {
            await retryCallback();
        });

        expect(toast.error).toHaveBeenCalledWith("0 succeeded, 1 failed to retry", {
            id: "toast-id",
        });
    });

    it("re-registers callback when queue is empty", async () => {
        jest.spyOn(offlineRequestQueue, "getAll").mockReturnValue([]);

        await act(async () => {
            root.render(createElement(Harness));
        });

        const retryCallback = registerRetryCallback.mock.calls[0][0];

        await act(async () => {
            await retryCallback();
            await Promise.resolve();
        });

        expect(registerRetryCallback).toHaveBeenCalledTimes(2);
    });
});
