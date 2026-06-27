import { useEffect, useRef } from "react";

interface PrefetchOptions {
    preloadQuery: () => Promise<unknown>; // The query/fetch framework trigger function
    threshold?: number; // Viewport intersection visibility ratio (0.0 to 1.0)
    disableOnDataSaver?: boolean; // Skips operations if user has data-saver activated
}

export const usePredictivePrefetch = <T extends HTMLElement>({
    preloadQuery,
    threshold = 0.1,
    disableOnDataSaver = true,
}: PrefetchOptions) => {
    const elementRef = useRef<T | null>(null);
    const hasPrefetched = useRef<boolean>(false);

    const shouldSkipPrefetch = (): boolean => {
        if (disableOnDataSaver && typeof navigator !== "undefined") {
            const connection = (navigator as any).connection;
            if (
                connection &&
                (connection.saveData || /2g|slow-2g/.test(connection.effectiveType))
            ) {
                return true;
            }
        }
        return false;
    };

    const triggerSafePrefetch = () => {
        if (hasPrefetched.current || shouldSkipPrefetch()) return;

        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(() => {
                preloadQuery().catch((err) => console.error("Prefetch failed:", err));
                hasPrefetched.current = true;
            });
        } else {
            setTimeout(() => {
                preloadQuery().catch((err) => console.error("Prefetch fallback failed:", err));
                hasPrefetched.current = true;
            }, 1);
        }
    };

    useEffect(() => {
        const currentElement = elementRef.current;
        if (!currentElement) return;

        // Tier 1: Low-Priority Viewport Entry Tracker
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    triggerSafePrefetch();
                }
            },
            { threshold }
        );

        observer.observe(currentElement);

        // Tier 2: High-Priority Hover / Pointer Intent Trigger
        const handleMouseEnter = () => {
            triggerSafePrefetch();
        };

        currentElement.addEventListener("mouseenter", handleMouseEnter);

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
                currentElement.removeEventListener("mouseenter", handleMouseEnter);
            }
        };
    }, [preloadQuery, threshold]);

    return elementRef;
};
