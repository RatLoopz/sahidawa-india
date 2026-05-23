"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className="rounded-full bg-slate-200 p-2 dark:bg-slate-800"
                aria-label="Toggle theme"
            >
                <div className="h-5 w-5" />
            </button>
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-full bg-slate-200 p-2 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
            {isDark ? (
                <Sun className="h-5 w-5 text-amber-400" />
            ) : (
                <Moon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            )}
        </button>
    );
}
