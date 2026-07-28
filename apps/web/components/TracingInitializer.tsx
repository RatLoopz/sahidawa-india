"use client";

import { useEffect } from "react";

export function TracingInitializer() {
    useEffect(() => {
        if (typeof window !== "undefined") {
            const init = () => {
                import("@/lib/tracing").then((mod) => {
                    mod.initTracing();
                });
            };

            if ("requestIdleCallback" in window) {
                window.requestIdleCallback(init);
            } else {
                setTimeout(init, 2000);
            }
        }
    }, []);

    return null;
}
