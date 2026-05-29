"use client";

import React, { useEffect, useState, useRef } from "react";
import {
    Camera,
    Mic,
    MapPin,
    Bell,
    Home,
    User,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Database,
    ArrowRight,
    ScanLine,
    HeartPulse,
    CheckCircle2,
    Lock,
    Zap,
    Star,
    Menu,
    X,
    Mail,
    ChevronDown,
    BadgeCheck,
    FlaskConical,
    Pill,
    Building2,
    Activity,
    Fingerprint,
    Layers,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";

/* ─────────────────────────────────────────────────────────────
   GLOBAL STYLES  (injected once)
───────────────────────────────────────────────────────────── */
const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
            --teal:   #0d9488;
            --cyan:   #06b6d4;
            --blue:   #2563eb;
            --ink:    #0a0f1e;
            --mist:   #f0fafa;
        }

        html { scroll-behavior: smooth; }

        body { font-family: 'Instrument Sans', sans-serif; }

        .display, h1, h2, h3, h4 {
            font-family: 'Bricolage Grotesque', sans-serif;
            letter-spacing: -0.025em;
        }

        /* ── Noise texture overlay ── */
        .noise::after {
            content: '';
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
            opacity: 0.03;
            pointer-events: none;
            border-radius: inherit;
        }

        /* ── Keyframes ── */
        @keyframes fade-up {
            from { opacity: 0; transform: translateY(28px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes float-slow {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            33%       { transform: translateY(-10px) rotate(1deg); }
            66%       { transform: translateY(-5px) rotate(-1deg); }
        }
        @keyframes float-med {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-14px); }
        }
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }
        @keyframes scan-laser {
            0%   { top: 12%; }
            50%  { top: 82%; }
            100% { top: 12%; }
        }
        @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
        }
        @keyframes orbit {
            from { transform: rotate(0deg) translateX(120px) rotate(0deg); }
            to   { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
        }
        @keyframes counter-orbit {
            from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
            to   { transform: rotate(-360deg) translateX(80px) rotate(360deg); }
        }
        @keyframes ping-slow {
            0%   { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes bar-grow {
            from { transform: scaleY(0); }
            to   { transform: scaleY(1); }
        }
        @keyframes slide-right {
            from { transform: translateX(-100%); }
            to   { transform: translateX(0); }
        }
        @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
        }

        /* ── Utility classes ── */
        .anim-fade-up   { animation: fade-up  0.7s cubic-bezier(.22,1,.36,1) both; }
        .anim-fade-in   { animation: fade-in  0.6s ease both; }
        .anim-float     { animation: float-slow 7s ease-in-out infinite; }
        .anim-float-med { animation: float-med  5s ease-in-out infinite; }
        .anim-spin-slow { animation: spin-slow 22s linear infinite; }
        .anim-spin-rev  { animation: spin-slow 18s linear infinite reverse; }
        .anim-orbit     { animation: orbit 14s linear infinite; }
        .anim-c-orbit   { animation: counter-orbit 10s linear infinite; }
        .anim-marquee   { animation: marquee 28s linear infinite; }

        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-400 { animation-delay: 400ms; }
        .delay-500 { animation-delay: 500ms; }
        .delay-600 { animation-delay: 600ms; }
        .delay-700 { animation-delay: 700ms; }
        .delay-800 { animation-delay: 800ms; }

        .scan-laser {
            position: absolute; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent 0%, #2dd4bf 20%, #67e8f9 50%, #2dd4bf 80%, transparent 100%);
            box-shadow: 0 0 18px 4px rgba(45,212,191,0.7);
            animation: scan-laser 2.8s ease-in-out infinite;
        }

        .shimmer-text {
            background: linear-gradient(90deg, #0d9488 0%, #06b6d4 30%, #38bdf8 50%, #06b6d4 70%, #0d9488 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 4s linear infinite;
        }

        .glass {
            background: rgba(255,255,255,0.72);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255,255,255,0.55);
        }

        .glass-dark {
            background: rgba(10,15,30,0.65);
            backdrop-filter: blur(20px) saturate(160%);
            -webkit-backdrop-filter: blur(20px) saturate(160%);
            border: 1px solid rgba(255,255,255,0.08);
        }

        .card-lift {
            transition: transform 0.35s cubic-bezier(.22,1,.36,1),
                        box-shadow 0.35s cubic-bezier(.22,1,.36,1);
        }
        .card-lift:hover {
            transform: translateY(-6px);
            box-shadow: 0 28px 60px -12px rgba(13,148,136,0.18);
        }

        .btn-primary {
            position: relative; overflow: hidden;
        }
        .btn-primary::before {
            content: '';
            position: absolute; inset: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%);
            opacity: 0;
            transition: opacity 0.3s;
        }
        .btn-primary:hover::before { opacity: 1; }

        .underline-wave {
            position: relative; display: inline-block;
        }
        .underline-wave::after {
            content: '';
            position: absolute;
            bottom: -4px; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, #0d9488, #06b6d4, #38bdf8);
            border-radius: 999px;
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.4s cubic-bezier(.22,1,.36,1);
        }
        .underline-wave:hover::after { transform: scaleX(1); }

        /* Ticker bar */
        .ticker-wrap { overflow: hidden; }
        .ticker { display: flex; width: max-content; }

        /* Step connector */
        .step-connector {
            position: absolute;
            top: 40px; left: calc(50% + 60px);
            width: calc(100% - 120px);
            height: 1px;
            background: linear-gradient(90deg, #5eead4, #93c5fd);
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f0fafa; }
        ::-webkit-scrollbar-thumb { background: #99f6e4; border-radius: 3px; }
    `}</style>
);

/* ─────────────────────────────────────────────────────────────
   MEDICINE CARD ILLUSTRATION
───────────────────────────────────────────────────────────── */
const MedicineIllustration = () => (
    <div className="anim-float relative mx-auto w-full max-w-[460px] select-none">
        {/* Orbital rings */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="anim-spin-slow absolute h-[300px] w-[300px] rounded-full border border-teal-200/40 md:h-[420px] md:w-[420px]" />
            <div className="anim-spin-rev absolute h-[240px] w-[240px] rounded-full border border-cyan-200/30 md:h-[340px] md:w-[340px]" />

            {/* Orbiting dots */}
            <div className="absolute flex h-[300px] w-[300px] items-center justify-center md:h-[420px] md:w-[420px]">
                <div className="anim-orbit absolute">
                    <div className="relative h-4 w-4 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shadow-teal-300/50 md:h-5 md:w-5">
                        <div className="absolute inset-0 animate-ping rounded-full bg-teal-400 opacity-60" />
                    </div>
                </div>
            </div>
            <div className="absolute flex h-[240px] w-[240px] items-center justify-center md:h-[340px] md:w-[340px]">
                <div className="anim-c-orbit absolute">
                    <div className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shadow-md shadow-blue-300/50 md:h-3 md:w-3" />
                </div>
            </div>
        </div>

        {/* Main card */}
        <div
            className="noise relative z-10 overflow-hidden rounded-[2rem] shadow-2xl shadow-teal-900/10"
            style={{
                background: "linear-gradient(145deg, #ffffff 0%, #f0fdfa 100%)",
                border: "1px solid rgba(204,251,241,0.8)",
            }}
        >
            {/* Top rainbow bar */}
            <div
                className="h-1.5 w-full"
                style={{
                    background:
                        "linear-gradient(90deg, #0d9488, #06b6d4, #3b82f6, #06b6d4, #0d9488)",
                    backgroundSize: "200% auto",
                    animation: "shimmer 3s linear infinite",
                }}
            />

            <div className="p-7">
                {/* Header row */}
                <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="relative flex h-13 w-13 items-center justify-center rounded-2xl"
                            style={{
                                background: "linear-gradient(135deg, #ccfbf1 0%, #cffafe 100%)",
                                border: "1px solid rgba(94,234,212,0.4)",
                            }}
                        >
                            <Pill size={22} className="text-teal-600" />
                        </div>
                        <div>
                            <p className="mb-0.5 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
                                Verified Drug
                            </p>
                            <p className="text-[15px] leading-tight font-bold text-slate-800">
                                Paracetamol 500mg
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">
                                Tab. · Batch #PM4892
                            </p>
                        </div>
                    </div>
                    <span
                        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"
                        style={{
                            background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                            border: "1px solid #6ee7b7",
                        }}
                    >
                        <CheckCircle2 size={11} strokeWidth={3} /> Authentic
                    </span>
                </div>

                {/* Barcode section */}
                <div
                    className="relative mb-5 overflow-hidden rounded-2xl p-4"
                    style={{
                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                        border: "1px solid #e2e8f0",
                    }}
                >
                    <p className="mb-3 text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                        Batch Barcode
                    </p>
                    <div
                        className="mb-2.5 flex h-14 items-end gap-[2.5px]"
                        style={{
                            transformOrigin: "bottom",
                            animation: "bar-grow 0.8s cubic-bezier(.22,1,.36,1) 0.3s both",
                        }}
                    >
                        {[
                            3, 1, 4, 1, 5, 2, 3, 1, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 4, 5, 1, 2, 3,
                            4, 1, 2,
                        ].map((h, i) => (
                            <div
                                key={i}
                                className="rounded-sm"
                                style={{
                                    height: `${h * 19}%`,
                                    background: "#1e293b",
                                    width: h === 1 ? "2px" : h === 5 ? "4px" : "3px",
                                    minWidth: "2px",
                                    opacity: 0.75 + (i % 3) * 0.08,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-center font-mono text-[9px] tracking-[0.35em] text-slate-500">
                        4 8 0 9 2 · 1 7 3 6
                    </p>
                </div>

                {/* Scanning laser */}
                <div
                    className="relative mb-5 overflow-hidden rounded-2xl"
                    style={{
                        height: "56px",
                        background: "linear-gradient(135deg, #f0fdfa, #ecfeff)",
                        border: "1px solid #99f6e4",
                    }}
                >
                    <div className="scan-laser" />
                    <div className="relative z-10 flex h-full items-center justify-center gap-2">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
                        <p className="text-[13px] font-semibold text-teal-700">
                            Verifying authenticity…
                        </p>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            label: "CDSCO",
                            val: "Approved",
                            color: "#065f46",
                            bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
                            border: "#6ee7b7",
                        },
                        {
                            label: "Batch",
                            val: "Valid",
                            color: "#1e40af",
                            bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                            border: "#93c5fd",
                        },
                        {
                            label: "Trust",
                            val: "100%",
                            color: "#115e59",
                            bg: "linear-gradient(135deg,#ccfbf1,#cffafe)",
                            border: "#5eead4",
                        },
                    ].map(({ label, val, color, bg, border }) => (
                        <div
                            key={label}
                            className="rounded-xl p-3 text-center"
                            style={{ background: bg, border: `1px solid ${border}` }}
                        >
                            <p
                                className="mb-1 text-[9px] font-bold tracking-[0.15em] uppercase"
                                style={{ color: `${color}99` }}
                            >
                                {label}
                            </p>
                            <p className="text-[13px] font-extrabold" style={{ color }}>
                                {val}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Floating badge — right */}
        <div
            className="glass anim-float-med absolute top-1/3 -right-10 z-20 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{ animationDelay: "1s" }}
        >
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
            >
                <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
                <p className="mb-0.5 text-[10px] font-semibold text-slate-400">Safety Score</p>
                <p className="text-sm font-extrabold text-slate-800">Excellent ✓</p>
            </div>
        </div>

        {/* Floating badge — left */}
        <div
            className="glass anim-float-med absolute bottom-1/4 -left-10 z-20 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{ animationDelay: "2.5s" }}
        >
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
            >
                <BadgeCheck size={18} className="text-white" />
            </div>
            <div>
                <p className="mb-0.5 text-[10px] font-semibold text-slate-400">Manufacturer</p>
                <p className="text-sm font-extrabold text-slate-800">Verified</p>
            </div>
        </div>

        {/* Glow blob behind card */}
        <div
            className="absolute inset-0 -z-10 scale-90 rounded-3xl blur-3xl"
            style={{
                background:
                    "radial-gradient(ellipse at 50% 50%, rgba(45,212,191,0.25), rgba(96,165,250,0.12), transparent 70%)",
            }}
        />
    </div>
);

/* ─────────────────────────────────────────────────────────────
   NAV LINK
───────────────────────────────────────────────────────────── */
const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a
        href={href}
        className="underline-wave text-[13.5px] font-semibold text-slate-600 transition-colors duration-200 hover:text-teal-700"
    >
        {children}
    </a>
);

/* ─────────────────────────────────────────────────────────────
   TICKER BAR
───────────────────────────────────────────────────────────── */
const TickerBar = () => {
    const items = [
        "✦ CDSCO Database Synced",
        "✦ 2M+ Medicines Verified",
        "✦ 5,000+ Safe Pharmacies",
        "✦ Real-time Recall Alerts",
        "✦ AI-Powered Detection",
        "✦ Trusted by 10,000+ Users",
        "✦ 99.9% Accuracy Rate",
        "✦ Zero Counterfeit Tolerance",
    ];
    const doubled = [...items, ...items];
    return (
        <div
            className="ticker-wrap w-full overflow-hidden border-y border-teal-100/80 py-3"
            style={{ background: "linear-gradient(90deg, #f0fdfa 0%, #ecfeff 50%, #f0fdfa 100%)" }}
        >
            <div className="ticker anim-marquee gap-12">
                {doubled.map((item, i) => (
                    <span
                        key={i}
                        className="px-6 text-xs font-bold tracking-wide whitespace-nowrap text-teal-700"
                    >
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function SahiDawaHome() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 30);
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, []);

    return (
        <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
            <GlobalStyles />

            {/* ══════════════════════════════
                NAV
            ══════════════════════════════ */}
            <header
                className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "shadow-sm shadow-teal-100/50" : ""}`}
                style={{
                    background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
                    backdropFilter: scrolled ? "blur(20px)" : "none",
                    borderBottom: scrolled
                        ? "1px solid rgba(204,251,241,0.6)"
                        : "1px solid transparent",
                }}
            >
                <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                    <div className="flex h-[68px] items-center justify-between">
                        {/* Logo */}
                        <a href="/" className="flex items-center gap-2.5">
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

                        {/* Desktop nav */}
                        <nav className="hidden items-center gap-8 md:flex">
                            <NavLink href="#how-it-works">How It Works</NavLink>
                            <NavLink href="#features">Features</NavLink>
                            <NavLink href="#trust">Trust & Safety</NavLink>
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

                        {/* Right actions */}
                        <div className="hidden items-center gap-3 md:flex">
                            <a
                                href="/login"
                                className="px-2 py-1.5 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-800"
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

                        {/* Mobile toggle */}
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
                        >
                            {menuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="anim-fade-up border-t border-slate-100 bg-white/98 px-5 py-6 backdrop-blur-xl md:hidden">
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
                                    className="text-base font-semibold text-slate-700 transition-colors hover:text-teal-700"
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
                                <span className="text-sm font-bold text-slate-500">
                                    Preferences
                                </span>
                                <div className="flex items-center gap-3">
                                    <LanguageSwitcher />
                                    <ThemeToggle />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main>
                {/* ══════════════════════════════
                    HERO
                ══════════════════════════════ */}
                <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-[68px]">
                    {/* Mesh gradient background */}
                    <div
                        className="absolute inset-0 -z-10"
                        style={{
                            background:
                                "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(204,251,241,0.55) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 70%, rgba(186,230,253,0.35) 0%, transparent 55%), radial-gradient(ellipse 40% 40% at 50% 10%, rgba(240,253,250,0.9) 0%, white 70%)",
                        }}
                    />

                    {/* Subtle dot grid */}
                    <div
                        className="absolute inset-0 -z-10 opacity-[0.4]"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle, #99f6e4 1px, transparent 1px)",
                            backgroundSize: "36px 36px",
                        }}
                    />

                    <div className="relative mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center px-5 sm:px-8 lg:px-10">
                        <div className="grid grid-cols-1 items-center gap-16 py-20 lg:grid-cols-2 lg:gap-8 lg:py-24">
                            {/* ── Left content ── */}
                            <div className="flex flex-col items-start">
                                {/* Pill badge */}
                                <div
                                    className="anim-fade-up mb-7 flex items-center gap-2.5 rounded-full py-2 pr-5 pl-2 text-[12px] font-bold text-teal-800"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, rgba(204,251,241,0.9), rgba(207,250,254,0.9))",
                                        border: "1px solid rgba(94,234,212,0.6)",
                                        backdropFilter: "blur(10px)",
                                    }}
                                >
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-full"
                                        style={{
                                            background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                                        }}
                                    >
                                        <ShieldCheck
                                            size={12}
                                            className="text-white"
                                            strokeWidth={3}
                                        />
                                    </span>
                                    Trusted Medical Verification Platform
                                    <span className="ml-1 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                        LIVE
                                    </span>
                                </div>

                                {/* Headline */}
                                <h1 className="anim-fade-up mb-6 text-[2.5rem] leading-[1.05] font-extrabold text-slate-900 delay-100 md:text-[3.25rem] lg:text-[4.25rem]">
                                    Your Health, <br className="hidden sm:block" />
                                    <span className="shimmer-text">Verified</span>{" "}
                                    <span className="relative">
                                        &amp; Protected
                                        <svg
                                            className="absolute -bottom-2 left-0 w-full"
                                            viewBox="0 0 320 10"
                                            preserveAspectRatio="none"
                                        >
                                            <path
                                                d="M4 7 Q80 2 160 6 Q240 10 316 5"
                                                stroke="url(#wg)"
                                                strokeWidth="3"
                                                fill="none"
                                                strokeLinecap="round"
                                            />
                                            <defs>
                                                <linearGradient id="wg" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#0d9488" />
                                                    <stop offset="100%" stopColor="#38bdf8" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                    </span>
                                </h1>

                                {/* Subtext */}
                                <p className="anim-fade-up mb-9 max-w-[480px] text-[17px] leading-[1.7] font-medium text-slate-500 delay-200">
                                    Instantly verify any medicine using AI-powered scanning. Detect
                                    counterfeits, check CDSCO approvals, and locate safe pharmacies
                                    — all in under 2 seconds.
                                </p>

                                {/* CTAs */}
                                <div className="anim-fade-up mb-10 flex w-full flex-wrap gap-3.5 delay-300">
                                    <a
                                        href="/scan"
                                        className="btn-primary group flex items-center gap-2.5 rounded-2xl px-7 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)",
                                            boxShadow:
                                                "0 8px 30px rgba(13,148,136,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                                        }}
                                    >
                                        <ScanLine size={19} strokeWidth={2.5} />
                                        Scan Your Medicine Now
                                        <ArrowRight
                                            size={17}
                                            className="opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                                        />
                                    </a>
                                    <a
                                        href="#how-it-works"
                                        className="flex items-center gap-2 rounded-2xl border-2 bg-white/70 px-7 py-4 text-[15px] font-bold text-slate-700 backdrop-blur-sm transition-all duration-300 hover:border-teal-300 hover:bg-white hover:shadow-lg hover:shadow-teal-100/60"
                                        style={{ borderColor: "#e2e8f0" }}
                                    >
                                        Learn More
                                        <ChevronDown size={17} className="text-slate-400" />
                                    </a>
                                </div>

                                {/* Social proof */}
                                <div className="anim-fade-up flex flex-wrap items-center gap-6 delay-400">
                                    <div className="flex items-center gap-3">
                                        <div className="flex -space-x-2.5">
                                            {["#ccfbf1", "#cffafe", "#dbeafe", "#ede9fe"].map(
                                                (bg, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-sm"
                                                        style={{ background: bg }}
                                                    >
                                                        <User
                                                            size={13}
                                                            className="text-slate-500"
                                                        />
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div>
                                            <div className="mb-0.5 flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <Star
                                                        key={i}
                                                        size={11}
                                                        className="fill-amber-400 text-amber-400"
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-[13px] font-semibold text-slate-500">
                                                <span className="font-extrabold text-slate-900">
                                                    10,000+
                                                </span>{" "}
                                                verified users
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                                    <div className="flex items-center gap-2">
                                        <BadgeCheck size={18} className="text-teal-500" />
                                        <p className="text-[13px] font-semibold text-slate-500">
                                            <span className="font-extrabold text-slate-900">
                                                CDSCO
                                            </span>{" "}
                                            Synced Daily
                                        </p>
                                    </div>
                                    <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                                    <div className="flex items-center gap-2">
                                        <Activity size={18} className="text-rose-500" />
                                        <p className="text-[13px] font-semibold text-slate-500">
                                            <span className="font-extrabold text-slate-900">
                                                99.9%
                                            </span>{" "}
                                            Accuracy
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Right illustration ── */}
                            <div className="anim-fade-in relative flex justify-center delay-300 lg:justify-end lg:pr-4">
                                <MedicineIllustration />
                            </div>
                        </div>
                    </div>

                    {/* Scroll indicator */}
                    <div className="anim-fade-up absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 delay-700">
                        <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                            Scroll
                        </p>
                        <div className="h-8 w-px overflow-hidden rounded-full bg-slate-200">
                            <div
                                className="h-full w-full bg-gradient-to-b from-teal-500 to-transparent"
                                style={{ animation: "slide-right 1.8s ease-in-out infinite" }}
                            />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    TICKER
                ══════════════════════════════ */}
                <TickerBar />

                {/* ══════════════════════════════
                    TRUST CARDS
                ══════════════════════════════ */}
                <section
                    id="trust"
                    className="py-24 lg:py-32"
                    style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)" }}
                >
                    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                        {/* Section header */}
                        <div className="mb-16 max-w-2xl">
                            <span
                                className="anim-fade-up mb-4 inline-block rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-teal-700 uppercase"
                                style={{
                                    background: "linear-gradient(135deg, #ccfbf1, #cffafe)",
                                    border: "1px solid #99f6e4",
                                }}
                            >
                                Built on Trust
                            </span>
                            <h2 className="anim-fade-up mb-4 text-[2.5rem] leading-tight font-extrabold text-slate-900 delay-100 lg:text-[3rem]">
                                Healthcare decisions
                                <br />
                                deserve absolute certainty.
                            </h2>
                            <p className="anim-fade-up text-[16px] leading-relaxed font-medium text-slate-500 delay-200">
                                Every feature is engineered with one goal: zero tolerance for
                                counterfeits, zero compromise on your safety.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                {
                                    icon: <ShieldCheck size={26} />,
                                    color: "#0d9488",
                                    bg: "linear-gradient(145deg, #f0fdfa, #ccfbf1)",
                                    border: "#99f6e4",
                                    iconBg: "linear-gradient(135deg, #0d9488, #06b6d4)",
                                    title: "Verified Medicines",
                                    desc: "Cross-referenced against CDSCO's official approved drug list in real time with every scan.",
                                    stat: "2M+",
                                    statLabel: "medicines verified",
                                    delay: "0ms",
                                },
                                {
                                    icon: <Building2 size={26} />,
                                    color: "#2563eb",
                                    bg: "linear-gradient(145deg, #eff6ff, #dbeafe)",
                                    border: "#93c5fd",
                                    iconBg: "linear-gradient(135deg, #2563eb, #4f46e5)",
                                    title: "Safe Pharmacies",
                                    desc: "Geo-mapped and regularly audited pharmacies with zero counterfeit history.",
                                    stat: "5,000+",
                                    statLabel: "pharmacies listed",
                                    delay: "80ms",
                                },
                                {
                                    icon: <Database size={26} />,
                                    color: "#7c3aed",
                                    bg: "linear-gradient(145deg, #f5f3ff, #ede9fe)",
                                    border: "#c4b5fd",
                                    iconBg: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                    title: "Trusted Data",
                                    desc: "Direct feeds from CDSCO, WHO, and manufacturers — no aggregator guesswork.",
                                    stat: "99.9%",
                                    statLabel: "data accuracy",
                                    delay: "160ms",
                                },
                                {
                                    icon: <Zap size={26} />,
                                    color: "#b45309",
                                    bg: "linear-gradient(145deg, #fffbeb, #fef3c7)",
                                    border: "#fcd34d",
                                    iconBg: "linear-gradient(135deg, #d97706, #f59e0b)",
                                    title: "Real-time Alerts",
                                    desc: "Instant push notifications for recalled, banned, or flagged drugs before they reach you.",
                                    stat: "<2s",
                                    statLabel: "alert response",
                                    delay: "240ms",
                                },
                            ].map(
                                ({
                                    icon,
                                    color,
                                    bg,
                                    border,
                                    iconBg,
                                    title,
                                    desc,
                                    stat,
                                    statLabel,
                                    delay,
                                }) => (
                                    <div
                                        key={title}
                                        className="card-lift group noise relative overflow-hidden rounded-3xl p-7"
                                        style={{
                                            background: bg,
                                            border: `1px solid ${border}`,
                                            animationDelay: delay,
                                        }}
                                    >
                                        {/* Icon */}
                                        <div
                                            className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                                            style={{
                                                background: iconBg,
                                                boxShadow: `0 8px 24px ${color}33`,
                                                color: "white",
                                            }}
                                        >
                                            {icon}
                                        </div>

                                        <h3 className="mb-2.5 text-[17px] font-bold text-slate-900">
                                            {title}
                                        </h3>
                                        <p className="mb-6 text-[13.5px] leading-relaxed text-slate-600">
                                            {desc}
                                        </p>

                                        {/* Stat */}
                                        <div
                                            className="flex items-end gap-2 pt-5"
                                            style={{ borderTop: `1px solid ${border}` }}
                                        >
                                            <p
                                                className="text-[2rem] leading-none font-extrabold"
                                                style={{ color }}
                                            >
                                                {stat}
                                            </p>
                                            <p className="mb-0.5 text-[12px] font-semibold text-slate-400">
                                                {statLabel}
                                            </p>
                                        </div>

                                        {/* Corner accent */}
                                        <div
                                            className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full opacity-20 transition-opacity duration-300 group-hover:opacity-40"
                                            style={{ background: iconBg }}
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    HOW IT WORKS
                ══════════════════════════════ */}
                <section
                    id="how-it-works"
                    className="noise relative overflow-hidden py-24 lg:py-32"
                    style={{
                        background:
                            "linear-gradient(135deg, #0a0f1e 0%, #0d2137 50%, #0a1a2e 100%)",
                    }}
                >
                    {/* BG glows */}
                    <div className="pointer-events-none absolute inset-0">
                        <div
                            className="absolute top-0 left-1/4 h-80 w-80 rounded-full blur-3xl"
                            style={{
                                background:
                                    "radial-gradient(circle, rgba(13,148,136,0.15), transparent 70%)",
                            }}
                        />
                        <div
                            className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full blur-3xl"
                            style={{
                                background:
                                    "radial-gradient(circle, rgba(37,99,235,0.12), transparent 70%)",
                            }}
                        />
                        {/* Subtle grid */}
                        <div
                            className="absolute inset-0 opacity-[0.06]"
                            style={{
                                backgroundImage:
                                    "linear-gradient(rgba(99,255,230,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,255,230,0.3) 1px, transparent 1px)",
                                backgroundSize: "60px 60px",
                            }}
                        />
                    </div>

                    <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                        <div className="mb-5 flex justify-center">
                            <span
                                className="rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-teal-400 uppercase"
                                style={{
                                    background: "rgba(13,148,136,0.15)",
                                    border: "1px solid rgba(20,184,166,0.3)",
                                }}
                            >
                                Simple Process
                            </span>
                        </div>
                        <h2 className="mb-4 text-center text-[2.5rem] leading-tight font-extrabold text-white lg:text-[3rem]">
                            Verify any medicine
                            <br />
                            in just 3 steps
                        </h2>
                        <p
                            className="mx-auto mb-20 max-w-xl text-center text-[15px] leading-relaxed font-medium"
                            style={{ color: "rgba(148,163,184,1)" }}
                        >
                            Designed for patients, pharmacists, and doctors — no technical knowledge
                            required.
                        </p>

                        {/* Steps */}
                        <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
                            {/* Desktop connector */}
                            <div
                                className="step-connector hidden md:block"
                                style={{
                                    background:
                                        "linear-gradient(90deg, rgba(94,234,212,0.6), rgba(147,197,253,0.6))",
                                    left: "calc(16.66% + 40px)",
                                    width: "calc(66.66% - 80px)",
                                }}
                            />

                            {[
                                {
                                    num: "01",
                                    icon: <Camera size={26} />,
                                    color: "#2dd4bf",
                                    glow: "rgba(45,212,191,0.2)",
                                    title: "Scan Medicine",
                                    desc: "Point your camera at the barcode, QR code, or packaging. Our AI captures it instantly — no special hardware needed.",
                                    tag: "Step 1",
                                },
                                {
                                    num: "02",
                                    icon: <FlaskConical size={26} />,
                                    color: "#60a5fa",
                                    glow: "rgba(96,165,250,0.2)",
                                    title: "Verify Authenticity",
                                    desc: "Cross-matched against 2M+ records — CDSCO approvals, manufacturer data, batch numbers, and counterfeit alerts.",
                                    tag: "Step 2",
                                },
                                {
                                    num: "03",
                                    icon: <CheckCircle2 size={26} />,
                                    color: "#4ade80",
                                    glow: "rgba(74,222,128,0.2)",
                                    title: "Get Safe Results",
                                    desc: "Receive a clear Authentic, Flagged, or Recalled verdict with actionable next steps in under 2 seconds.",
                                    tag: "Step 3",
                                },
                            ].map(({ num, icon, color, glow, title, desc, tag }) => (
                                <div
                                    key={num}
                                    className="glass-dark card-lift group relative cursor-default rounded-3xl p-8"
                                >
                                    {/* Number watermark */}
                                    <span
                                        className="absolute top-5 right-7 text-[4rem] leading-none font-black select-none"
                                        style={{ color: "rgba(255,255,255,0.03)" }}
                                    >
                                        {num}
                                    </span>

                                    {/* Icon */}
                                    <div
                                        className="relative mb-7 inline-flex h-[60px] w-[60px] items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                                        style={{
                                            background: glow,
                                            border: `1px solid ${color}40`,
                                            color,
                                        }}
                                    >
                                        {icon}
                                        <div
                                            className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                            style={{ background: glow }}
                                        />
                                    </div>

                                    {/* Tag */}
                                    <div
                                        className="mb-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] uppercase"
                                        style={{
                                            background: `${color}18`,
                                            color,
                                            border: `1px solid ${color}30`,
                                        }}
                                    >
                                        {tag}
                                    </div>

                                    <h3 className="mb-3 text-[20px] font-bold text-white">
                                        {title}
                                    </h3>
                                    <p
                                        className="text-[14px] leading-relaxed"
                                        style={{ color: "rgba(148,163,184,0.9)" }}
                                    >
                                        {desc}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <div className="mt-14 flex justify-center">
                            <a
                                href="/scan"
                                className="btn-primary group flex items-center gap-3 rounded-2xl px-8 py-4.5 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                                style={{
                                    background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                                    boxShadow: "0 8px 40px rgba(13,148,136,0.4)",
                                }}
                            >
                                <ScanLine size={19} />
                                Try It Free — No Account Needed
                                <ArrowRight
                                    size={17}
                                    className="opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                                />
                            </a>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    FEATURES BENTO
                ══════════════════════════════ */}
                <section
                    id="features"
                    className="py-24 lg:py-32"
                    style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}
                >
                    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                        <div className="mb-5 flex justify-center">
                            <span
                                className="rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-blue-700 uppercase"
                                style={{
                                    background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
                                    border: "1px solid #bfdbfe",
                                }}
                            >
                                Core Features
                            </span>
                        </div>
                        <h2 className="mb-4 text-center text-[2.5rem] leading-tight font-extrabold text-slate-900 lg:text-[3rem]">
                            Everything you need.
                            <br />
                            Nothing you don't.
                        </h2>
                        <p className="mx-auto mb-16 max-w-xl text-center text-[15px] leading-relaxed font-medium text-slate-500">
                            A complete platform for safe medicine access — scan, verify, locate, and
                            stay informed.
                        </p>

                        {/* Bento grid */}
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                            {/* Hero feature — spans 7 cols */}
                            <a
                                href="/scan"
                                className="card-lift group noise relative overflow-hidden rounded-3xl p-9 md:col-span-7"
                                style={{
                                    background:
                                        "linear-gradient(145deg, #0d9488 0%, #0891b2 50%, #0369a1 100%)",
                                    minHeight: "320px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                }}
                            >
                                {/* Orb */}
                                <div
                                    className="absolute -top-16 -right-16 h-60 w-60 rounded-full opacity-20"
                                    style={{
                                        background:
                                            "radial-gradient(circle, white, transparent 70%)",
                                    }}
                                />
                                <div
                                    className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-10"
                                    style={{
                                        background:
                                            "radial-gradient(circle, white, transparent 70%)",
                                    }}
                                />

                                <div className="relative z-10">
                                    <div
                                        className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                        style={{
                                            background: "rgba(255,255,255,0.2)",
                                            border: "1px solid rgba(255,255,255,0.3)",
                                            backdropFilter: "blur(10px)",
                                        }}
                                    >
                                        <Fingerprint size={28} className="text-white" />
                                    </div>
                                    <span
                                        className="mb-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold tracking-widest text-teal-200 uppercase"
                                        style={{
                                            background: "rgba(255,255,255,0.15)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                        }}
                                    >
                                        Flagship Feature
                                    </span>
                                    <h3 className="mb-3 text-[1.75rem] leading-tight font-extrabold text-white">
                                        AI-Powered Counterfeit Detection
                                    </h3>
                                    <p className="max-w-md text-[14px] leading-relaxed text-teal-100">
                                        Advanced computer vision analyzes packaging, barcodes,
                                        holograms, and pill morphology — catching even the most
                                        sophisticated fakes in under 2 seconds.
                                    </p>
                                </div>
                                <div className="relative z-10 mt-6 flex items-center gap-2 text-sm font-bold text-white/80 transition-colors group-hover:text-white">
                                    Start Scanning
                                    <ArrowRight
                                        size={16}
                                        className="transition-transform duration-300 group-hover:translate-x-1.5"
                                    />
                                </div>
                            </a>

                            {/* Voice triage — spans 5 cols */}
                            <a
                                href="/health"
                                className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-5"
                                style={{
                                    background: "linear-gradient(145deg, #f5f3ff, #ede9fe)",
                                    border: "1px solid #c4b5fd",
                                    minHeight: "320px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                }}
                            >
                                <div>
                                    <div className="mb-5 flex items-start justify-between">
                                        <div
                                            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                                boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
                                            }}
                                        >
                                            <Mic size={26} className="text-white" />
                                        </div>
                                        <span
                                            className="rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wider text-violet-700 uppercase"
                                            style={{
                                                background: "rgba(124,58,237,0.1)",
                                                border: "1px solid rgba(124,58,237,0.2)",
                                            }}
                                        >
                                            Beta
                                        </span>
                                    </div>
                                    <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                                        AI Voice Triage
                                    </h3>
                                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                                        Speak your symptoms in any Indian language. Our AI maps them
                                        to clinical urgency and recommends your next step.
                                    </p>
                                </div>
                                <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-violet-600 transition-all group-hover:gap-2.5">
                                    Try Voice Triage{" "}
                                    <ArrowRight
                                        size={15}
                                        className="transition-transform duration-300 group-hover:translate-x-1"
                                    />
                                </div>
                            </a>

                            {/* Pharmacy map — spans 4 */}
                            <a
                                href="/map"
                                className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                                style={{
                                    background: "linear-gradient(145deg, #f0fdf4, #dcfce7)",
                                    border: "1px solid #86efac",
                                }}
                            >
                                <div
                                    className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                    style={{
                                        background: "linear-gradient(135deg, #16a34a, #059669)",
                                        boxShadow: "0 8px 24px rgba(22,163,74,0.3)",
                                    }}
                                >
                                    <MapPin size={26} className="text-white" />
                                </div>
                                <span
                                    className="mb-3 inline-block rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase"
                                    style={{
                                        background: "rgba(22,163,74,0.1)",
                                        border: "1px solid rgba(22,163,74,0.2)",
                                    }}
                                >
                                    Live
                                </span>
                                <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                                    Safe Pharmacy Map
                                </h3>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    GPS-guided map of verified pharmacies with zero counterfeit
                                    history. Updated in real time.
                                </p>
                                <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 transition-all group-hover:gap-2.5">
                                    Find Pharmacies{" "}
                                    <ArrowRight
                                        size={15}
                                        className="transition-transform duration-300 group-hover:translate-x-1"
                                    />
                                </div>
                            </a>

                            {/* Alert feed — spans 4 */}
                            <a
                                href="/alerts"
                                className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                                style={{
                                    background: "linear-gradient(145deg, #fff1f2, #ffe4e6)",
                                    border: "1px solid #fca5a5",
                                }}
                            >
                                <div className="mb-5 flex items-start justify-between">
                                    <div
                                        className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                        style={{
                                            background: "linear-gradient(135deg, #dc2626, #e11d48)",
                                            boxShadow: "0 8px 24px rgba(220,38,38,0.3)",
                                        }}
                                    >
                                        <AlertTriangle size={26} className="text-white" />
                                    </div>
                                    <div className="relative mt-1 flex h-3 w-3">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                                    </div>
                                </div>
                                <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                                    National Alert Feed
                                </h3>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    CDSCO recalls and bans pushed directly to you.
                                    Community-reported suspicious batches flagged instantly.
                                </p>
                                <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-rose-600 transition-all group-hover:gap-2.5">
                                    View Active Alerts{" "}
                                    <ArrowRight
                                        size={15}
                                        className="transition-transform duration-300 group-hover:translate-x-1"
                                    />
                                </div>
                            </a>

                            {/* Health Records — spans 4 */}
                            <a
                                href="/reports/me"
                                className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                                style={{
                                    background: "linear-gradient(145deg, #eff6ff, #dbeafe)",
                                    border: "1px solid #93c5fd",
                                }}
                            >
                                <div
                                    className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                    style={{
                                        background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                                        boxShadow: "0 8px 24px rgba(37,99,235,0.3)",
                                    }}
                                >
                                    <Layers size={26} className="text-white" />
                                </div>
                                <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                                    Health Records
                                </h3>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    All your scans, alerts, and prescriptions in one encrypted,
                                    private profile.
                                </p>
                                <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-blue-600 transition-all group-hover:gap-2.5">
                                    My Records{" "}
                                    <ArrowRight
                                        size={15}
                                        className="transition-transform duration-300 group-hover:translate-x-1"
                                    />
                                </div>
                            </a>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    CTA BANNER
                ══════════════════════════════ */}
                <section
                    className="py-16 lg:py-20"
                    style={{ background: "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)" }}
                >
                    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
                        <div
                            className="noise relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20"
                            style={{
                                background:
                                    "linear-gradient(135deg, #0a0f1e 0%, #0d2137 60%, #0a1a2e 100%)",
                            }}
                        >
                            {/* Glows */}
                            <div
                                className="absolute -top-20 -right-20 h-80 w-80 rounded-full blur-3xl"
                                style={{
                                    background:
                                        "radial-gradient(circle, rgba(13,148,136,0.2), transparent 70%)",
                                }}
                            />
                            <div
                                className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full blur-3xl"
                                style={{
                                    background:
                                        "radial-gradient(circle, rgba(37,99,235,0.15), transparent 70%)",
                                }}
                            />

                            {/* Grid overlay */}
                            <div
                                className="absolute inset-0 opacity-[0.04]"
                                style={{
                                    backgroundImage:
                                        "linear-gradient(rgba(99,255,230,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,255,230,0.5) 1px, transparent 1px)",
                                    backgroundSize: "50px 50px",
                                }}
                            />

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div
                                    className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold text-teal-300"
                                    style={{
                                        background: "rgba(13,148,136,0.15)",
                                        border: "1px solid rgba(20,184,166,0.3)",
                                    }}
                                >
                                    <Lock size={13} strokeWidth={2.5} />
                                    Your data is encrypted. Always.
                                </div>

                                <h2 className="mb-5 max-w-3xl text-[2.5rem] leading-tight font-extrabold text-white lg:text-[3.5rem]">
                                    Don't take chances
                                    <br />
                                    with your health.
                                </h2>
                                <p
                                    className="mb-10 max-w-lg text-[16px] leading-relaxed font-medium"
                                    style={{ color: "rgba(148,163,184,0.9)" }}
                                >
                                    Join 10,000+ patients and healthcare professionals who scan
                                    before they consume.
                                </p>

                                <div className="flex flex-col gap-4 sm:flex-row">
                                    <a
                                        href="/scan"
                                        className="btn-primary group flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-[15px] font-bold text-slate-900 transition-all duration-300 hover:-translate-y-0.5"
                                        style={{
                                            background: "linear-gradient(135deg, #f0fdfa, #ffffff)",
                                            boxShadow: "0 8px 40px rgba(255,255,255,0.15)",
                                        }}
                                    >
                                        <ScanLine size={19} className="text-teal-600" />
                                        Scan Your Medicine Now
                                        <ArrowRight
                                            size={17}
                                            className="text-teal-600 opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                                        />
                                    </a>
                                    <a
                                        href="#how-it-works"
                                        className="flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-[15px] font-semibold text-slate-300 transition-all duration-300 hover:text-white"
                                        style={{
                                            border: "1px solid rgba(255,255,255,0.15)",
                                            background: "rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        See How It Works
                                    </a>
                                </div>

                                {/* Trust signals */}
                                <div className="mt-10 flex flex-wrap justify-center gap-6">
                                    {[
                                        "CDSCO Verified",
                                        "256-bit Encryption",
                                        "No Credit Card",
                                        "Free Forever",
                                    ].map((label) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-400"
                                        >
                                            <CheckCircle2
                                                size={14}
                                                className="text-teal-400"
                                                strokeWidth={2.5}
                                            />
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ══════════════════════════════
                MOBILE BOTTOM NAV
            ══════════════════════════════ */}
            <nav
                className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t px-2 py-2.5 pb-[env(safe-area-inset-bottom)] md:hidden"
                style={{
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(20px)",
                    borderColor: "#ccfbf1",
                }}
            >
                {[
                    { icon: <Home size={21} />, label: "Home", href: "/", active: true },
                    { icon: <ScanLine size={21} />, label: "Scan", href: "/scan", active: false },
                    { icon: <MapPin size={21} />, label: "Map", href: "/map", active: false },
                    {
                        icon: <Bell size={21} />,
                        label: "Alerts",
                        href: "/alerts",
                        active: false,
                        badge: true,
                    },
                    { icon: <User size={21} />, label: "Profile", href: "/profile", active: false },
                ].map(({ icon, label, href, active, badge }) => (
                    <a
                        key={label}
                        href={href}
                        className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors duration-200"
                        style={{ color: active ? "#0d9488" : "#94a3b8" }}
                    >
                        <div className="relative">
                            {icon}
                            {badge && (
                                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                            )}
                        </div>
                        <span className="text-[9.5px] font-bold tracking-wide">{label}</span>
                    </a>
                ))}
            </nav>

            <div className="h-16 md:hidden" />
        </div>
    );
}
