"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { MessageCircle, Bookmark } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "@/src/components/AuthProvider";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { motion, useScroll, useSpring } from "framer-motion";
// Sub-components
import DesktopNavLinks from "./Navbar/DesktopNavLinks";
import UserDropdown from "./Navbar/UserDropdown";
import MobileMenu from "./Navbar/MobileMenu";
import MobileBottomNav from "./Navbar/MobileBottomNav";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const tHome = useTranslations("Home");
    const tNavbar = useTranslations("Navbar");
    const { session, isLoading: authLoading } = useSession();

    const supabase = useMemo(() => createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey()), []);

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
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("sb-")) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach((key) => {
                if (key.startsWith("sb-")) sessionStorage.removeItem(key);
            });
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
            });
            router.replace("/");
            router.refresh();
        }
    };

    /* SCROLL PROGRESSBAR */
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 140,
        damping: 28,
        mass: 0.25,
    });

    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    if (pathname === "/login" || pathname === "/signup") {
        return null;
    }

    return (
        <>
            <header className="relative sticky top-0 z-[9999] w-full bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md transition-colors duration-300 dark:bg-slate-900/60">
                <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-2 sm:gap-3 sm:px-4 md:px-6">
                    <div className="flex min-w-0 shrink-0 items-center">
                        <Link href="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                            <Image
                                src="/icons/sahidawa-logo.png"
                                alt={tNavbar("logo_alt")}
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

                    <DesktopNavLinks />

                    <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
                        {/* Bookmarks Link - Visible for Authenticated Users */}
                        {session && (
                            <Link
                                href="/my-medicines"
                                className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:flex dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            >
                                <Bookmark size={18} />
                                <span className="hidden md:inline">Saved</span>
                            </Link>
                        )}

                        <div className="group relative flex items-center">
                            <Link
                                href="/health"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-10"
                                aria-label={tHome("open_ai_health_assistant")}
                            >
                                <MessageCircle size={16} />
                            </Link>
                        </div>

                        <div className="hidden items-center gap-2 sm:flex">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>

                        <UserDropdown
                            session={session}
                            authLoading={authLoading}
                            handleSignOut={handleSignOut}
                        />

                        <MobileMenu
                            session={session}
                            isMenuOpen={isMenuOpen}
                            setIsMenuOpen={setIsMenuOpen}
                            handleSignOut={handleSignOut}
                        />
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 h-[4px] w-full overflow-visible bg-black/[0.06] dark:bg-white/[0.08]">
                    <motion.div
                        aria-hidden="true"
                        style={{ scaleX }}
                        className="relative h-full w-full origin-left"
                    >
                        {/* Tonal gradient fill */}
                        <div className="h-full w-full rounded-r-full bg-gradient-to-r from-emerald-500/80 to-emerald-500 dark:from-emerald-400/80 dark:to-emerald-400" />

                        {/* Soft ambient glow */}
                        <div className="absolute inset-0 rounded-r-full bg-emerald-500 opacity-30 blur-[5px] dark:bg-emerald-400 dark:opacity-40" />

                        {/* Leading edge highlight */}
                        <div
                            className="absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-600 dark:bg-emerald-300"
                            style={{
                                boxShadow: "0 0 6px rgba(16,185,129,0.6)",
                            }}
                        />
                    </motion.div>
                </div>
            </header>

            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px] sm:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            <MobileBottomNav isNavVisible={isNavVisible} />
        </>
    );
}
