"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
    Search,
    X,
    Home,
    Camera,
    MapPin,
    Bell,
    Clock,
    GitCompare,
    Syringe,
    FileText,
    User,
} from "lucide-react";

interface Command {
    id: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    group: string;
}

export default function CommandPalette() {
    const t = useTranslations("CommandPalette");
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const commands: Command[] = [
        {
            id: "home",
            label: t("nav_home"),
            href: "/",
            icon: <Home size={16} />,
            group: t("pages"),
        },
        {
            id: "scan",
            label: t("nav_scan"),
            href: "/scan",
            icon: <Camera size={16} />,
            group: t("pages"),
        },
        {
            id: "map",
            label: t("nav_map"),
            href: "/map",
            icon: <MapPin size={16} />,
            group: t("pages"),
        },
        {
            id: "alerts",
            label: t("nav_alerts"),
            href: "/alerts",
            icon: <Bell size={16} />,
            group: t("pages"),
        },
        {
            id: "expiry",
            label: t("nav_expiry"),
            href: "/expiry-tracker",
            icon: <Clock size={16} />,
            group: t("pages"),
        },
        {
            id: "compare",
            label: t("nav_compare"),
            href: "/compare",
            icon: <GitCompare size={16} />,
            group: t("pages"),
        },
        {
            id: "vaccine",
            label: t("nav_vaccine"),
            href: "/vaccine-hub",
            icon: <Syringe size={16} />,
            group: t("pages"),
        },
        {
            id: "reports",
            label: t("nav_reports"),
            href: "/reports/me",
            icon: <FileText size={16} />,
            group: t("pages"),
        },
        {
            id: "schedule",
            label: t("nav_schedule"),
            href: "/schedule",
            icon: <Clock size={16} />,
            group: t("pages"),
        },
        {
            id: "profile",
            label: t("nav_profile"),
            href: "/profile",
            icon: <User size={16} />,
            group: t("pages"),
        },
    ];

    const filtered = commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    );

    const optionId = (cmd: Command) => `command-palette-option-${cmd.id}`;
    const activeCommand = filtered[activeIndex];
    const activeOptionId = activeCommand ? optionId(activeCommand) : undefined;

    // Open/close with Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Moves focus into the palette (the search input is its first focusable child), keeps Tab
    // inside it, and restores focus to whatever was focused before it opened.
    useFocusTrap(containerRef, isOpen);

    // Reset the search when opened
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setActiveIndex(0);
        }
    }, [isOpen]);

    // Keep the background page from scrolling behind the modal
    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    // Keep the arrow-key selection visible in the scrollable results list
    useEffect(() => {
        if (!isOpen || !activeOptionId) return;

        document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
    }, [isOpen, activeOptionId]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Arrow key navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && filtered[activeIndex]) {
            execute(filtered[activeIndex]);
        }
    };

    const execute = (cmd: Command) => {
        setIsOpen(false);
        router.push(cmd.href as any);
    };

    if (!isOpen) return null;

    // Group commands
    const groups = Array.from(new Set(filtered.map((c) => c.group)));

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm">
            <div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("title")}
                className="w-full max-w-lg rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-2xl"
            >
                <p className="sr-only" role="status" aria-live="polite">
                    {t("resultsCount", { count: filtered.length })}
                </p>

                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-(--color-border-muted) px-4 py-3">
                    <Search size={18} className="shrink-0 opacity-50" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={t("placeholder")}
                        aria-label={t("placeholder")}
                        role="combobox"
                        aria-expanded={filtered.length > 0}
                        aria-controls="command-palette-listbox"
                        aria-activedescendant={activeOptionId}
                        aria-autocomplete="list"
                        className="flex-1 bg-transparent text-sm text-(--color-text-primary) outline-none placeholder:opacity-50"
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label={t("close")}
                        className="shrink-0 opacity-50 hover:opacity-100"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                {/* Results */}
                <div
                    id="command-palette-listbox"
                    role="listbox"
                    aria-label={t("title")}
                    className="max-h-80 overflow-y-auto p-2"
                >
                    {filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm opacity-50">{t("noResults")}</p>
                    ) : (
                        groups.map((group, groupIndex) => (
                            <div
                                key={group}
                                role="group"
                                aria-labelledby={`command-palette-group-${groupIndex}`}
                                className="mb-2"
                            >
                                <p
                                    id={`command-palette-group-${groupIndex}`}
                                    className="mb-1 px-2 text-[10px] font-bold tracking-wider uppercase opacity-40"
                                >
                                    {group}
                                </p>
                                {filtered
                                    .filter((c) => c.group === group)
                                    .map((cmd) => {
                                        const globalIndex = filtered.indexOf(cmd);
                                        const isActive = activeIndex === globalIndex;
                                        return (
                                            <button
                                                key={cmd.id}
                                                id={optionId(cmd)}
                                                type="button"
                                                role="option"
                                                aria-selected={isActive}
                                                // Selection is driven by aria-activedescendant from
                                                // the input, so options stay out of the tab order.
                                                tabIndex={-1}
                                                onClick={() => execute(cmd)}
                                                onMouseEnter={() => setActiveIndex(globalIndex)}
                                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                                                    isActive
                                                        ? "bg-emerald-500/10 text-emerald-600"
                                                        : "text-(--color-text-primary) hover:bg-(--color-surface-muted)"
                                                }`}
                                            >
                                                <span className="opacity-60" aria-hidden="true">
                                                    {cmd.icon}
                                                </span>
                                                {cmd.label}
                                            </button>
                                        );
                                    })}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="flex justify-between border-t border-(--color-border-muted) px-4 py-2 text-[11px] opacity-40">
                    <span>{t("hint")}</span>
                    <span>↑↓ navigate · ↵ select</span>
                </div>
            </div>
        </div>
    );
}
