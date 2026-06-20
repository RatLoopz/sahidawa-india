"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "@/src/components/AuthProvider";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

// Sub-components
import DesktopNavLinks from "./Navbar/DesktopNavLinks";
import UserDropdown from "./Navbar/UserDropdown";
import MobileMenu from "./Navbar/MobileMenu";
import MobileBottomNav from "./Navbar/MobileBottomNav";

export default function Navbar() {
    const pathname = usePathname();
    const tHome = useTranslations("Home");
    const { session, isLoading: authLoading } = useSession();

    // UI States
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const lastScrollY = useRef(0);
    const ticking = useRef(false);

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

    const handleSignOut = async () => {
        setIsMenuOpen(false);
        try {
            await fetch("/api/auth/signout", { method: "POST" });
            const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            // Forcefully clear all Supabase-related keys
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("sb-")) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach((key) => {
                if (key.startsWith("sb-")) sessionStorage.removeItem(key);
            });
            // Clear all cookies as well
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
            });
            window.location.href = "/";
        }
    };

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    if (pathname === "/login" || pathname === "/health") {
        return null;
    }

    return (
        <>
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-[100] w-full border-b border-white/30 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
                <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-2 sm:gap-3 sm:px-4 md:px-6">
                    {/* Left — Logo & Brand Title */}
                    <div className="flex min-w-0 shrink-0 items-center">
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
                    <DesktopNavLinks />

                    {/* Right — Action Controls Container */}
                    <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
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

                        {/* Desktop Only Account Sign In / Profile */}
                        <UserDropdown
                            session={session}
                            authLoading={authLoading}
                            handleSignOut={handleSignOut}
                        />

                        {/* Mobile Only: Hamburger Toggle Menu Button */}
                        <MobileMenu
                            session={session}
                            isMenuOpen={isMenuOpen}
                            setIsMenuOpen={setIsMenuOpen}
                            handleSignOut={handleSignOut}
                        />
                    </div>
                </div>
            </header>

            {/* Backdrop overlay for mobile menu */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[1px] sm:hidden"
                    onClick={() => setIsMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Mobile Bottom Navigation ── */}
            <MobileBottomNav isNavVisible={isNavVisible} />
        </>
    );
}
