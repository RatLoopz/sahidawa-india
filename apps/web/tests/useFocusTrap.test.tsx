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

import { useFocusTrap } from "../hooks/useFocusTrap";

interface HarnessProps {
    enabled?: boolean;
    targetRef: React.RefObject<HTMLDivElement | null>;
}

function Harness({ enabled = true, targetRef }: HarnessProps) {
    useFocusTrap(targetRef, enabled);

    return createElement(
        "div",
        { ref: targetRef, tabIndex: -1 },
        createElement("button", { "data-testid": "btn-first" }, "First Button"),
        createElement("input", { "data-testid": "input-middle" }),
        createElement("button", { "data-testid": "btn-last" }, "Last Button")
    );
}

describe("useFocusTrap", () => {
    let root: Root;
    let container: HTMLDivElement;
    let fallbackButton: HTMLButtonElement;

    beforeEach(() => {
        // Set up DOM container
        container = document.createElement("div");
        document.body.appendChild(container);

        // Add a focus target outside the trap to mock active element restoration
        fallbackButton = document.createElement("button");
        fallbackButton.id = "outside-button";
        document.body.appendChild(fallbackButton);
        fallbackButton.focus();

        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        fallbackButton.remove();
        jest.clearAllMocks();
    });

    async function renderHarness(enabled = true) {
        const targetRef = createRef<HTMLDivElement>();

        await act(async () => {
            root.render(
                createElement(Harness, {
                    enabled,
                    targetRef,
                })
            );
        });

        return {
            targetRef,
        };
    }

    it("automatically focuses the first focusable element inside the ref container on mount when enabled", async () => {
        await renderHarness();

        const firstButton = document.querySelector('[data-testid="btn-first"]') as HTMLElement;
        expect(document.activeElement).toBe(firstButton);
    });

    it("traps Tab key so that pressing Tab on the last element wraps focus back to the first", async () => {
        await renderHarness();

        const firstButton = document.querySelector('[data-testid="btn-first"]') as HTMLElement;
        const lastButton = document.querySelector('[data-testid="btn-last"]') as HTMLElement;

        // Manually focus the last element
        act(() => {
            lastButton.focus();
        });
        expect(document.activeElement).toBe(lastButton);

        // Simulate Tab key down
        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Tab",
                    bubbles: true,
                })
            );
        });

        expect(document.activeElement).toBe(firstButton);
    });

    it("traps Shift+Tab key so that pressing Shift+Tab on the first element wraps focus to the last", async () => {
        await renderHarness();

        const firstButton = document.querySelector('[data-testid="btn-first"]') as HTMLElement;
        const lastButton = document.querySelector('[data-testid="btn-last"]') as HTMLElement;

        // Manually focus the first element
        act(() => {
            firstButton.focus();
        });
        expect(document.activeElement).toBe(firstButton);

        // Simulate Shift+Tab key down
        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Tab",
                    shiftKey: true,
                    bubbles: true,
                })
            );
        });

        expect(document.activeElement).toBe(lastButton);
    });

    it("restores focus to the previously focused element when unmounted", async () => {
        // Step 1: Focus fallbackButton outside the modal
        act(() => {
            fallbackButton.focus();
        });
        expect(document.activeElement).toBe(fallbackButton);

        // Step 2: Render focus trap (should auto-focus first button)
        await renderHarness();
        const firstButton = document.querySelector('[data-testid="btn-first"]') as HTMLElement;
        expect(document.activeElement).toBe(firstButton);

        // Step 3: Unmount focus trap (should restore focus to fallbackButton)
        await act(async () => {
            root.unmount();
        });

        expect(document.activeElement).toBe(fallbackButton);
    });
});
