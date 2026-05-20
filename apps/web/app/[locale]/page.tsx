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
import Footer from "./components/Footer";
import SearchBar from "./components/SearchBar";

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
    // const locale = params.locale;
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
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200">
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm"
                            aria-label="SahiDawa Logo"
                        >
                            <ShieldCheck size={24} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-800 md:text-2xl">
                            SahiDawa
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex"
                            aria-label="Main navigation"
                        >
                            <Link
                                href="/how-it-works"
                                className="transition-colors hover:text-emerald-600"
                            >
                                {tNav("how_it_works")}
                            </Link> */}

                        <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex"
                            aria-label="Main navigation"
                        >
                            <Link
                                href="/how-it-works"
                                className="transition-colors hover:text-emerald-600"
                            >
                                {tNav("how_it_works")}
                            </Link>
                            <Link
                                href="/alerts"
                                className="transition-colors hover:text-emerald-600"
                            >
                                {tNav("alerts")}
                            </Link>
                            <Link href="/map" className="transition-colors hover:text-emerald-600">
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/reports/me"
                                className="flex items-center gap-1 transition-colors hover:text-emerald-600"
                            >
                                <History size={14} /> My Reports
                            </Link>
                        </nav>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                            aria-label="Open AI Health Assistant"
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">AI Health Assistant</span>
                            <span className="sm:hidden">AI Chat</span>
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
                    <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-slate-900 md:text-6xl">
                        {tHome("title")}
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
                        {tHome("subtitle")}
                    </p>
                </div>

                {/* ── Primary CTA — Full-width Scan Button ── */}
                <button
                    onClick={() => handleNavigation("scan")}
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-500 bg-emerald-600 p-7 text-left text-white shadow-xl shadow-emerald-600/20 transition-all hover:shadow-emerald-600/40 active:scale-[0.99] md:p-8"
                    aria-label="Scan medicine"
                >
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-700 to-emerald-500"></div>
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
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/60 active:translate-y-0 active:scale-[0.97]"
                        aria-label="Upload photo"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-400/30">
                            <Globe size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/60 active:translate-y-0 active:scale-[0.97]"
                        aria-label="Voice triage"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all duration-300 group-hover:bg-blue-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-400/30">
                            <Mic size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-100/60 active:translate-y-0 active:scale-[0.97]"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-all duration-300 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-amber-400/30">
                            <MapPin size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex w-full items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-red-200 hover:shadow-xl hover:shadow-red-100/60 active:translate-y-0 active:scale-[0.97]"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-all duration-300 group-hover:bg-red-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-red-400/30">
                            <AlertTriangle size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Report Fake</h3>
                            <p className="mt-0.5 text-sm leading-snug font-medium text-slate-500">
                                Report suspicious medicine
                            </p>
                        </div>
                    </button>
                </div>

                {/* ── AI Health Assistant CTA Banner ── */}
                <div className="group relative mt-8 overflow-hidden rounded-3xl border border-purple-200/60 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100/80 p-6 shadow-md shadow-purple-100/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-200/40 sm:p-8 md:p-10">
                    {/* Decorative background orbs */}
                    <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    {/* Center glow */}
                    <div className="pointer-events-none absolute top-1/2 left-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/30 blur-3xl" />

                    <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <div className="flex items-center gap-4 sm:gap-5">
                            {/* Icon container */}
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-purple-500/35 sm:h-16 sm:w-16">
                                <MessageCircle size={28} className="text-white drop-shadow-sm" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl">
                                        AI Health Assistant
                                    </h3>
                                    {/* Animated AI badge */}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-purple-700 uppercase ring-1 ring-purple-200/60">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-60" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-600" />
                                        </span>
                                        Live AI
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed font-medium text-slate-500 sm:text-base">
                                    Get instant health advice, symptom checking &amp; prescription
                                    guidance
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-md shadow-purple-500/25 transition-all duration-300 hover:scale-[1.04] hover:shadow-xl hover:shadow-purple-500/30 active:scale-[0.98] sm:w-auto"
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
                    <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5">
                            <div className="flex items-center gap-2">
                                <Activity size={20} className="text-red-500" />
                                <h3 className="text-lg font-bold text-slate-800">
                                    Live CDSCO Alerts
                                </h3>
                            </div>
                            <span className="hidden rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold tracking-wider text-red-600 uppercase sm:block">
                                India Region
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {homepageAlerts && homepageAlerts.length > 0 ? (
                                    homepageAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
                                                          : "bg-orange-400"
                                                }`}
                                            />

                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-50 text-blue-500 group-hover:bg-blue-100"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-red-50 text-red-500 group-hover:bg-red-100"
                                                          : "bg-orange-50 text-orange-500 group-hover:bg-orange-100"
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
                                                    <h4 className="leading-tight font-bold text-slate-800">
                                                        {alert.brand_name}
                                                    </h4>
                                                    <span className="text-[11px] font-medium text-slate-400">
                                                        {formatRelativeTime(alert.created_at)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                                    {alert.composition} Batch{" "}
                                                    <span className="font-bold text-slate-700">
                                                        {alert.batch_number}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    /* ── Improved Empty State ── */
                                    <div className="flex flex-col items-center justify-center py-8 sm:col-span-2">
                                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 shadow-sm ring-1 ring-emerald-100">
                                            <ShieldCheck size={26} strokeWidth={2} />
                                        </div>
                                        <p className="text-base font-bold text-slate-700">
                                            All clear!
                                        </p>
                                        <p className="mt-1 max-w-xs text-center text-sm text-slate-400">
                                            No active regulatory alerts right now. Stay safe and
                                            verify your medicines.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── View Full Alert Log CTA ── */}
                        <div className="border-t border-slate-100 bg-white p-4">
                            <Link href="/alerts" className="block w-full">
                                <button className="group/log flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 font-bold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm">
                                    <Activity
                                        size={15}
                                        className="text-slate-400 transition-colors duration-200 group-hover/log:text-red-500"
                                    />
                                    View Full Alert Log
                                    <ChevronRight
                                        size={16}
                                        className="text-slate-400 transition-transform duration-200 group-hover/log:translate-x-1"
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
                className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-slate-200/60 bg-white/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
                aria-label="Mobile navigation"
            >
                <Link
                    href="/"
                    className="group flex w-16 flex-col items-center gap-1.5"
                    aria-label="Home"
                >
                    <div className="text-emerald-600 transition-transform group-hover:-translate-y-1">
                        <Home size={24} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">Home</span>
                </Link>

                <Link
                    href="/scan"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label="Scans"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <History size={24} strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-semibold">Scans</span>
                </Link>

                <Link
                    href="/map"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-amber-600"
                    aria-label="Map"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <MapPin size={24} strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-semibold">Map</span>
                </Link>

                <Link
                    href="/alerts"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-red-500"
                    aria-label="Alerts"
                >
                    <div className="relative transition-transform group-hover:-translate-y-1">
                        <Bell size={24} strokeWidth={2} />
                        <span className="absolute top-0 right-0.5 h-2 w-2 animate-pulse rounded-full border border-white bg-red-500"></span>
                    </div>
                    <span className="text-[11px] font-semibold">Alerts</span>
                </Link>

                <Link
                    href="/profile"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-emerald-600"
                    aria-label="Profile"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <User size={24} strokeWidth={2} />
                    </div>
                    <span className="text-[11px] font-semibold">Profile</span>
                </Link>
            </nav>
            <Footer />
        </div>
    );
}
