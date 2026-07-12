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

import { act } from "react";
import { createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useOnClickOutside } from "../hooks/useOnClickOutside";

interface HarnessProps {
    handler: jest.Mock;
    enabled?: boolean;
    targetRef: React.RefObject<HTMLDivElement | null>;
}

function Harness({ handler, enabled = true, targetRef }: HarnessProps) {
    useOnClickOutside(targetRef, handler, enabled);

    return createElement(
        "div",
        null,
        createElement("div", {
            ref: targetRef,
            "data-testid": "inside",
        })
    );
}

describe("useOnClickOutside", () => {
    let root: Root;
    let container: HTMLDivElement;

    beforeEach(() => {
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
    });

    async function renderHarness(handler = jest.fn(), enabled = true) {
        const targetRef = createRef<HTMLDivElement>();

        await act(async () => {
            root.render(
                createElement(Harness, {
                    handler,
                    enabled,
                    targetRef,
                })
            );
        });

        return {
            handler,
            targetRef,
        };
    }

    it("calls handler when clicking outside the referenced element", async () => {
        const { handler } = await renderHarness();

        act(() => {
            document.body.dispatchEvent(
                new MouseEvent("mousedown", {
                    bubbles: true,
                })
            );
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not call handler when clicking inside the referenced element", async () => {
        const { handler, targetRef } = await renderHarness();

        act(() => {
            targetRef.current?.dispatchEvent(
                new MouseEvent("mousedown", {
                    bubbles: true,
                })
            );
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it("calls handler when Escape key is pressed", async () => {
        const { handler } = await renderHarness();

        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                })
            );
        });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not call handler when disabled", async () => {
        const { handler } = await renderHarness(jest.fn(), false);

        act(() => {
            document.body.dispatchEvent(
                new MouseEvent("mousedown", {
                    bubbles: true,
                })
            );
        });

        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                })
            );
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it("removes listeners on unmount", async () => {
        const { handler } = await renderHarness();

        act(() => {
            root.unmount();
        });

        act(() => {
            document.body.dispatchEvent(
                new MouseEvent("mousedown", {
                    bubbles: true,
                })
            );
        });

        expect(handler).not.toHaveBeenCalled();
    });
});
