"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { History, Home, User, MapPin, Bell, MessageCircle } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { FC } from "react";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-emerald-600 focus-visible:text-emerald-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

const mobileNavLabelClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";
type NavItem = {
    href: string;
    labelKey: string;
    icon: FC<{ size?: number; strokeWidth?: number }>;
    activeColor: string;
    hoverColor: string;
    strokeWidth: number;
    badge?: boolean;
};

// Nav items config — single source of truth
const MOBILE_NAV_ITEMS: NavItem[] = [
    {
        href: "/",
        labelKey: "home",
        icon: Home,
        activeColor: "text-emerald-500",
        hoverColor: "hover:text-emerald-500",
        strokeWidth: 2.5,
    },
    {
        href: "/scan",
        labelKey: "scans",
        icon: History,
        activeColor: "text-emerald-500",
        hoverColor: "hover:text-emerald-500",
        strokeWidth: 2,
    },
    {
        href: "/map",
        labelKey: "map",
        icon: MapPin,
        activeColor: "text-amber-500",
        hoverColor: "hover:text-amber-500",
        strokeWidth: 2,
    },
    {
        href: "/alerts",
        labelKey: "alerts",
        icon: Bell,
        activeColor: "text-red-500",
        hoverColor: "hover:text-red-500",
        strokeWidth: 2,
        badge: true,
    },
    {
        href: "/profile",
        labelKey: "profile",
        icon: User,
        activeColor: "text-emerald-500",
        hoverColor: "hover:text-emerald-500",
        strokeWidth: 2,
    },
];

export default function Navbar() {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    // ── Scroll-hide logic (mirrors BackToTopButton pattern) ──
    const [isNavVisible, setIsNavVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        const handleScroll = () => {
            if (!ticking.current) {
                window.requestAnimationFrame(() => {
                    const currentY = window.scrollY;
                    // Hide when scrolling down past 80px, show when scrolling up
                    if (currentY > lastScrollY.current && currentY > 80) {
                        setIsNavVisible(false);
                    } else {
                        setIsNavVisible(true);
                    }
                    lastScrollY.current = currentY;
                    ticking.current = false;
                });
                ticking.current = true;
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (pathname === "/login" || pathname === "/health") {
        return null;
    }

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    // Active route detection — exact match for "/", prefix match for others
    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-white/30 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
                <div className="container mx-auto flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
                    {/* Left — Logo */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Link href="/" className="flex min-w-0 items-center gap-2">
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm sm:h-10 sm:w-10 dark:bg-emerald-950/30 dark:text-emerald-400"
                                aria-label="SahiDawa Logo"
                            >
                                <Image
                                    src="/favicon.ico"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-6 w-6 object-contain sm:h-7 sm:w-7"
                                    width={28}
                                    height={28}
                                />
                            </div>
                            <h1 className="truncate text-lg font-extrabold tracking-tight text-(--color-text-primary) sm:text-xl md:text-2xl">
                                SahiDawa
                            </h1>
                        </Link>
                    </div>

                    {/* Center — Nav Links */}
                    <nav
                        className="ml-6 hidden flex-1 items-center justify-center gap-6 text-sm font-semibold text-(--color-text-secondary) lg:flex"
                        aria-label="Main navigation"
                    >
                        <Link href="/how-it-works" className={desktopNavLinkClassName}>
                            {tNav("how_it_works")}
                        </Link>
                        <Link href="/alerts" className={desktopNavLinkClassName}>
                            {tNav("alerts")}
                        </Link>
                        <Link href="/map" className={desktopNavLinkClassName}>
                            {tNav("pharmacy_map")}
                        </Link>
                        <Link
                            href="/reports/me"
                            className={`${desktopNavLinkClassName} flex items-center gap-1`}
                        >
                            <History size={14} /> {tNav("my_reports")}
                        </Link>
                    </nav>

                    {/* Right — Action Buttons */}
                    <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3">
                        <div className="group relative flex items-center">
                            <button
                                onClick={() => handleNavigation("health")}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-10"
                                aria-label={tHome("open_ai_health_assistant")}
                            >
                                <MessageCircle size={17} />
                            </button>

                            <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-all duration-200 group-hover:opacity-100">
                                Health Companion
                            </div>
                        </div>

                        <div className="group relative flex items-center">
                            <LanguageSwitcher />

                            <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-all duration-200 group-hover:opacity-100">
                                Language
                            </div>
                        </div>

                        <ThemeToggle />

                        <button
                            onClick={() => handleNavigation("login")}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-50/70 text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:hidden dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            aria-label={tHome("sign_in")}
                            title={tHome("sign_in")}
                        >
                            <User size={17} />
                            <span className="sr-only">{tHome("sign_in")}</span>
                        </button>

                        <button
                            onClick={() => handleNavigation("login")}
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:flex sm:h-10 sm:px-5 sm:py-2 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            aria-label={tHome("sign_in")}
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Mobile Bottom Navigation ── */}
            <nav
                className={`fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-(--color-border-muted)/60 bg-(--color-surface-page)/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${isNavVisible ? "translate-y-0" : "translate-y-full"} `}
                aria-label="Mobile navigation"
            >
                {MOBILE_NAV_ITEMS.map(
                    ({
                        href,
                        labelKey,
                        icon: Icon,
                        activeColor,
                        hoverColor,
                        strokeWidth,
                        badge = false,
                    }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-label={tNav(labelKey)}
                                aria-current={active ? "page" : undefined}
                                className={`group flex w-16 flex-col items-center gap-1.5 transition-colors ${
                                    active ? activeColor : `text-(--color-text-muted) ${hoverColor}`
                                } `}
                            >
                                <div
                                    className={`relative transition-transform duration-200 group-hover:-translate-y-1 ${active ? "scale-110" : ""} `}
                                >
                                    <Icon size={24} strokeWidth={active ? 2.5 : strokeWidth} />
                                    {/* Alert badge */}
                                    {badge && (
                                        <span className="absolute top-0 right-0.5 h-2 w-2 animate-pulse rounded-full border border-(--color-surface-page) bg-red-500" />
                                    )}
                                    {/* Active indicator dot */}
                                    {active && (
                                        <span
                                            className={`absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${activeColor.replace("text-", "bg-")} `}
                                        />
                                    )}
                                </div>
                                <span
                                    className={` ${mobileNavLabelClassName} text-[11px] ${active ? "font-bold" : "font-semibold"} `}
                                >
                                    {tNav(labelKey)}
                                </span>
                            </Link>
                        );
                    }
                )}
            </nav>
        </>
    );
}
