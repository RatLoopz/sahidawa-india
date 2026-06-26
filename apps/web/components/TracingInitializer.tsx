"use client";

import { useEffect } from "react";
import { initTracing } from "@/lib/tracing";

export function TracingInitializer() {
    useEffect(() => {
        initTracing();
    }, []);

    return null;
}
