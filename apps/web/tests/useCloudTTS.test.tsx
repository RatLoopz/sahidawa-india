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

import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";

import { useCloudTTS } from "../app/[locale]/voice/lib/useCloudTTS";
import { handleApiError } from "../lib/apiErrorHandler";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class TestMessagePort {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    pairedPort: TestMessagePort | null = null;

    postMessage(data: unknown) {
        this.pairedPort?.onmessage?.({ data });
    }

    start() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
}

class TestMessageChannel {
    port1 = new TestMessagePort();
    port2 = new TestMessagePort();

    constructor() {
        this.port1.pairedPort = this.port2;
        this.port2.pairedPort = this.port1;
    }
}

global.MessageChannel = TestMessageChannel as unknown as typeof MessageChannel;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");

jest.mock("../lib/apiErrorHandler", () => ({
    handleApiError: jest.fn(),
}));

type CloudTTSApi = ReturnType<typeof useCloudTTS>;

class MockAudio {
    static instances: MockAudio[] = [];

    src = "";
    currentTime = 0;
    onplay: ((event: Event) => void) | null = null;
    onended: ((event: Event) => void) | null = null;
    onerror: ((event: Event | string) => void | Promise<void>) | null = null;
    pause = jest.fn();
    play = jest.fn(async () => {
        this.onplay?.(new Event("play"));
    });

    constructor() {
        MockAudio.instances.push(this);
    }
}

function HookHarness({ onReady }: { onReady: (api: CloudTTSApi) => void }) {
    const api = useCloudTTS();

    useEffect(() => {
        onReady(api);
    }, [api, onReady]);

    return createElement("div");
}

describe("useCloudTTS", () => {
    let root: Root;
    let container: HTMLDivElement;
    let api: CloudTTSApi;
    let isMounted: boolean;
    let objectUrlCount: number;
    let createObjectURLSpy: jest.Mock;
    let revokeObjectURLSpy: jest.Mock;

    const renderHook = async () => {
        await act(async () => {
            root.render(createElement(HookHarness, { onReady: (value) => (api = value) }));
        });
    };

    const playTTS = async () => {
        await act(async () => {
            await api.playTTS("Take rest and drink water", "en-IN");
        });
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        MockAudio.instances = [];
        objectUrlCount = 0;

        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        isMounted = true;

        global.Audio = MockAudio as unknown as typeof Audio;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                audio_base64: "YQ==",
                language_code: "en-IN",
                provider: "test",
                cached: false,
                character_count: 27,
            }),
        } as Response);

        createObjectURLSpy = jest.fn(() => {
            objectUrlCount += 1;
            return `blob:cloud-tts-${objectUrlCount}`;
        });
        revokeObjectURLSpy = jest.fn();
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            writable: true,
            value: createObjectURLSpy,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            writable: true,
            value: revokeObjectURLSpy,
        });
        jest.spyOn(console, "error").mockImplementation(() => {});

        await renderHook();
    });

    afterEach(() => {
        if (isMounted) {
            act(() => {
                root.unmount();
            });
        }
        container.remove();
        jest.restoreAllMocks();
    });

    it("revokes the active object URL when playback ends", async () => {
        await playTTS();

        act(() => {
            MockAudio.instances[0].onended?.(new Event("ended"));
        });

        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:cloud-tts-1");
    });

    it("revokes the active object URL when playback errors", async () => {
        await playTTS();

        await act(async () => {
            await MockAudio.instances[0].onerror?.(new Event("error"));
        });

        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:cloud-tts-1");
        expect(handleApiError).toHaveBeenCalledWith(expect.any(Error), "Failed to play audio");
    });

    it("revokes the active object URL when playback is stopped", async () => {
        await playTTS();

        act(() => {
            api.stopTTS();
        });

        expect(MockAudio.instances[0].pause).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:cloud-tts-1");
    });

    it("revokes the previous object URL before replacing the audio source", async () => {
        await playTTS();
        await playTTS();

        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:cloud-tts-1");
        expect(MockAudio.instances[1].src).toBe("blob:cloud-tts-2");
    });

    it("revokes the active object URL on unmount", async () => {
        await playTTS();

        act(() => {
            root.unmount();
        });
        isMounted = false;

        expect(MockAudio.instances[0].pause).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:cloud-tts-1");
    });

    it("does not revoke the same object URL twice", async () => {
        await playTTS();

        act(() => {
            MockAudio.instances[0].onended?.(new Event("ended"));
            api.stopTTS();
        });

        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    });
});
