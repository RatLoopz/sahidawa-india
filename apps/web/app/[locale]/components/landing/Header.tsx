"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { ScanLine, Menu, X } from "lucide-react";
import LanguageSwitcher from "../../LanguageSwitcher";
import { ThemeToggle } from "../ThemeToggle";
import { NavLink } from "./NavLink";

export const Header = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 30);
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, []);

    const isDark = mounted && resolvedTheme === "dark";

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
                scrolled ? "shadow-sm shadow-teal-100/50 dark:shadow-teal-900/20" : ""
            }`}
            style={{
                background: scrolled
                    ? isDark
                        ? "rgba(15,23,42,0.92)"
                        : "rgba(255,255,255,0.92)"
                    : "transparent",
                backdropFilter: scrolled ? "blur(20px)" : "none",
                WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
                borderBottom: scrolled
                    ? isDark
                        ? "1px solid rgba(51,65,85,0.6)"
                        : "1px solid rgba(204,251,241,0.6)"
                    : "1px solid transparent",
            }}
        >
            <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                <div className="flex h-[68px] items-center justify-between">
                    <a href="/" className="flex items-center gap-2.5" aria-label="SahiDawa Home">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm sm:h-10 sm:w-10 dark:bg-blue-900/30 dark:text-blue-400">
                            <img
                                src="/favicon.ico"
                                alt=""
                                aria-hidden="true"
                                className="h-7 w-7 object-contain"
                                width={28}
                                height={28}
                            />
                        </div>
                        <span className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Sahi<span className="text-teal-600 dark:text-teal-400">Dawa</span>
                        </span>
                    </a>

                    <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
                        <NavLink href="#how-it-works">How It Works</NavLink>
                        <NavLink href="#features">Features</NavLink>
                        <NavLink href="#trust">Trust &amp; Safety</NavLink>
                        <NavLink href="#alerts">
                            <span className="relative">
                                Alerts
                                <span className="absolute -top-0.5 -right-2.5 flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                                </span>
                            </span>
                        </NavLink>
                    </nav>

                    <div className="hidden items-center gap-3 md:flex">
                        <a
                            href="/login"
                            className="px-2 py-1.5 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        >
                            Sign In
                        </a>
                        <a
                            href="/scan"
                            className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                            style={{
                                background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                                boxShadow: "0 4px 20px rgba(13,148,136,0.35)",
                            }}
                        >
                            <ScanLine size={15} strokeWidth={2.5} />
                            Scan Medicine
                        </a>
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-800">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>
                    </div>

                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                    >
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="anim-fade-up border-t border-slate-100 bg-white/98 px-5 py-6 backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-slate-950/98">
                    <div className="flex flex-col gap-5">
                        {[
                            ["How It Works", "#how-it-works"],
                            ["Features", "#features"],
                            ["Trust & Safety", "#trust"],
                            ["Alerts", "#alerts"],
                        ].map(([label, href]) => (
                            <a
                                key={label}
                                href={href}
                                className="text-base font-semibold text-slate-700 transition-colors hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-400"
                                onClick={() => setMenuOpen(false)}
                            >
                                {label}
                            </a>
                        ))}
                        <a
                            href="/scan"
                            className="btn-primary mt-2 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
                        >
                            <ScanLine size={16} /> Scan Your Medicine
                        </a>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
                            <span className="text-sm font-bold text-slate-500">Preferences</span>
                            <div className="flex items-center gap-3">
                                <LanguageSwitcher />
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
