"use client";

import { ArrowLeft, Globe, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";
import { ThemeToggle } from "./ThemeToggle";

const pageHeaderFocusRingClass =
    "focus-visible:outline-[3px] focus-visible:outline-emerald-600 focus-visible:outline-offset-2 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

interface PageHeaderProps {
    title?: string;
    subtitle?: string;
    backHref: string;
    variant?: "dark" | "light";
    languageName?: string;
    contentClassName?: string;
    childrenWrapperClassName?: string;
    backButtonClassName?: string;
    rightActionsClassName?: string;
    children?: React.ReactNode;
}

export const PageHeader = ({
    title,
    subtitle,
    backHref,
    variant = "dark",
    showLanguage = false,
    languageName,
    showThemeToggle = true,
    contentClassName = "",
    childrenWrapperClassName = "min-w-0 flex-1",
    backButtonClassName = "",
    rightActionsClassName = "",
    children,
}: PageHeaderProps) => {
    const isDark = variant === "dark";

    return (
        <header
            className={`no-print ${isDark ? "absolute top-0 right-0 left-0 bg-gradient-to-b from-black/70 to-transparent text-white" : "relative border-b border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary) shadow-sm"} z-50 flex flex-col gap-4 p-4`}
        >
            <div className={`flex items-center justify-between gap-2 ${contentClassName}`}>
                {/* BACK BUTTON */}
                <Link
                    href={backHref}
                    aria-label="Go back to previous page"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${pageHeaderFocusRingClass} ${
                        isDark
                            ? "bg-white/10 backdrop-blur-md hover:bg-white/20"
                            : "bg-(--color-surface-muted) hover:bg-(--color-border-muted)"
                    } ${backButtonClassName}`}
                >
                    <ArrowLeft
                        size={24}
                        aria-hidden="true"
                        className={isDark ? "text-white" : "text-(--color-text-secondary)"}
                    />
                    <span className="sr-only">Go back</span>
                </Link>

                {/* MAIN HEADER TITLE / RUNTIME CHILDREN */}
                {children ? (
                    <div className={childrenWrapperClassName}>{children}</div>
                ) : (
                    <div className="flex min-w-0 flex-1 flex-col items-center px-2 text-center">
                        <h1
                            className={`w-full truncate text-[10px] font-bold tracking-widest uppercase sm:text-xs ${isDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"}`}
                        >
                            {title}
                        </h1>
                        <span className="w-full truncate text-xs font-medium sm:text-sm">
                            {subtitle}
                        </span>
                    </div>
                )}

            </div>
        </header>
    );
};
