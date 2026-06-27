import { useEffect, useRef, RefObject } from "react";

/**
 * A custom React hook to trap keyboard focus within a specific container (e.g., a modal or dialog).
 *
 * @param ref - React ref of the container element containing focusable children.
 * @param enabled - Boolean indicating whether the focus trap is currently active.
 */
export function useFocusTrap<T extends HTMLElement>(
    ref: RefObject<T | null>,
    enabled: boolean = true
) {
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!enabled) return;

        // Save the element that currently has focus, so we can restore it when the trap is disabled or unmounted
        if (typeof document !== "undefined") {
            previousActiveElement.current = document.activeElement as HTMLElement;
        }

        const container = ref.current;
        if (!container) return;

        // Focusable elements selector
        const FOCUSABLE_SELECTOR =
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable], [tabindex]:not([tabindex="-1"])';

        // Find focusable elements
        const getFocusableElements = (): HTMLElement[] => {
            if (!ref.current) return [];
            return Array.from(ref.current.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
        };

        // Focus the first focusable element initially
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            // Fallback: focus the container itself (should have tabindex="-1" or similar)
            container.focus();
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Tab") return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) {
                event.preventDefault();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey) {
                // Shift + Tab: trap focus backward
                if (activeElement === firstElement || !container.contains(activeElement)) {
                    lastElement.focus();
                    event.preventDefault();
                }
            } else {
                // Tab: trap focus forward
                if (activeElement === lastElement || !container.contains(activeElement)) {
                    firstElement.focus();
                    event.preventDefault();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            // Restore focus
            if (
                previousActiveElement.current &&
                typeof previousActiveElement.current.focus === "function"
            ) {
                previousActiveElement.current.focus();
            }
        };
    }, [ref, enabled]);
}
