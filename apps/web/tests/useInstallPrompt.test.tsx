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

import { act, createElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useInstallPrompt } from "../hooks/useInstallPrompt";

interface HarnessProps {
    onReady: (api: { getState: () => ReturnType<typeof useInstallPrompt> }) => void;
}

function Harness({ onReady }: HarnessProps) {
    const hook = useInstallPrompt();

    const stateRef = useRef(hook);
    stateRef.current = hook;

    useEffect(() => {
        onReady({
            getState: () => stateRef.current,
        });
    }, [hook, onReady]);

    return createElement("div");
}

describe("useInstallPrompt", () => {
    let root: Root;
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);

        Object.defineProperty(window.navigator, "standalone", {
            configurable: true,
            value: false,
        });

        window.matchMedia = jest.fn().mockReturnValue({
            matches: false,
            media: "",
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });

        container.remove();
        jest.restoreAllMocks();
    });

    async function renderHarness() {
        let api!: {
            getState: () => ReturnType<typeof useInstallPrompt>;
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

    it("is not installable initially", async () => {
        const api = await renderHarness();

        expect(api.getState().isInstallable).toBe(false);
        expect(api.getState().isInstalled).toBe(false);
    });

    it("detects standalone mode as installed", async () => {
        window.matchMedia = jest.fn().mockReturnValue({
            matches: true,
            media: "(display-mode: standalone)",
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        });

        const api = await renderHarness();

        expect(api.getState().isInstalled).toBe(true);
    });

    it("becomes installable after beforeinstallprompt event", async () => {
        const api = await renderHarness();

        const promptEvent = new Event("beforeinstallprompt");
        promptEvent.preventDefault = jest.fn();

        await act(async () => {
            window.dispatchEvent(promptEvent);
        });

        expect(promptEvent.preventDefault).toHaveBeenCalled();
        expect(api.getState().isInstallable).toBe(true);
    });

    it("handles appinstalled event", async () => {
        const api = await renderHarness();

        const promptEvent = new Event("beforeinstallprompt");
        promptEvent.preventDefault = jest.fn();

        await act(async () => {
            window.dispatchEvent(promptEvent);
        });

        expect(api.getState().isInstallable).toBe(true);

        await act(async () => {
            window.dispatchEvent(new Event("appinstalled"));
        });

        expect(api.getState().isInstallable).toBe(false);
        expect(api.getState().isInstalled).toBe(true);
    });

    it("returns null when promptInstall is called without a deferred prompt", async () => {
        const api = await renderHarness();

        let result: "accepted" | "dismissed" | null = null;

        await act(async () => {
            result = await api.getState().promptInstall();
        });

        expect(result).toBeNull();
    });

    it("prompts installation and returns accepted outcome", async () => {
        const api = await renderHarness();

        const prompt = jest.fn().mockResolvedValue(undefined);

        const installEvent = new Event("beforeinstallprompt") as Event & {
            prompt: jest.Mock;
            userChoice: Promise<{
                outcome: "accepted";
                platform: string;
            }>;
            platforms: string[];
        };

        installEvent.preventDefault = jest.fn();
        installEvent.prompt = prompt;
        installEvent.platforms = ["web"];
        installEvent.userChoice = Promise.resolve({
            outcome: "accepted",
            platform: "web",
        });

        await act(async () => {
            window.dispatchEvent(installEvent);
        });

        let result: "accepted" | "dismissed" | null = null;

        await act(async () => {
            result = await api.getState().promptInstall();
        });

        expect(prompt).toHaveBeenCalledTimes(1);
        expect(result).toBe("accepted");
        expect(api.getState().isInstallable).toBe(false);
    });

    it("removes event listeners on unmount", async () => {
        const addEventListenerSpy = jest.spyOn(window, "addEventListener");
        const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

        await renderHarness();

        expect(addEventListenerSpy).toHaveBeenCalledWith(
            "beforeinstallprompt",
            expect.any(Function)
        );

        expect(addEventListenerSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));

        act(() => {
            root.unmount();
        });

        expect(removeEventListenerSpy).toHaveBeenCalledWith(
            "beforeinstallprompt",
            expect.any(Function)
        );

        expect(removeEventListenerSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));
    });
});
