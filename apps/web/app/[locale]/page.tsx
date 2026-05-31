"use client";

import React, { useEffect, useState } from "react";
import {
    Camera,
    Mic,
    MapPin,
    Bell,
    History,
    Home,
    User,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Activity,
    MessageCircle,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return "Recent";

    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;

    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) {
        return "Just now";
    } else if (elapsed < msPerHour) {
        return `${Math.round(elapsed / msPerMinute)}m ago`;
    } else if (elapsed < msPerDay) {
        return `${Math.round(elapsed / msPerHour)}h ago`;
    } else {
        return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
}

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const { data } = await supabase
                    .from("medicines")
                    .select("*")
                    .or(
                        "is_counterfeit_alert.eq.true,cdsco_approval_status.eq.recalled,cdsco_approval_status.eq.banned, brand_name.eq.SYSTEM_UPDATE"
                    )
                    .order("created_at", { ascending: false })
                    .limit(4);

                if (data) {
                    setHomepageAlerts(data);
                }
            } catch (err) {
                console.error("Failed to query alerts matrix:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
    }, []);

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    // Placeholder configuration for the desktop link classes if needed
    const desktopNavLinkClassName = "hover:text-emerald-500 transition-colors duration-200";

    return (
        <div className="relative min-h-screen bg-(--color-surface-page) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* ── Background Mesh (Static & High Performance) ── */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
                <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[130px] dark:bg-purple-900/10"></div>
                <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[130px] dark:bg-emerald-900/10"></div>
                <div className="absolute bottom-10 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[130px] dark:bg-blue-900/10"></div>
            </div>

            {/* ── Top Navigation (Kept & Resolved from Fixes/mobile-navbar-signin) ── */}
            <header className="sticky top-0 z-50 w-full border-b border-white/30 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/60">
                <div className="container mx-auto flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
                    {/* Left — Logo */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm sm:h-10 sm:w-10 dark:bg-emerald-950/30 dark:text-emerald-400"
                            aria-label="SahiDawa Logo"
                        >
                            <img
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
                    <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 sm:gap-3">
                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:w-10"
                            aria-label={tHome("open_ai_health_assistant")}
                        >
                            <MessageCircle size={17} />
                        </button>

                        {/* Note: Ensure LanguageSwitcher and ThemeToggle components exist in scope */}
                        {/* <LanguageSwitcher /> */}
                        {/* <ThemeToggle /> */}

                        {/* Mobile Sign-In Button */}
                        <button
                            onClick={() => handleNavigation("login")}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-50/70 text-emerald-700 transition-all duration-200 hover:scale-105 hover:border-emerald-500/50 hover:bg-emerald-100 sm:hidden dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            aria-label={tHome("sign_in")}
                            title={tHome("sign_in")}
                        >
                            <User size={17} />
                            <span className="sr-only">{tHome("sign_in")}</span>
                        </button>

                        {/* Desktop Sign-In Button */}
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

            {/* ── Main ── */}
            <main className="pb-24 md:pb-12">
                {/* ── Sleek Integrated Console Header ── */}
                <section className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 pt-10 pb-6 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-emerald-600 uppercase dark:border-emerald-400/20 dark:text-emerald-400">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>

                    {/* Split-color title */}
                    <h1 className="text-4xl leading-tight font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white">
                        {tHome("heroTitle.prefix")}
                        <span className="ml-1 block bg-linear-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent sm:inline dark:from-emerald-400 dark:to-teal-400">
                            {tHome("heroTitle.highlight")}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed font-semibold text-slate-500 md:text-base dark:text-slate-400">
                        {tHome("subtitle")}
                    </p>

                    {/* Search Bar */}
                    <div className="mx-auto w-full max-w-2xl pt-2">
                        <SearchBar />
                    </div>
                </section>

                <div className="container mx-auto max-w-6xl px-4">
                    {/* ── Primary Action: Scan Medicine ── */}
                    <section className="mt-4 mb-10">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="group relative flex w-full transform-gpu cursor-pointer flex-col justify-center overflow-hidden rounded-3xl border border-emerald-400/30 p-8 text-left text-white shadow-xl shadow-emerald-500/10 transition-all duration-300 select-none hover:scale-[1.01] hover:shadow-emerald-500/20 active:scale-[0.99] md:p-10"
                            aria-label="Scan medicine"
                        >
                            <div className="absolute inset-0 z-0 bg-linear-to-tr from-emerald-700 via-emerald-600 to-emerald-500"></div>
                            <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                                <div className="flex items-center gap-6 md:gap-8">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/15 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:rotate-2 md:h-24 md:w-24">
                                        <Camera
                                            className="h-10 w-10 text-white drop-shadow-md md:h-12 md:w-12"
                                            strokeWidth={2}
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-3xl font-bold tracking-wide drop-shadow-sm md:text-4xl">
                                            {tHome("scan_button")}
                                        </span>
                                        <span className="mt-2 block text-sm font-medium text-emerald-100 opacity-90 md:text-lg">
                                            {tHome("scan_subtitle")}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight
                                    size={36}
                                    className="hidden shrink-0 text-emerald-100 opacity-70 transition-all group-hover:translate-x-2 group-hover:opacity-100 md:block"
                                />
                            </div>
                        </button>
                    </section>

                    {/* ── Explore Features Section ── */}
                    <section className="mb-16">
                        <h2 className="mb-8 bg-linear-to-r from-slate-700 to-slate-500 bg-clip-text text-center text-3xl font-bold tracking-tighter text-transparent dark:from-slate-200 dark:to-slate-400">
                            Explore Features
                        </h2>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Upload Photo */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex h-full min-h-[180px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/50 bg-white/75 p-6 text-left shadow-sm backdrop-blur-md transition-all duration-300 select-none hover:-translate-y-1 hover:scale-[1.01] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 active:scale-[0.99] dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:border-emerald-400/30 dark:hover:shadow-emerald-400/5"
                                aria-label="Upload photo"
                            >
                                <div className="bg-radial-gradient absolute inset-0 -z-10 from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-emerald-500/10"></div>
                                <svg
                                    className="absolute right-4 bottom-4 h-16 w-16 text-slate-300/30 transition-all duration-500 group-hover:scale-110 group-hover:text-emerald-400/30 dark:text-slate-700/20 dark:group-hover:text-emerald-500/20"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
                                    />
                                </svg>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400">
                                        <Camera
                                            size={24}
                                            strokeWidth={2}
                                            className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                                        />
                                    </div>
                                    <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-500 dark:group-hover:text-emerald-400" />
                                </div>
                                <div className="relative z-10 pt-4">
                                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                                        {tHome("upload_photo")}
                                    </h3>
                                    <p className="mt-1 text-xs leading-snug font-semibold text-slate-500 dark:text-slate-400">
                                        {tHome("upload_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Voice Triage */}
                            <button
                                onClick={() => handleNavigation("voice")}
                                className="group relative flex h-full min-h-[180px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/50 bg-white/75 p-6 text-left shadow-sm backdrop-blur-md transition-all duration-300 select-none hover:-translate-y-1 hover:scale-[1.01] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.99] dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:border-blue-400/30 dark:hover:shadow-blue-400/5"
                                aria-label="Voice triage"
                            >
                                <div className="bg-radial-gradient absolute inset-0 -z-10 from-blue-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-blue-500/10"></div>
                                <div className="absolute right-6 bottom-6 flex h-8 items-end gap-1">
                                    <div className="h-3 w-1 animate-pulse rounded-full bg-slate-300/30 transition-all duration-300 group-hover:h-7 group-hover:bg-blue-400/30 dark:bg-slate-700/20 dark:group-hover:bg-blue-500/20"></div>
                                    <div className="h-4 w-1 animate-pulse rounded-full bg-slate-300/30 transition-all duration-300 [animation-delay:0.2s] group-hover:h-5 group-hover:bg-blue-400/30 dark:bg-slate-700/20 dark:group-hover:bg-blue-500/20"></div>
                                    <div className="h-2 w-1 animate-pulse rounded-full bg-slate-300/30 transition-all duration-300 [animation-delay:0.4s] group-hover:h-8 group-hover:bg-blue-400/30 dark:bg-slate-700/20 dark:group-hover:bg-blue-500/20"></div>
                                    <div className="h-5 w-1 animate-pulse rounded-full bg-slate-300/30 transition-all duration-300 [animation-delay:0.1s] group-hover:h-4 group-hover:bg-blue-400/30 dark:bg-slate-700/20 dark:group-hover:bg-blue-500/20"></div>
                                </div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all duration-300 group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-950/40 dark:text-blue-400">
                                        <Mic
                                            size={24}
                                            strokeWidth={2}
                                            className="transition-transform duration-300 group-hover:scale-115"
                                        />
                                    </div>
                                    <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                                </div>
                                <div className="relative z-10 pt-4">
                                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                                        {tHome("voice_triage")}
                                    </h3>
                                    <p className="mt-1 text-xs leading-snug font-semibold text-slate-500 dark:text-slate-400">
                                        {tHome("voice_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Pharmacy Map */}
                            <button
                                onClick={() => handleNavigation("map")}
                                className="group relative flex h-full min-h-[180px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/50 bg-white/75 p-6 text-left shadow-sm backdrop-blur-md transition-all duration-300 select-none hover:-translate-y-1 hover:scale-[1.01] hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 active:scale-[0.99] dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:border-amber-400/30 dark:hover:shadow-amber-400/5"
                                aria-label="Pharmacy map"
                            >
                                <div className="bg-radial-gradient absolute inset-0 -z-10 from-amber-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-amber-500/10"></div>
                                <svg
                                    className="absolute right-1 bottom-1 h-18 w-18 text-slate-300/20 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 group-hover:text-amber-400/20 dark:text-slate-700/10 dark:group-hover:text-amber-500/15"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1}
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="12" cy="12" r="6" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-all duration-300 group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-950/40 dark:text-amber-400">
                                        <MapPin
                                            size={24}
                                            strokeWidth={2}
                                            className="group-hover:translate-y--0.5 transition-transform duration-300"
                                        />
                                    </div>
                                    <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-500 dark:group-hover:text-amber-400" />
                                </div>
                                <div className="relative z-10 pt-4">
                                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                                        {tHome("pharmacy_map")}
                                    </h3>
                                    <p className="mt-1 text-xs leading-snug font-semibold text-slate-500 dark:text-slate-400">
                                        {tHome("pharmacy_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Report Fake Medicine */}
                            <button
                                onClick={() => handleNavigation("report")}
                                className="group relative flex h-full min-h-[180px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/50 bg-white/75 p-6 text-left shadow-sm backdrop-blur-md transition-all duration-300 select-none hover:-translate-y-1 hover:scale-[1.01] hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/5 active:scale-[0.99] dark:border-slate-800/50 dark:bg-slate-900/55 dark:hover:border-red-400/30 dark:hover:shadow-red-400/5"
                                aria-label="Report fake medicine"
                            >
                                <div className="bg-radial-gradient absolute inset-0 -z-10 from-red-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-red-500/10"></div>
                                <svg
                                    className="absolute right-3 bottom-3 h-16 w-16 text-slate-300/30 transition-all duration-500 group-hover:scale-105 group-hover:text-red-400/30 dark:text-slate-700/20 dark:group-hover:text-red-500/20"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                </svg>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-all duration-300 group-hover:bg-red-500 group-hover:text-white dark:bg-red-950/40 dark:text-red-400">
                                        <AlertTriangle
                                            size={24}
                                            strokeWidth={2}
                                            className="transition-transform duration-300 group-hover:rotate-6"
                                        />
                                    </div>
                                    <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-500 dark:group-hover:text-red-400" />
                                </div>
                                <div className="relative z-10 pt-4">
                                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                                        {tHome("report_fake")}
                                    </h3>
                                    <p className="mt-1 text-xs leading-snug font-semibold text-slate-500 dark:text-slate-400">
                                        {tHome("report_fake_subtitle")}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── Health Assistant CTA Banner ── */}
                    <div
                        className="group relative mt-4 transform-gpu overflow-hidden rounded-3xl transition-all duration-300 select-none hover:scale-[1.01] hover:shadow-xl hover:shadow-purple-500/10"
                        style={{
                            background:
                                "linear-gradient(135deg, #6d5ce7 0%, #7c3aed 50%, #5b21b6 100%)",
                        }}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 to-transparent" />

                        <div className="relative z-10 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:bg-white/25">
                                    <MessageCircle size={26} className="text-white" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                                            {tHome("ai_health_assistant")}
                                        </h3>
                                        <span className="inline-flex items-center rounded-md bg-white/20 px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-white uppercase">
                                            {tHome("ai_chat")}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed font-medium text-purple-100 sm:text-base">
                                        {tHome("ai_health_assistant_description")}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => handleNavigation("health")}
                                className="group/btn flex w-full shrink-0 items-center justify-center gap-2.5 rounded-xl border-2 border-white/80 bg-white/15 px-7 py-3 text-base font-bold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-purple-700 sm:w-auto"
                            >
                                <MessageCircle size={18} />
                                {tHome("chat_now")}
                                <ChevronRight
                                    size={18}
                                    className="transition-transform duration-200 group-hover/btn:translate-x-1"
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}