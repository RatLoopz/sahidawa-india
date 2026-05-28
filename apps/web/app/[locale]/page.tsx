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
import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const desktopNavLinkClassName =
    "relative inline-flex items-center pb-1 transition-colors duration-200 ease-out hover:text-blue-600 focus-visible:text-blue-600 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-current after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-safe:after:will-change-transform";

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

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans text-gray-800 transition-colors duration-300 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100">
            {/* a??a?? Top Navigation a??a?? */}
            <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-700 dark:bg-gray-900/80">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm sm:h-10 sm:w-10 dark:bg-blue-900/30 dark:text-blue-400"
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
                        <h1 className="text-xl font-extrabold tracking-tight text-gray-800 md:text-2xl dark:text-gray-100">
                            SahiDawa
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 md:gap-4">
                        <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-gray-600 lg:flex dark:text-gray-300"
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

                        <button
                            onClick={() => handleNavigation("login")}
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-700 transition-all duration-200 hover:scale-105 hover:border-blue-400 hover:bg-blue-100 sm:h-10 sm:px-5 sm:py-2 md:flex dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                            aria-label={tHome("sign_in")}
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </button>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 w-9 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 sm:h-10 sm:w-auto sm:px-4 sm:py-2"
                            aria-label={tHome("open_ai_health_assistant")}
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">{tHome("ai_health_assistant")}</span>
                        </button>

                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            </header>
            {/* a??a?? Main a??a?? */}
            <main className="container mx-auto max-w-6xl px-4 pt-8 pb-24 md:pb-12">
                {/* Hero */}
                <div className="space-y-6 py-12 text-center md:py-20">
                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 duration-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-gray-800 md:text-6xl dark:text-gray-100">
                        {tHome("title")}
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-gray-600 md:text-xl dark:text-gray-300">
                        {tHome("subtitle")}
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
                        <button
                            onClick={() => handleNavigation("login")}
                            className="group flex w-[220px] items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95"
                        >
                            <User size={20} />
                            {tHome("get_started")}
                        </button>
                    </div>
                </div>

                {/* a??a?? Primary CTA a?? Full-width Scan Button a??a?? */}
                <button
                    onClick={() => handleNavigation("scan")}
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-blue-500 bg-blue-600 p-7 text-left text-white shadow-xl shadow-blue-600/20 transition-all hover:shadow-blue-600/40 active:scale-[0.99] md:p-8"
                    aria-label="Scan medicine"
                >
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-blue-700 to-blue-500"></div>
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
                            <span className="mt-1 block text-sm font-medium text-blue-100 opacity-90 md:text-base">
                                {tHome("scan_subtitle")}
                            </span>
                        </div>
                    </div>
                    <ChevronRight
                        size={32}
                        className="relative z-10 hidden shrink-0 text-blue-200 opacity-50 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:block"
                    />
                </button>

                {/* a??a?? Secondary Action Cards a??a?? */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800/95"
                        aria-label="Upload photo"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-blue-500 group-hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:ring-white/10">
                                <Camera size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-400 dark:text-gray-500" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-gray-500 dark:text-gray-400">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-xl active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800/95"
                        aria-label="Voice triage"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-cyan-500 group-hover:text-white dark:bg-cyan-900/30 dark:text-cyan-400 dark:ring-white/10">
                                <Mic size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-cyan-400 dark:text-gray-500" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-gray-500 dark:text-gray-400">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-400/50 hover:shadow-xl active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800/95"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-teal-500 group-hover:text-white dark:bg-teal-900/30 dark:text-teal-400 dark:ring-white/10">
                                <MapPin size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-teal-400 dark:text-gray-500" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-gray-500 dark:text-gray-400">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-400/50 hover:shadow-xl active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800/95"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-red-500 group-hover:text-white dark:bg-red-900/30 dark:text-red-400 dark:ring-white/10">
                                <AlertTriangle size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-gray-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-400 dark:text-gray-500" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                                {tHome("report_fake")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-gray-500 dark:text-gray-400">
                                {tHome("report_fake_subtitle")}
                            </p>
                        </div>
                    </button>
                </div>

                {/* a??a?? Health Assistant CTA Banner a??a?? */}
                <div className="group relative mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-md transition-all duration-300 hover:shadow-xl sm:p-8 md:p-10 dark:border-gray-700 dark:bg-gray-800/95">
                    <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />

                    <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg">
                                <MessageCircle size={28} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                    {tHome("ai_health_assistant")}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {tHome("ai_health_subtitle")}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
                        >
                            {tHome("try_now")}
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {/* a??a?? Alerts Section a??a?? */}
                <section className="mt-12" aria-labelledby="alerts-heading">
                    <div className="mb-6 flex items-center justify-between">
                        <h2
                            id="alerts-heading"
                            className="text-2xl font-bold text-gray-800 dark:text-gray-100"
                        >
                            {tHome("recent_alerts")}
                        </h2>
                        <Link
                            href="/alerts"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            {tHome("view_all")}
                            <ChevronRight size={16} />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-32 rounded-2xl" />
                            ))}
                        </div>
                    ) : homepageAlerts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {homepageAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                        <Bell size={24} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-800 truncate dark:text-gray-100">
                                            {alert.brand_name || alert.generic_name || "Alert"}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {alert.cdsco_approval_status === "recalled"
                                                ? tHome("recalled")
                                                : alert.cdsco_approval_status === "banned"
                                                ? tHome("banned")
                                                : tHome("counterfeit_alert")}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                            {formatRelativeTime(alert.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ShieldCheck}
                            title={tHome("no_alerts")}
                            description={tHome("no_alerts_description")}
                        />
                    )}
                </section>

                {/* a??a?? Trust & Safety Section a??a?? */}
                <section className="mt-16 text-center" aria-labelledby="trust-heading">
                    <h2
                        id="trust-heading"
                        className="text-2xl font-bold text-gray-800 dark:text-gray-100"
                    >
                        {tHome("trust_title")}
                    </h2>
                    <p className="mx-auto mt-2 max-w-xl text-gray-500 dark:text-gray-400">
                        {tHome("trust_subtitle")}
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="mt-4 font-semibold text-gray-800 dark:text-gray-100">
                                {tHome("verified_info")}
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                {tHome("verified_info_desc")}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                                <Globe size={24} />
                            </div>
                            <h3 className="mt-4 font-semibold text-gray-800 dark:text-gray-100">
                                {tHome("wide_coverage")}
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                {tHome("wide_coverage_desc")}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                                <Activity size={24} />
                            </div>
                            <h3 className="mt-4 font-semibold text-gray-800 dark:text-gray-100">
                                {tHome("real_time_updates")}
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                {tHome("real_time_updates_desc")}
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            {/* a??a?? Footer a??a?? */}
            <footer className="border-t border-gray-200 bg-white py-8 dark:border-gray-700 dark:bg-gray-900">
                <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    <p>&copy; {new Date().getFullYear()} SahiDawa. {tHome("footer_rights")}</p>
                    <div className="mt-2 flex justify-center gap-4">
                        <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400">
                            {tHome("privacy")}
                        </Link>
                        <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400">
                            {tHome("terms")}
                        </Link>
                        <Link href="/contact" className="hover:text-blue-600 dark:hover:text-blue-400">
                            {tHome("contact")}
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}