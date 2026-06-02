/**
 * @jest-environment jsdom
 */

import { createElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

import { useUpload, type UploadState } from "../components/medicine/useUpload";

class MockXHR {
    static instances: MockXHR[] = [];

    upload = {
        addEventListener: jest.fn((event: string, handler: (e: ProgressEvent) => void) => {
            if (event === "progress") {
                this.progressHandler = handler;
            }
        }),
    };

    status = 200;
    responseText = JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
    });

    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;

    open = jest.fn();
    send = jest.fn();
    abort = jest.fn(() => {
        this.onabort?.();
    });

    private progressHandler: ((event: ProgressEvent) => void) | null = null;

    constructor() {
        MockXHR.instances.push(this);
    }

    simulateProgress(loaded: number, total: number) {
        this.progressHandler?.({
            lengthComputable: true,
            loaded,
            total,
        } as ProgressEvent);
    }
}

interface HarnessProps {
    onUploadComplete: (url: string) => void;
    onReady: (api: {
        upload: (file: File) => Promise<void>;
        reset: () => void;
        cancel: () => void;
        getState: () => UploadState;
    }) => void;
}

function Harness({ onUploadComplete, onReady }: HarnessProps) {
    const { state, upload, reset, cancel } = useUpload(onUploadComplete);
    const stateRef = useRef(state);
    stateRef.current = state;

    useEffect(() => {
        onReady({
            upload,
            reset,
            cancel,
            getState: () => stateRef.current,
        });
    }, [cancel, onReady, reset, upload]);

    return createElement("div", { "data-status": state.status });
}

describe("useUpload", () => {
    let root: Root;
    let container: HTMLDivElement;
    const originalXHR = global.XMLHttpRequest;
    const originalWindowXHR = typeof window !== "undefined" ? window.XMLHttpRequest : undefined;

    beforeAll(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    });

    beforeEach(() => {
        MockXHR.instances = [];
        const mock = MockXHR as unknown as typeof XMLHttpRequest;
        global.XMLHttpRequest = mock;
        if (typeof window !== "undefined") {
            window.XMLHttpRequest = mock;
        }
        globalThis.XMLHttpRequest = mock;

        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        global.XMLHttpRequest = originalXHR;
        if (typeof window !== "undefined" && originalWindowXHR) {
            window.XMLHttpRequest = originalWindowXHR;
        }
        globalThis.XMLHttpRequest = originalXHR;
    });

    async function mountHarness(onUploadComplete = jest.fn()) {
        let api: {
            upload: (file: File) => Promise<void>;
            reset: () => void;
            cancel: () => void;
            getState: () => UploadState;
        };

        await act(async () => {
            root.render(
                createElement(Harness, {
                    onUploadComplete,
                    onReady: (readyApi) => {
                        api = readyApi;
                    },
                })
            );
        });

        return { api: api!, onUploadComplete };
    }

    it("transitions idle → uploading → success and calls onUploadComplete once", async () => {
        const onUploadComplete = jest.fn();
        const { api } = await mountHarness(onUploadComplete);
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            const uploadPromise = api.upload(file);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const xhr = MockXHR.instances[0]!;
            xhr.simulateProgress(50, 100);
            xhr.onload?.();
            await uploadPromise;
        });

        expect(onUploadComplete).toHaveBeenCalledTimes(1);
        expect(onUploadComplete).toHaveBeenCalledWith(
            "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg"
        );
        expect(api.getState()).toEqual({
            status: "success",
            secureUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
        });
    });

    it("transitions to error on non-2xx responses", async () => {
        const onUploadComplete = jest.fn();
        const { api } = await mountHarness(onUploadComplete);
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            const uploadPromise = api.upload(file);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const xhr = MockXHR.instances[0]!;
            xhr.status = 500;
            xhr.responseText = JSON.stringify({ error: "Upload service unavailable" });
            xhr.onload?.();
            await uploadPromise;
        });

        expect(api.getState()).toEqual({
            status: "error",
            message: "Upload service unavailable",
        });
        expect(onUploadComplete).not.toHaveBeenCalled();
    });

    it("transitions to error on network failure", async () => {
        const { api } = await mountHarness();
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            const uploadPromise = api.upload(file);
            await new Promise((resolve) => setTimeout(resolve, 0));
            MockXHR.instances[0]?.onerror?.();
            await uploadPromise;
        });

        expect(api.getState()).toEqual({
            status: "error",
            message: "Network error during upload",
        });
    });

    it("cancel aborts in-flight XHR and returns to idle without calling onUploadComplete", async () => {
        const onUploadComplete = jest.fn();
        const { api } = await mountHarness(onUploadComplete);
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            void api.upload(file);
        });

        expect(api.getState().status).toBe("uploading");

        act(() => {
            api.cancel();
        });

        expect(MockXHR.instances[0]?.abort).toHaveBeenCalled();
        expect(api.getState()).toEqual({ status: "idle" });
        expect(onUploadComplete).not.toHaveBeenCalled();
    });

    it("reset returns to idle from error state", async () => {
        const { api } = await mountHarness();
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            const uploadPromise = api.upload(file);
            await new Promise((resolve) => setTimeout(resolve, 0));
            const xhr = MockXHR.instances[0]!;
            xhr.status = 500;
            xhr.responseText = JSON.stringify({ error: "Upload failed" });
            xhr.onload?.();
            await uploadPromise;
        });

        act(() => {
            api.reset();
        });

        expect(api.getState()).toEqual({ status: "idle" });
    });

    it("ignores upload when not idle", async () => {
        const { api } = await mountHarness();
        const file = { type: "image/jpeg", size: 100 } as File;

        await act(async () => {
            void api.upload(file);
        });

        expect(api.getState().status).toBe("uploading");

        await act(async () => {
            await api.upload(file);
        });

        expect(MockXHR.instances).toHaveLength(1);
    });
});
