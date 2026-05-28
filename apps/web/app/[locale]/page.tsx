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
    CheckCircle2,
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
        <div className="min-h-screen bg-(--color-surface-page) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-(--color-border-muted) bg-(--color-surface-page)/90 backdrop-blur-md">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm sm:h-10 sm:w-10 dark:bg-blue-900/30 dark:text-blue-400"
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
                        <h1 className="text-xl font-bold tracking-tight text-(--color-text-primary) md:text-2xl">
                            SahiDawa
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 md:gap-4">
                        <nav
                            className="hidden items-center gap-6 text-sm font-medium text-(--color-text-secondary) lg:flex"
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
                            className="hidden h-9 items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50/50 px-4 py-1.5 text-sm font-semibold text-blue-700 transition-all duration-200 hover:bg-blue-100 sm:h-10 sm:px-5 sm:py-2 md:flex dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
                            aria-label={tHome("sign_in")}
                        >
                            <User size={16} />
                            <span>{tHome("sign_in")}</span>
                        </button>

                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="container mx-auto max-w-5xl px-4 pt-8 pb-24 md:pb-16">
                {/* Hero Section */}
                <div className="space-y-6 py-12 text-center md:py-16">
                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <CheckCircle2 size={14} className="text-blue-500" />
                        Trusted Medical Verification
                    </div>

                    <h2 className="text-4xl leading-tight font-extrabold tracking-tight text-slate-900 md:text-5xl lg:text-6xl dark:text-slate-50">
                        {tHome("title")}
                    </h2>

                    <p className="mx-auto max-w-2xl text-lg font-normal text-slate-600 md:text-xl dark:text-slate-400">
                        {tHome("subtitle")}
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 pt-6 sm:flex-row">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 sm:w-auto"
                        >
                            <Camera size={20} />
                            {tHome("scan_button")}
                        </button>
                        <button
                            onClick={() => handleNavigation("how-it-works")}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            Learn More
                        </button>
                    </div>
                </div>

                {/* ── Services Section ── */}
                <div className="mt-8 space-y-6">
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                            Our Services
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Comprehensive tools for your health and safety
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Verify Medicine (Scan) */}
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
                            aria-label="Upload photo"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                    <Camera size={24} />
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500" />
                            </div>
                            <div className="pt-5">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                    {tHome("upload_photo")}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {tHome("upload_subtitle")}
                                </p>
                            </div>
                        </button>

                        {/* Voice Triage */}
                        <button
                            onClick={() => handleNavigation("voice")}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
                            aria-label="Voice triage"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                                    <Mic size={24} />
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500" />
                            </div>
                            <div className="pt-5">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                    {tHome("voice_triage")}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {tHome("voice_subtitle")}
                                </p>
                            </div>
                        </button>

                        {/* Pharmacy Map */}
                        <button
                            onClick={() => handleNavigation("map")}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
                            aria-label="Pharmacy map"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400">
                                    <MapPin size={24} />
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-teal-500" />
                            </div>
                            <div className="pt-5">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                    {tHome("pharmacy_map")}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {tHome("pharmacy_subtitle")}
                                </p>
                            </div>
                        </button>

                        {/* Report Fake Medicine */}
                        <button
                            onClick={() => handleNavigation("report")}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-rose-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-700"
                            aria-label="Report fake medicine"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                                    <AlertTriangle size={24} />
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-rose-500" />
                            </div>
                            <div className="pt-5">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                    {tHome("report_fake")}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {tHome("report_fake_subtitle")}
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* ── Health Assistant CTA Banner ── */}
                <div className="mt-12 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8 dark:border-blue-900/50 dark:bg-blue-900/10">
                    <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-5">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-800">
                                <MessageCircle
                                    size={28}
                                    className="text-blue-600 dark:text-blue-400"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                                        {tHome("ai_health_assistant")}
                                    </h3>
                                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                        Beta
                                    </span>
                                </div>
                                <p className="max-w-lg text-sm text-slate-600 dark:text-slate-400">
                                    {tHome("ai_health_assistant_description")}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 md:w-auto"
                        >
                            <MessageCircle size={18} />
                            {tHome("chat_now")}
                        </button>
                    </div>
                </div>

                {/* ── Global Search ── */}
                <div className="mt-12">
                    <SearchBar />
                </div>

                {/* ── Live Alerts Panel ── */}
                <div className="mt-12 mb-12">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-rose-500" />
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                                    {tHome("live_cdsco_alerts")}
                                </h3>
                            </div>
                            <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                                {tHome("india_region")}
                            </span>
                        </div>

                        <div className="p-4 sm:p-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {loading ? (
                                    <>
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-4 rounded-xl border border-slate-100 p-4 dark:border-slate-800"
                                            >
                                                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between">
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
                                            className="group flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
                                        >
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                                                          : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                                                }`}
                                            >
                                                {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                    <Globe size={20} />
                                                ) : (
                                                    <AlertTriangle size={20} />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="truncate font-semibold text-slate-900 dark:text-slate-50">
                                                        {alert.brand_name}
                                                    </h4>
                                                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                                        {formatRelativeTime(alert.created_at)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 line-clamp-1 text-sm text-slate-600 dark:text-slate-400">
                                                    {alert.composition}
                                                    {alert.batch_number && (
                                                        <>
                                                            <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-slate-300 align-middle dark:bg-slate-600"></span>
                                                            Batch{" "}
                                                            <span className="font-medium text-slate-900 dark:text-slate-200">
                                                                {alert.batch_number}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-1 lg:col-span-2">
                                        <EmptyState
                                            icon={
                                                <ShieldCheck size={26} className="text-blue-500" />
                                            }
                                            title={tHome("alerts_empty_title")}
                                            description={tHome("alerts_empty_description")}
                                            className="border-none bg-transparent p-6 shadow-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
                            <Link
                                href="/alerts"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                {tHome("view_full_alert_log")}
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>

            {/* ── Mobile Bottom Navigation ── */}
            <nav
                className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/90"
                aria-label="Mobile navigation"
            >
                <Link href="/" className="group flex flex-col items-center gap-1">
                    <Home size={22} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        {tNav("home")}
                    </span>
                </Link>

                <Link
                    href="/scan"
                    className="group flex flex-col items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                >
                    <History size={22} />
                    <span className="text-[10px] font-medium">{tNav("scans")}</span>
                </Link>

                <Link
                    href="/map"
                    className="group flex flex-col items-center gap-1 text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
                >
                    <MapPin size={22} />
                    <span className="text-[10px] font-medium">{tNav("map")}</span>
                </Link>

                <Link
                    href="/alerts"
                    className="group flex flex-col items-center gap-1 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                    <div className="relative">
                        <Bell size={22} />
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"></span>
                    </div>
                    <span className="text-[10px] font-medium">{tNav("alerts")}</span>
                </Link>

                <Link
                    href="/profile"
                    className="group flex flex-col items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
                >
                    <User size={22} />
                    <span className="text-[10px] font-medium">{tNav("profile")}</span>
                </Link>
            </nav>
        </div>
    );
}
