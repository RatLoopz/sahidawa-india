import { useEffect, useRef, RefObject } from "react";

/**
 * A reusable hook to handle clicks outside a specific element and the Escape key.
 *
 * @param ref - React ref of the element to monitor for outside clicks.
 * @param handler - Callback function to execute when a dismiss event occurs.
 * @param enabled - Boolean to enable or disable the listeners (e.g., based on 'open' state).
 */
export function useOnClickOutside(
    ref: RefObject<HTMLElement | null>,
    handler: (event: MouseEvent | KeyboardEvent) => void,
    enabled: boolean = true
) {
    const handlerRef = useRef(handler);

    // Always point to the latest handler to avoid unnecessary effect re-runs
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!enabled) return;

        const handleDismiss = (event: MouseEvent | KeyboardEvent) => {
            // Handle Escape key dismissal
            if (event instanceof KeyboardEvent && event.key === "Escape") {
                handlerRef.current(event);
                return;
            }

            // Handle Outside Click dismissal
            if (
                event instanceof MouseEvent &&
                ref.current &&
                !ref.current.contains(event.target as Node)
            ) {
                handlerRef.current(event);
            }
        };

        document.addEventListener("mousedown", handleDismiss);
        document.addEventListener("keydown", handleDismiss);
        return () => {
            document.removeEventListener("mousedown", handleDismiss);
            document.removeEventListener("keydown", handleDismiss);
        };
    }, [ref, enabled]);
}
