"use client";

import { ArrowLeft, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import LanguageSwitcher from "../LanguageSwitcher"; // Imported cleanly from relative folder path

const pageHeaderFocusRingClass =
    "focus-visible:outline-[3px] focus-visible:outline-emerald-600 focus-visible:outline-offset-2 focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

interface PageHeaderProps {
    title?: string;
    subtitle?: string;
    backHref: string;
    variant?: "dark" | "light";
    hideBackButton?: boolean;
    // allowed values:
    // - undefined / false => render no language UI (default)
    // - "label" => render a static language label
    // - "switcher" => render the interactive LanguageSwitcher
    showLanguage?: boolean | "label" | "switcher";
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
    hideBackButton = false,
    // Default to showing a static language label on internal page headers
    // to avoid duplicating the global `LanguageSwitcher` in the navbar.
    // By default, do not render any page-level language UI to avoid
    // duplicating the global navbar `LanguageSwitcher` on internal pages.
    // To show language UI, pass `showLanguage` as either "label" or "switcher".
    showLanguage,
    languageName,
    contentClassName = "",
    childrenWrapperClassName = "min-w-0 flex-1",
    backButtonClassName = "",
    rightActionsClassName = "",
    children,
}: PageHeaderProps) => {
    const tA11y = useTranslations("Accessibility");
    const isDark = variant === "dark";

    const isEmptyHeader = !children && !title && !subtitle;

    // When there is no title/subtitle/children, render a compact back button
    // instead of the full-width header bar to avoid the empty horizontal box.
    if (isEmptyHeader) {
        return (
            <div className="pointer-events-none">
                {!hideBackButton && (
                    <div className="pointer-events-auto absolute top-4 left-4 z-60">
                        <Link
                            href={backHref}
                            aria-label={tA11y("go_back")}
                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${pageHeaderFocusRingClass} ${
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
                            <span className="sr-only">{tA11y("go_back")}</span>
                        </Link>
                    </div>
                )}
            </div>
        );
    }

    return (
        <header
            className={`no-print ${isDark ? "absolute top-0 right-0 left-0 bg-gradient-to-b from-black/70 to-transparent text-white" : "relative border-b border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-primary) shadow-sm"} z-60 flex flex-col gap-4 p-4`}
        >
            <div className={`flex items-center justify-between gap-2 ${contentClassName}`}>
                {/* BACK BUTTON */}
                {!hideBackButton ? (
                    <Link
                        href={backHref}
                        aria-label={tA11y("go_back")}
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
                        <span className="sr-only">{tA11y("go_back")}</span>
                    </Link>
                ) : (
                    <div className={`w-10 shrink-0 ${backButtonClassName}`} />
                )}

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

                {/* RIGHT ACTIONS BLOCK (Features & Utilities) */}
                <div
                    className={`flex shrink-0 items-center justify-end gap-2 ${rightActionsClassName}`}
                >
                    {/* STATUS OR QUICK ACTIONS CONTAINER */}

                    {showLanguage === "label" ? (
                        <div
                            className="flex items-center gap-1.5 rounded-full border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-1.5 shadow-sm"
                            role="status"
                            aria-label={tA11y("current_language", {
                                language: languageName || "English",
                            })}
                        >
                            <Globe size={14} aria-hidden="true" className="text-emerald-600" />
                            <span className="text-xs font-bold text-(--color-text-primary)">
                                {languageName || "English"}
                            </span>
                        </div>
                    ) : showLanguage === "switcher" ? (
                        <LanguageSwitcher />
                    ) : null}
                </div>
            </div>
        </header>
    );
};
