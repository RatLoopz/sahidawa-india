/**
 * @jest-environment jsdom
 */

import { act, createElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useOfflineStatus } from "../hooks/useOfflineStatus";

interface HarnessProps {
    onReady: (api: { getState: () => ReturnType<typeof useOfflineStatus> }) => void;
}

function Harness({ onReady }: HarnessProps) {
    const hook = useOfflineStatus();

    const stateRef = useRef(hook);
    stateRef.current = hook;

    useEffect(() => {
        onReady({
            getState: () => stateRef.current,
        });
    }, [hook, onReady]);

    return createElement("div");
}

describe("useOfflineStatus", () => {
    let root: Root;
    let container: HTMLDivElement;

    beforeEach(() => {
        jest.useFakeTimers();

        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });

        container.remove();
        jest.clearAllMocks();
        jest.useRealTimers();

        window.history.pushState({}, "", "/");
    });

    async function renderHarness() {
        let api!: {
            getState: () => ReturnType<typeof useOfflineStatus>;
        };

        await act(async () => {
            root.render(
                createElement(Harness, {
                    onReady: (readyApi) => {
                        api = readyApi;
                    },
                })
            );
        });

        return api;
    }

    it("uses navigator online state on mount", async () => {
        Object.defineProperty(window.navigator, "onLine", {
            configurable: true,
            value: true,
        });

        const api = await renderHarness();

        expect(api.getState().isOffline).toBe(false);
    });

    it("sets offline state when offline event occurs", async () => {
        const api = await renderHarness();

        act(() => {
            window.dispatchEvent(new Event("offline"));
        });

        expect(api.getState().isOffline).toBe(true);
        expect(api.getState().isStatusDirty).toBe(true);
    });

    it("sets online state when online event occurs", async () => {
        const api = await renderHarness();

        act(() => {
            window.dispatchEvent(new Event("offline"));
        });

        expect(api.getState().isOffline).toBe(true);

        act(() => {
            window.dispatchEvent(new Event("online"));
        });

        expect(api.getState().isOffline).toBe(false);
    });

    it("executes registered retry callbacks when returning online", async () => {
        const api = await renderHarness();

        const retryCallback = jest.fn();

        act(() => {
            api.getState().registerRetryCallback(retryCallback);
        });

        act(() => {
            window.dispatchEvent(new Event("online"));
        });

        expect(retryCallback).toHaveBeenCalledTimes(1);
    });

    it("does not execute unregistered retry callbacks", async () => {
        const api = await renderHarness();

        const retryCallback = jest.fn();

        act(() => {
            api.getState().registerRetryCallback(retryCallback);
            api.getState().unregisterRetryCallback(retryCallback);
        });

        act(() => {
            window.dispatchEvent(new Event("online"));
        });

        expect(retryCallback).not.toHaveBeenCalled();
    });

    it("enables test mode through offline query parameter", async () => {
        window.history.pushState({}, "", "?offline=true");

        const api = await renderHarness();

        expect(api.getState().isTestMode).toBe(true);
        expect(api.getState().isOffline).toBe(true);
    });

    it("resets status dirty flag after one second when returning online", async () => {
        const api = await renderHarness();

        act(() => {
            window.dispatchEvent(new Event("online"));
        });

        expect(api.getState().isStatusDirty).toBe(true);

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(api.getState().isStatusDirty).toBe(false);
    });
});
