"use client";

import React, { useState, useRef, useEffect } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Wrench, ChevronDown, MapPin, Calculator, ShieldCheck } from "lucide-react";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-emerald-600 focus-visible:text-emerald-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";
const activeDesktopNavLinkClassName =
    "text-emerald-600 dark:text-emerald-400 after:scale-x-100 font-bold";

export default function DesktopNavLinks() {
    const pathname = usePathname();
    const tNav = useTranslations("Navigation");
    const tA11y = useTranslations("A11y");
    const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
    const featuresRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            const isOutsideFeatures = featuresRef.current && !featuresRef.current.contains(target);
            const isInsideDropdown =
                target.closest("[data-radix-popper-content]") ||
                target.closest('[role="menu"]') ||
                target.closest('[role="dialog"]') ||
                target.closest('[id^="radix-"]');

            if (isOutsideFeatures && !isInsideDropdown) {
                setIsFeaturesOpen(false);
            }
        };
        if (isFeaturesOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFeaturesOpen]);

    useEffect(() => {
        setIsFeaturesOpen(false);
    }, [pathname]);

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const desktopLinkClass = (href: string) =>
        `${desktopNavLinkClassName} ${isActive(href) ? activeDesktopNavLinkClassName : ""}`;

    return (
        <nav
            className="hidden items-center justify-center gap-4 text-sm font-semibold text-(--color-text-secondary) lg:flex xl:gap-6"
            aria-label={tA11y("mainNavigation")}
        >
            <Link
                href="/how-it-works"
                className={desktopLinkClass("/how-it-works")}
                aria-current={isActive("/how-it-works") ? "page" : undefined}
            >
                {tNav("how_it_works")}
            </Link>
            <Link
                href="/alerts"
                className={desktopLinkClass("/alerts")}
                aria-current={isActive("/alerts") ? "page" : undefined}
            >
                {tNav("alerts")}
            </Link>

            {/* More Dropdown */}
            <div
                className="relative flex items-center"
                ref={featuresRef}
                onMouseEnter={() => setIsFeaturesOpen(true)}
                onMouseLeave={() => setIsFeaturesOpen(false)}
            >
                <button
                    onClick={() => setIsFeaturesOpen((prev) => !prev)}
                    className={`${desktopNavLinkClassName} flex items-center gap-1 ${isFeaturesOpen ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                    aria-expanded={isFeaturesOpen}
                >
                    <Wrench size={14} /> Tools
                    <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isFeaturesOpen ? "rotate-180" : ""}`}
                    />
                </button>

                {/* Dropdown Panel */}
                {isFeaturesOpen && (
                    <div className="animate-in fade-in slide-in-from-top-2 absolute top-full left-1/2 z-[100] mt-1 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                        <div className="absolute -top-2 left-0 h-2 w-full" />

                        <div className="flex flex-col gap-1">
                            <Link
                                href="/map"
                                onClick={() => setIsFeaturesOpen(false)}
                                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <MapPin size={16} /> {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/calculator"
                                onClick={() => setIsFeaturesOpen(false)}
                                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <Calculator size={16} /> {tNav("calculator")}
                            </Link>
                            <Link
                                href="/scheme-eligibility"
                                onClick={() => setIsFeaturesOpen(false)}
                                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <ShieldCheck size={16} /> {tNav("scheme_eligibility")}
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
