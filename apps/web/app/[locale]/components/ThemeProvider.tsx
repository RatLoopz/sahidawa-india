"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// React 19 & Next.js 15+ heavily warn about next-themes injecting a <script> tag.
// This safely silences the false-positive warning in your development console.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
        if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) {
            return; // Ignore this specific warning
        }
        originalConsoleError.apply(console, args);
    };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    );
}
