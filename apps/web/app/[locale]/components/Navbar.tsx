"use client";

import React from "react";
import { History, Home, User, MapPin, Bell, MessageCircle } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-emerald-600 focus-visible:text-emerald-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

const mobileNavLabelClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

export default function Navbar() {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    // Hide the global navbar on specific standalone routes (like the AI Agent or Login)
    if (pathname === "/login" || pathname === "/health") {
        return null;
    }

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    return (
        <>
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-white/30 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
                <div className="container mx-auto grid h-16 grid-cols-3 items-center px-4 md:px-6">
                    {/* Left — Logo */}
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm sm:h-10 sm:w-10 dark:bg-emerald-950/30 dark:text-emerald-400"
                                aria-label="SahiDawa Logo"
                            >
                                <img
                                    src="/favicon.ico"
                                    alt=""
                                    aria-hidden="true"
                                    className="h-7 w-7 object-contain"
                                    width={28}
                                    height={28}
                                />
                            </div>
                            <h1 className="text-xl font-extrabold tracking-tight text-(--color-text-primary) md:text-2xl">
                                SahiDawa
                            </h1>
                        </Link>
                    </div>

                    {/* Center — Nav Links */}
                    <nav
                        className="hidden items-center justify-center gap-6 text-sm font-semibold text-(--color-text-secondary) lg:flex"
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
                    <div className="flex items-center justify-end gap-2 sm:gap-3">
                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-10"
                            aria-label={tHome("open_ai_health_assistant")}
                        >
                            <MessageCircle size={17} />
                        </button>

                        <LanguageSwitcher />
                        <ThemeToggle />

                        <button
                            onClick={() => handleNavigation("login")}
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:h-10 sm:px-5 sm:py-2 md:flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
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
                className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-(--color-border-muted)/60 bg-(--color-surface-page)/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
                aria-label="Mobile navigation"
            >
                <Link
                    href="/"
                    className="group flex w-16 flex-col items-center gap-1.5"
                    aria-label={tNav("home")}
                >
                    <div className="text-emerald-500 transition-transform group-hover:-translate-y-1">
                        <Home size={24} strokeWidth={2.5} />
                    </div>
                    <span
                        className={`${mobileNavLabelClassName} text-[11px] font-bold text-emerald-500`}
                    >
                        {tNav("home")}
                    </span>
                </Link>

                <Link
                    href="/scan"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-(--color-text-primary)"
                    aria-label={tNav("scans")}
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <History size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        {tNav("scans")}
                    </span>
                </Link>

                <Link
                    href="/map"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-amber-500"
                    aria-label={tNav("map")}
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <MapPin size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        {tNav("map")}
                    </span>
                </Link>

                <Link
                    href="/alerts"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-red-500"
                    aria-label={tNav("alerts")}
                >
                    <div className="relative transition-transform group-hover:-translate-y-1">
                        <Bell size={24} strokeWidth={2} />
                        <span className="absolute top-0 right-0.5 h-2 w-2 animate-pulse rounded-full border border-(--color-surface-page) bg-red-500"></span>
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        {tNav("alerts")}
                    </span>
                </Link>

                <Link
                    href="/profile"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-emerald-500"
                    aria-label={tNav("profile")}
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <User size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        {tNav("profile")}
                    </span>
                </Link>
            </nav>
        </>
    );
}
