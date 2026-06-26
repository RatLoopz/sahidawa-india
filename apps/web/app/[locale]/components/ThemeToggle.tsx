"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const tA11y = useTranslations("Accessibility");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 transition-colors sm:h-10 sm:w-10 dark:bg-gray-700"
                aria-label={tA11y("toggle_theme")}
            >
                <div className="h-5 w-5" />
            </button>
        );
    }

    const isDark = theme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300 sm:h-10 sm:w-10 dark:bg-gray-700 dark:hover:bg-gray-600"
            aria-label={isDark ? tA11y("switch_light") : tA11y("switch_dark")}
        >
            {isDark ? (
                <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
                <Moon className="h-5 w-5 text-gray-700" />
            )}
        </button>
    );
}
