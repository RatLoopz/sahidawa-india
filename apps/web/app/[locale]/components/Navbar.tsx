"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
    History,
    HelpCircle,
    Home,
    User,
    MapPin,
    Bell,
    MessageCircle,
    Menu,
    X,
    LogIn,
    Camera,
    Clock,
    ShieldCheck,
} from "lucide-react";
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
        icon: Camera,
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
    const pathname = usePathname();
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    // UI States
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const lastScrollY = useRef(0);
    const ticking = useRef(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close hamburger menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);
            const isInsideDropdown =
                target.closest("[data-radix-popper-content]") ||
                target.closest('[role="menu"]') ||
                target.closest('[role="dialog"]') ||
                target.closest('[id^="radix-"]');

            if (isOutsideMenu && !isInsideDropdown) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    useEffect(() => {
        const handleScroll = () => {
            if (!ticking.current) {
                window.requestAnimationFrame(() => {
                    const currentY = window.scrollY;
                    if (currentY > lastScrollY.current && currentY > 80) {
                        setIsNavVisible(false);
                        setIsMenuOpen(false);
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

    // Active route detection — exact match for "/", prefix match for others
    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <>
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-[100] w-full border-b border-white/30 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
                <div className="container mx-auto flex h-16 items-center justify-between gap-1 px-2 sm:gap-3 sm:px-4 md:px-6">
                    {/* Left — Logo & Brand Title */}
                    <div className="flex min-w-0 flex-1 items-center">
                        <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                            <Image
                                src="/icons/sahidawa-logo.png"
                                alt="SahiDawa Logo"
                                aria-label="SahiDawa Logo"
                                className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
                                width={40}
                                height={40}
                                priority
                            />
                            <h1 className="xxs:text-lg text-base font-extrabold tracking-tight text-(--color-text-primary) sm:text-xl md:text-2xl">
                                SahiDawa
                            </h1>
                        </Link>
                    </div>

                    {/* Center — Desktop Nav Links */}
                    <nav
                        className="ml-6 hidden items-center justify-center gap-6 text-sm font-semibold text-(--color-text-secondary) lg:flex"
                        aria-label="Main navigation"
                    >
                        <Link href="/" className={desktopNavLinkClassName}>
                            <Home size={14} className="mr-1 inline" />
                            {tNav("home")}
                        </Link>
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
                            href="/scheme-eligibility"
                            className={`${desktopNavLinkClassName} flex items-center gap-1`}
                        >
                            <ShieldCheck size={14} /> {tNav("scheme_eligibility")}
                        </Link>
                        <Link
                            href="/schedule"
                            className={`${desktopNavLinkClassName} flex items-center gap-1`}
                        >
                            <Clock size={14} /> {tNav("schedule")}
                        </Link>
                        <Link
                            href="/reports/me"
                            className={`${desktopNavLinkClassName} flex items-center gap-1`}
                        >
                            <History size={14} /> {tNav("my_reports")}
                        </Link>
                    </nav>

                    {/* Right — Action Controls Container */}
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3">
                        {/* Health Companion Trigger */}
                        <div className="group relative flex items-center">
                            <Link
                                href="/health"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-10"
                                aria-label={tHome("open_ai_health_assistant")}
                            >
                                <MessageCircle size={16} />
                            </Link>
                            <div className="pointer-events-none absolute top-full left-1/2 z-[100] mt-2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 transition-all duration-200 group-hover:opacity-100">
                                Health Companion
                            </div>
                        </div>

                        {/* Desktop Only Utilities Layout */}
                        <div className="hidden items-center gap-2 sm:flex">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>

                        {/* Desktop Only Account Sign In */}
                        <Link
                            href="/login"
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/50 px-4 py-1.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:flex sm:h-10 sm:px-5 sm:py-2 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            aria-label={tHome("sign_in")}
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </Link>

                        {/* Mobile Only: Hamburger Toggle Menu Button */}
                        <div className="relative sm:hidden" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                aria-label="Toggle system parameters"
                                aria-expanded={isMenuOpen}
                            >
                                {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
                            </button>

                            {/* Dropdown Vertical Panel Menu */}
                            {isMenuOpen && (
                                <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-[100] mt-2 w-44 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl duration-150 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="flex flex-col gap-1.5">
                                        {/* Added Core Navigation Links */}
                                        <div className="flex flex-col gap-1 px-1">
                                            <Link
                                                href="/how-it-works"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <HelpCircle size={14} />
                                                {tNav("how_it_works")}
                                            </Link>
                                            <Link
                                                href="/alerts"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <Bell size={14} />
                                                {tNav("alerts")}
                                            </Link>
                                            <Link
                                                href="/map"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <MapPin size={14} />
                                                {tNav("pharmacy_map")}
                                            </Link>
                                            <Link
                                                href="/scheme-eligibility"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <ShieldCheck size={14} />
                                                {tNav("scheme_eligibility")}
                                            </Link>
                                            <Link
                                                href="/reports/me"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <History size={14} /> {tNav("my_reports")}
                                            </Link>
                                            <Link
                                                href="/schedule"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <Clock size={14} /> {tNav("schedule")}
                                            </Link>
                                        </div>

                                        <div className="my-1 border-t border-slate-100 dark:border-slate-900" />

                                        {/* Added Sign In / Sign Up Option */}
                                        <Link
                                            href="/login"
                                            onClick={() => setIsMenuOpen(false)}
                                            className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70"
                                        >
                                            <LogIn size={16} />
                                            <span>{tHome("sign_in")}</span>
                                        </Link>

                                        <div className="my-0.5 border-t border-slate-100 dark:border-slate-900" />

                                        {/* Mobile Language & Theme Settings */}
                                        <div className="flex items-center justify-center gap-4 px-2 py-2">
                                            <LanguageSwitcher />
                                            <ThemeToggle />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Mobile Bottom Navigation ── */}
            <nav
                className={`fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-(--color-border-muted)/60 bg-(--color-surface-page)/90 px-1 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${isNavVisible ? "translate-y-0" : "translate-y-full"} `}
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
                                className={`group flex w-14 flex-col items-center gap-1 transition-colors ${
                                    active ? activeColor : `text-(--color-text-muted) ${hoverColor}`
                                } `}
                            >
                                <div
                                    className={`relative transition-transform duration-200 group-hover:-translate-y-0.5 ${active ? "scale-105" : ""} `}
                                >
                                    <Icon size={22} strokeWidth={active ? 2.5 : strokeWidth} />
                                    {badge && (
                                        <span className="absolute top-0 right-0 h-2 w-2 animate-pulse rounded-full border border-(--color-surface-page) bg-red-500" />
                                    )}
                                    {active && (
                                        <span
                                            className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${activeColor.replace("text-", "bg-")} `}
                                        />
                                    )}
                                </div>
                                <span
                                    className={` ${mobileNavLabelClassName} text-[10px] ${active ? "font-bold" : "font-semibold"} `}
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
