"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
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

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery("");
            setActiveIndex(0);
        }
    }, [isOpen]);

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
                className="w-full max-w-lg rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-2xl"
            >
                {/* Search input */}
                <div className="flex items-center gap-3 border-b border-(--color-border-muted) px-4 py-3">
                    <Search size={18} className="shrink-0 opacity-50" />
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
                        className="flex-1 bg-transparent text-sm text-(--color-text-primary) outline-none placeholder:opacity-50"
                    />
                    <button
                        onClick={() => setIsOpen(false)}
                        className="shrink-0 opacity-50 hover:opacity-100"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto p-2">
                    {filtered.length === 0 ? (
                        <p className="py-8 text-center text-sm opacity-50">{t("noResults")}</p>
                    ) : (
                        groups.map((group) => (
                            <div key={group} className="mb-2">
                                <p className="mb-1 px-2 text-[10px] font-bold tracking-wider uppercase opacity-40">
                                    {group}
                                </p>
                                {filtered
                                    .filter((c) => c.group === group)
                                    .map((cmd) => {
                                        const globalIndex = filtered.indexOf(cmd);
                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={() => execute(cmd)}
                                                onMouseEnter={() => setActiveIndex(globalIndex)}
                                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                                                    activeIndex === globalIndex
                                                        ? "bg-emerald-500/10 text-emerald-600"
                                                        : "text-(--color-text-primary) hover:bg-(--color-surface-muted)"
                                                }`}
                                            >
                                                <span className="opacity-60">{cmd.icon}</span>
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
