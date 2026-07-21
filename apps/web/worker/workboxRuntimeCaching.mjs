function matchesPattern(pattern, context) {
    if (pattern instanceof RegExp) {
        pattern.lastIndex = 0;
        return pattern.test(context.url.href);
    }
    if (typeof pattern === "function") return pattern(context);
    if (typeof pattern === "string") return context.url.href.startsWith(pattern);
    return false;
}

/** Workbox must never compete with the custom worker for same-origin API requests. */
export function createWorkboxRuntimeCaching(defaultRuntimeCaching) {
    return defaultRuntimeCaching
        .filter((entry) => entry.options?.cacheName !== "apis")
        .map((entry) => ({
            ...entry,
            urlPattern: (context) => {
                if (context.sameOrigin && context.url.pathname.startsWith("/api/")) return false;
                return matchesPattern(entry.urlPattern, context);
            },
        }));
}
