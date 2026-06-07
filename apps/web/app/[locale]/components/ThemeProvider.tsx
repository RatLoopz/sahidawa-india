"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider(props: any) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            {...props}
        />
    );
}
