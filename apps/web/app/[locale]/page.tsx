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
    Search,
    MessageCircle,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-emerald-600 focus-visible:text-emerald-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

const mobileNavLabelClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out group-hover:after:scale-x-100 group-active:after:scale-x-100 group-focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

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
                const { data, error } = await supabase
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

    return (
        <div className="min-h-screen bg-(--color-surface-page) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-(--color-border-muted) bg-(--color-surface-page)/80 backdrop-blur-lg">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
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
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-(--color-text-secondary) lg:flex"
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
                                <History size={14} /> My Reports
                            </Link>
                        </nav>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 items-center justify-center gap-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:px-4 sm:py-2"
                            aria-label="Open AI Health Assistant"
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">AI Health Assistant</span>
                            <span className="whitespace-nowrap sm:hidden">AI Chat</span>
                        </button>

                        <LanguageSwitcher />
                    </div>
                </div>
            </header>
            {/* ── Main ── */}
            <main className="container mx-auto max-w-6xl px-4 pt-8 pb-24 md:pb-12">
                {/* Hero */}
                <div className="space-y-6 py-12 text-center md:py-20">
                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 duration-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    {/* UPDATED TITLE COLOR HERE */}
                    <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-(--color-text-primary) md:text-6xl">
                        {tHome("title")}
                    </h2>
                    {/* UPDATED SUBTITLE COLOR HERE */}
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-(--color-text-secondary) md:text-xl">
                        {tHome("subtitle")}
                    </p>
                </div>

                {/* ── Primary CTA — Full-width Scan Button ── */}
                <button
                    onClick={() => handleNavigation("scan")}
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-500 bg-emerald-600 p-7 text-left text-white shadow-xl shadow-emerald-600/20 transition-all hover:shadow-emerald-600/40 active:scale-[0.99] md:p-8"
                    aria-label="Scan medicine"
                >
                    <div className="absolute inset-0 z-0 bg-linear-to-tr from-emerald-700 to-emerald-500"></div>
                    <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 md:h-20 md:w-20">
                            <Camera
                                className="h-8 w-8 text-white drop-shadow-md md:h-10 md:w-10"
                                strokeWidth={2}
                            />
                        </div>
                        <div>
                            <span className="block text-2xl font-bold tracking-wide drop-shadow-sm md:text-3xl">
                                {tHome("scan_button")}
                            </span>
                            <span className="mt-1 block text-sm font-medium text-emerald-100 opacity-90 md:text-base">
                                {tHome("scan_subtitle")}
                            </span>
                        </div>
                    </div>
                    <ChevronRight
                        size={32}
                        className="relative z-10 hidden shrink-0 text-emerald-200 opacity-50 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:block"
                    />
                </button>

                {/* ── Secondary Action Cards ── */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page)/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-xl active:scale-[0.99]"
                        aria-label="Upload photo"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-white/10">
                                <Camera size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-(--color-text-primary)">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page)/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl active:scale-[0.99]"
                        aria-label="Voice triage"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-950/30 dark:text-blue-400 dark:ring-white/10">
                                <Mic size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-(--color-text-primary)">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page)/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-xl active:scale-[0.99]"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-950/30 dark:text-amber-400 dark:ring-white/10">
                                <MapPin size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-(--color-text-primary)">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page)/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-400/50 hover:shadow-xl active:scale-[0.99]"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-red-500 group-hover:text-white dark:bg-red-950/30 dark:text-red-400 dark:ring-white/10">
                                <AlertTriangle size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-(--color-text-primary)">
                                {tHome("report_fake")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                {tHome("report_fake_subtitle")}
                            </p>
                        </div>
                    </button>
                </div>

                {/* ── AI Health Assistant CTA Banner ── */}
                <div className="group relative mt-8 overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page)/95 p-6 shadow-md transition-all duration-300 hover:shadow-xl sm:p-8 md:p-10">
                    <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />

                    <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <div className="flex items-center gap-4 sm:gap-5">
                            {/* Icon container */}
                            <div className="flex h-14 w-14 shrink-0 -translate-y-9 items-center justify-center rounded-2xl bg-(--color-surface-page)/95 shadow-lg shadow-purple-500/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-purple-500/35 sm:h-16 sm:w-16 sm:translate-y-0">
                                <MessageCircle size={28} className="text-white drop-shadow-sm" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-extrabold tracking-tight text-(--color-text-primary) sm:text-2xl">
                                        AI Health Assistant
                                    </h3>
                                    {/* Animated AI badge */}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider whitespace-nowrap text-purple-500 uppercase ring-1 ring-purple-500/20">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
                                        </span>
                                        Live AI
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed font-medium text-(--color-text-secondary) sm:text-base">
                                    Get instant health advice, symptom checking &amp; prescription
                                    guidance
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-purple-500 to-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-md shadow-purple-500/25 transition-all duration-300 hover:scale-[1.04] sm:w-auto"
                        >
                            <MessageCircle size={18} />
                            Chat Now
                            <ChevronRight
                                size={18}
                                className="transition-transform duration-200 group-hover/btn:translate-x-1"
                            />
                        </button>
                    </div>
                </div>

                {/* ── Global Search ── */}
                <SearchBar />

                {/* ── Live Alerts Panel (full-width) ── */}
                <div className="mt-8 mb-20">
                    <div className="flex flex-col overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm">
                        <div className="flex items-center justify-between border-b border-(--color-border-muted) bg-(--color-surface-muted) px-6 py-5">
                            <div className="flex items-center gap-2">
                                <Activity size={20} className="text-red-500" />
                                <h3 className="text-lg font-bold text-(--color-text-primary)">
                                    Live CDSCO Alerts
                                </h3>
                            </div>
                            <span className="hidden rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold tracking-wider text-red-500 uppercase sm:block">
                                India Region
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-(--color-surface-muted)/30 p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {loading ? (
                                    <>
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-(--color-border-muted)" />
                                                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <Skeleton className="h-4 w-1/2" />
                                                        <Skeleton className="h-3 w-12" />
                                                    </div>
                                                    <Skeleton className="h-3 w-3/4" />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : homepageAlerts && homepageAlerts.length > 0 ? (
                                    homepageAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400/30 hover:shadow-md"
                                        >
                                            {/* Left edge colored strip */}
                                            <div
                                                className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-500"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-red-500"
                                                          : "bg-orange-500"
                                                }`}
                                            />

                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-red-500/10 text-red-500 group-hover:bg-red-500/20"
                                                          : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20"
                                                }`}
                                            >
                                                {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                    <Globe size={20} strokeWidth={2.5} />
                                                ) : (
                                                    <AlertTriangle size={20} strokeWidth={2.5} />
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <h4 className="leading-tight font-bold text-(--color-text-primary)">
                                                        {alert.brand_name}
                                                    </h4>
                                                    <span className="text-[11px] font-medium text-(--color-text-muted)">
                                                        {formatRelativeTime(alert.created_at)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                                    {alert.composition} Batch{" "}
                                                    <span className="font-bold text-(--color-text-primary)">
                                                        {alert.batch_number}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="sm:col-span-2">
                                        <EmptyState
                                            icon={
                                                <ShieldCheck
                                                    size={26}
                                                    strokeWidth={2}
                                                    className="text-emerald-500"
                                                />
                                            }
                                            title="All clear!"
                                            description="No active regulatory alerts right now. Stay safe and verify your medicines."
                                            className="border-none bg-transparent! p-6"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── View Full Alert Log CTA ── */}
                        <div className="border-t border-(--color-border-muted) bg-(--color-surface-page) p-4">
                            <Link href="/alerts" className="block w-full">
                                <button className="group/log flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3 font-bold text-(--color-text-primary) transition-all duration-200 hover:border-slate-500/30 hover:shadow-sm">
                                    <Activity
                                        size={15}
                                        className="text-(--color-text-muted) transition-colors duration-200 group-hover/log:text-red-500"
                                    />
                                    View Full Alert Log
                                    <ChevronRight
                                        size={16}
                                        className="text-(--color-text-muted) transition-transform duration-200 group-hover/log:translate-x-1"
                                    />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>

            {/* ── Mobile Bottom Navigation ── */}
            <nav
                className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-(--color-border-muted)/60 bg-(--color-surface-page)/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
                aria-label="Mobile navigation"
            >
                <Link
                    href="/"
                    className="group flex w-16 flex-col items-center gap-1.5"
                    aria-label="Home"
                >
                    <div className="text-emerald-500 transition-transform group-hover:-translate-y-1">
                        <Home size={24} strokeWidth={2.5} />
                    </div>
                    <span
                        className={`${mobileNavLabelClassName} text-[11px] font-bold text-emerald-500`}
                    >
                        Home
                    </span>
                </Link>

                <Link
                    href="/scan"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-(--color-text-primary)"
                    aria-label="Scans"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <History size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Scans
                    </span>
                </Link>

                <Link
                    href="/map"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-amber-500"
                    aria-label="Map"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <MapPin size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Map
                    </span>
                </Link>

                <Link
                    href="/alerts"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-red-500"
                    aria-label="Alerts"
                >
                    <div className="relative transition-transform group-hover:-translate-y-1">
                        <Bell size={24} strokeWidth={2} />
                        <span className="absolute top-0 right-0.5 h-2 w-2 animate-pulse rounded-full border border-(--color-surface-page) bg-red-500"></span>
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Alerts
                    </span>
                </Link>

                <Link
                    href="/profile"
                    className="group flex w-16 flex-col items-center gap-1.5 text-(--color-text-muted) transition-colors hover:text-emerald-500"
                    aria-label="Profile"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <User size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Profile
                    </span>
                </Link>
            </nav>
        </div>
    );
}
