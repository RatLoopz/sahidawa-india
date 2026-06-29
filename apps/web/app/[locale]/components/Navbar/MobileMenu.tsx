"use client";

import React, { useRef, useEffect } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
    Menu,
    X,
    HelpCircle,
    Bell,
    MapPin,
    Calculator,
    ShieldCheck,
    User,
    History,
    Clock,
    LogOut,
    LogIn,
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import LanguageSwitcher from "../../LanguageSwitcher";
import { ThemeToggle } from "../ThemeToggle";

interface MobileMenuProps {
    session: Session | null;
    isMenuOpen: boolean;
    setIsMenuOpen: (val: boolean) => void;
    handleSignOut: () => void;
}

export default function MobileMenu({
    session,
    isMenuOpen,
    setIsMenuOpen,
    handleSignOut,
}: MobileMenuProps) {
    const pathname = usePathname();
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");
    const tA11y = useTranslations("A11y");
    const menuRef = useRef<HTMLDivElement>(null);

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
    }, [isMenuOpen, setIsMenuOpen]);

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <div className="relative sm:hidden" ref={menuRef}>
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                aria-label={tA11y("toggleSystemParameters")}
                aria-expanded={isMenuOpen}
            >
                {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {isMenuOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-[100] mt-2 w-44 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl duration-150 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex flex-col gap-1 px-1">
                            <Link
                                href="/how-it-works"
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                    isActive("/how-it-works")
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <HelpCircle size={14} />
                                {tNav("how_it_works")}
                            </Link>
                            <Link
                                href="/alerts"
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                    isActive("/alerts")
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <Bell size={14} />
                                {tNav("alerts")}
                            </Link>
                            <Link
                                href="/map"
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                    isActive("/map")
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <MapPin size={14} />
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/calculator"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                <Calculator size={14} />
                                {tNav("calculator")}
                            </Link>
                            <Link
                                href="/scheme-eligibility"
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                    isActive("/scheme-eligibility")
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                }`}
                            >
                                <ShieldCheck size={14} />
                                {tNav("scheme_eligibility")}
                            </Link>
                        </div>

                        <div className="my-1 border-t border-slate-100 dark:border-slate-900" />

                        {session ? (
                            <div className="flex flex-col gap-1">
                                <Link
                                    href="/profile"
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                        isActive("/profile")
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <User size={14} /> Profile
                                </Link>
                                <Link
                                    href="/reports/me"
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                        isActive("/reports/me")
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <History size={14} /> {tNav("my_reports")}
                                </Link>
                                <Link
                                    href="/schedule"
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
                                        isActive("/schedule")
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    <Clock size={14} /> {tNav("schedule")}
                                </Link>
                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                <button
                                    onClick={handleSignOut}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                    <LogOut size={14} /> Sign Out
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70"
                            >
                                <LogIn size={16} />
                                <span>{tHome("sign_in")}</span>
                            </Link>
                        )}

                        <div className="my-0.5 border-t border-slate-100 dark:border-slate-900" />

                        <div className="flex items-center justify-center gap-4 px-2 py-2">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
