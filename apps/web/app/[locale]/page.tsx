"use client";

import dynamic from "next/dynamic";
const MedicineSafetyPanel = dynamic(
    () =>
        import("@/components/medicine")
            .then((mod) => mod.MedicineSafetyPanel)
            .catch((err) => {
                console.error("[Home] MedicineSafetyPanel dynamic import failed:", err);
                throw err;
            }),
    { loading: () => null }
);
import React, { useCallback, useEffect, useState } from "react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { usePendingSearchQueue } from "@/hooks/usePendingSearchQueue";
import { addToSearchQueue } from "@/lib/db/searchQueue";
import {
    Camera,
    MapPin,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Activity,
    MessageCircle,
    ArrowRight,
    Lock,
    Eye,
    Shield,
    FileText,
    Syringe,
    BookOpen,
    HelpCircle,
    Mic
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
const SearchBar = dynamic(() => import("./components/SearchBar"));
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getVisibleAlertBatchNumber } from "@/lib/alertFormatting";
import SafetyStatsBanner from "@/components/SafetyStatsBanner";

function formatRelativeTime(dateString: string | null, locale: string): string {
    if (!dateString) return "—";

    const now = new Date();
    const past = new Date(dateString);
    const elapsed = now.getTime() - past.getTime();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (Math.abs(elapsed) < 60000) return rtf.format(0, "second");

    if (Math.abs(elapsed) < 3600000) return rtf.format(-Math.round(elapsed / 60000), "minute");

    if (Math.abs(elapsed) < 86400000) return rtf.format(-Math.round(elapsed / 3600000), "hour");

    return rtf.format(-Math.round(elapsed / 86400000), "day");
}

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : (params.locale ?? "en");
    const tHome = useTranslations("Home");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");

    const { isOffline } = useOfflineStatus();
    const {
        refresh: refreshSearchQueue,
    } = usePendingSearchQueue((query) => {
        setActiveSearchQuery(query);
    });

    const handleSearchSubmit = useCallback(async (query: string) => {
        if (!query) {
            setActiveSearchQuery("");
            return;
        }

        if (isOffline) {
            await addToSearchQueue(query);
            await refreshSearchQueue();
        } else {
            setActiveSearchQuery(query);
        }
    }, [isOffline, refreshSearchQueue]);

    const prefetchAlertsData = async () => {
        try {
            if (homepageAlerts.length > 0) return;

            const { data } = await supabase
                .from("drug_alerts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(4);

            if (data) {
                const mappedData = data.map((alert) => ({
                    ...alert,
                    brand_name: alert.reported_brand_name || "Unknown Brand",
                    composition: alert.manufacturer || "Unknown Manufacturer",
                    cdsco_approval_status: alert.alert_type === "banned" ? "banned" : "recalled",
                    is_counterfeit_alert:
                        alert.alert_type === "Spurious" || alert.alert_type === "counterfeit",
                }));
                setHomepageAlerts(mappedData);
            }
        } catch (error) {
            console.error("Prefetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        prefetchAlertsData();
    }, []);

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    return (
        <div className="relative min-h-screen bg-slate-50 font-sans text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
            {/* ── Background Mesh (Clean & Professional) ── */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
                <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px] dark:bg-emerald-900/5"></div>
                <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-teal-500/5 blur-[120px] dark:bg-teal-900/5"></div>
            </div>

            <main className="relative z-10 pb-20">
                {/* ── 1. HERO SECTION ── */}
                <section className="mx-auto max-w-4xl px-4 pt-8 md:pt-10 pb-12 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        FREE & OPEN SOURCE
                    </div>

                    {/* Headline */}
                    <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-[3.5rem] text-slate-900 dark:text-white leading-[1.15]">
                        Scan a medicine.<br className="hidden sm:block" />
                        Check its safety status. <span className="text-emerald-600 dark:text-emerald-400 inline-block">Stay ahead of recalls.</span>
                    </h1>

                    {/* Supporting Text */}
                    <p className="mx-auto mt-4 max-w-xl text-base md:text-lg leading-relaxed text-slate-500 dark:text-slate-400">
                        Check available medicine and regulatory information, see safety alerts, and find trusted pharmacies with SahiDawa.
                    </p>

                    {/* Compact CTAs */}
                    <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="w-full sm:w-auto flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm md:text-base font-bold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-emerald-700"
                        >
                            <Camera size={18} />
                            Scan Medicine
                        </button>
                        <button
                            onClick={() => handleNavigation("map")}
                            className="w-full sm:w-auto flex min-w-[160px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm md:text-base font-bold text-slate-700 transition-all active:scale-[0.98] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <MapPin size={18} />
                            Find a Pharmacy
                        </button>
                    </div>
                </section>

                <div className="mx-auto max-w-5xl px-4">
                    {/* ── 2. MEDICINE SEARCH SECTION ── */}
                    <section className="mb-16 md:mb-20 rounded-3xl border border-slate-200/60 bg-white/70 p-6 sm:p-8 shadow-xs backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/60">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Check a medicine
                            </h2>
                            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                                Search by medicine name, batch number, or scan the packaging.
                            </p>

                            <div className="mt-6">
                                <SearchBar onSearchChange={handleSearchSubmit} />
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => handleNavigation("scan")}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                    Or scan the packaging →
                                </button>
                            </div>
                        </div>

                        {/* Medicine Safety Panel — shown inline below search */}
                        {activeSearchQuery && (
                            <div className="animate-in fade-in slide-in-from-top-4 mx-auto mt-6 w-full max-w-2xl text-left duration-200">
                                <MedicineSafetyPanel
                                    searchQuery={activeSearchQuery}
                                    onClose={() => setActiveSearchQuery("")}
                                />
                            </div>
                        )}
                    </section>

                    {/* ── 3. CORE PRODUCT FLOWS ── */}
                    <section className="mb-16 md:mb-24">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                How SahiDawa helps
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-sm md:text-base text-slate-500 dark:text-slate-400">
                                Accessible tools designed to protect you and your family's health.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
                            {/* Scan & Verify */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:hover:border-emerald-500/40"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 mb-4 transition-transform group-hover:scale-105">
                                    <Camera size={24} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Scan & Verify
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
                                    Scan a barcode or medicine package and check available medicine information instantly.
                                </p>
                                <div className="mt-auto w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors group-hover:bg-emerald-700">
                                    Verify Medicine <ArrowRight size={16} />
                                </div>
                            </button>

                            {/* Find a Pharmacy */}
                            <button
                                onClick={() => handleNavigation("map")}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 mb-4 transition-transform group-hover:scale-105">
                                    <MapPin size={24} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Find a Pharmacy
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
                                    Locate trusted, verified pharmacies nearby. Find 24/7 stores and crucial healthcare resources in your area.
                                </p>
                                <div className="mt-auto w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors group-hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700">
                                    Locate Stores <ArrowRight size={16} />
                                </div>
                            </button>

                            {/* Ask SahiDawa */}
                            <button
                                onClick={() => handleNavigation("health")}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-500/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 mb-4 transition-transform group-hover:scale-105">
                                    <MessageCircle size={24} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Ask SahiDawa
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
                                    Get basic health information and triage guidance powered by AI, available in multiple regional languages.
                                </p>
                                <div className="mt-auto w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors group-hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700">
                                    Consult AI <ArrowRight size={16} />
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── 4. LIVE SAFETY STATS ── */}
                    <section className="mb-16 md:mb-20">
                        <SafetyStatsBanner />
                    </section>

                    {/* ── 5. SAFETY ALERTS ── */}
                    <section className="mb-16 md:mb-20">
                        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-xs dark:border-slate-800/60 dark:bg-slate-900">
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                                        <Activity size={18} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                            Live Safety & Recalls
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            Source: CDSCO
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-red-600 uppercase dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                    India Region
                                </span>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {loading ? (
                                        <>
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-950/50"
                                                >
                                                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-3.5 w-1/2" />
                                                        <Skeleton className="h-3 w-3/4" />
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : homepageAlerts && homepageAlerts.length > 0 ? (
                                        homepageAlerts.map((alert) => {
                                            const visibleBatchNumber = getVisibleAlertBatchNumber(
                                                alert.composition,
                                                alert.batch_number
                                            );
                                            const isOfficial = alert.brand_name === "SYSTEM_UPDATE" || alert.cdsco_approval_status === "banned" || alert.cdsco_approval_status === "recalled";

                                            return (
                                                <div
                                                    key={alert.id}
                                                    onClick={() => handleNavigation("alerts")}
                                                    className={`group relative flex cursor-pointer items-start gap-4 rounded-xl border border-l-4 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                                                        alert.brand_name === "SYSTEM_UPDATE"
                                                            ? "border-slate-200 border-l-blue-500 dark:border-slate-800"
                                                            : alert.cdsco_approval_status === "banned" || alert.is_counterfeit_alert
                                                              ? "border-slate-200 border-l-red-500 dark:border-slate-800"
                                                              : "border-slate-200 border-l-orange-500 dark:border-slate-800"
                                                    }`}
                                                >
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                                        {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                            <Globe size={16} />
                                                        ) : (
                                                            <AlertTriangle size={16} className="text-red-500" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                                                {alert.brand_name}
                                                            </h4>
                                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                                                {formatRelativeTime(alert.created_at, locale || "en")}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {alert.composition}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            {isOfficial ? (
                                                                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                                                    CDSCO Alert
                                                                </span>
                                                            ) : (
                                                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                                                    Community Report
                                                                </span>
                                                            )}
                                                            {visibleBatchNumber && (
                                                                <span className="text-[10px] text-slate-400">
                                                                    Batch: <span className="font-bold">{visibleBatchNumber}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="sm:col-span-2">
                                            <EmptyState
                                                icon={<ShieldCheck size={24} className="text-emerald-500" />}
                                                title="No safety alerts found"
                                                description="All clear! No safety warnings or active drug recalls have been reported today."
                                                className="border-none bg-transparent p-6"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                <Link
                                    href="/alerts"
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                >
                                    View Full Alert Log →
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* ── 6. QUICK ACTIONS / SECONDARY FEATURES ── */}
                    <section className="mb-16 md:mb-20">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Quick Actions
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Fast access to essential tools and resources.
                            </p>
                        </div>

                        {/* Horizontal scroll on mobile, 5-column grid on large screens */}
                        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {/* Upload Photo */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex h-40 w-40 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 dark:border-slate-800 dark:bg-slate-900 sm:h-44 sm:w-auto"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 transition-transform group-hover:scale-110">
                                    <Camera size={20} strokeWidth={2.5} />
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <h4 className="font-bold text-slate-900 dark:text-white">Upload Photo</h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Select from gallery</p>
                                </div>
                            </button>

                            {/* Voice Triage */}
                            <button
                                onClick={() => handleNavigation("health")}
                                className="group relative flex h-40 w-40 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 sm:h-44 sm:w-auto"
                            >
                                {/* Decorative sound bars */}
                                <div className="absolute right-4 bottom-5 flex items-end gap-1.5 opacity-10 transition-opacity group-hover:opacity-20 dark:opacity-5">
                                    <div className="h-4 w-1.5 rounded-full bg-indigo-500"></div>
                                    <div className="h-8 w-1.5 rounded-full bg-indigo-500"></div>
                                    <div className="h-5 w-1.5 rounded-full bg-indigo-500"></div>
                                    <div className="h-9 w-1.5 rounded-full bg-indigo-500"></div>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 transition-transform group-hover:scale-110">
                                    <Mic size={20} strokeWidth={2.5} />
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <h4 className="font-bold text-slate-900 dark:text-white">Voice Triage</h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Speak symptoms</p>
                                </div>
                            </button>

                            {/* Pharmacy Map */}
                            <button
                                onClick={() => handleNavigation("map")}
                                className="group relative flex h-40 w-40 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 dark:border-slate-800 dark:bg-slate-900 sm:h-44 sm:w-auto"
                            >
                                {/* Decorative radar rings */}
                                <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full border border-amber-500/20 opacity-50 transition-transform duration-500 group-hover:scale-[1.2] dark:border-amber-500/10"></div>
                                <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full border border-amber-500/20 opacity-50 transition-transform duration-500 group-hover:scale-[1.2] dark:border-amber-500/10"></div>
                                
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 transition-transform group-hover:scale-110">
                                    <MapPin size={20} strokeWidth={2.5} />
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <h4 className="font-bold text-slate-900 dark:text-white">Pharmacy Map</h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Find verified stores</p>
                                </div>
                            </button>

                            {/* Scheme Eligibility */}
                            <button
                                onClick={() => handleNavigation("scheme-eligibility")}
                                className="group relative flex h-40 w-40 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-500/10 dark:border-slate-800 dark:bg-slate-900 sm:h-44 sm:w-auto"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 transition-transform group-hover:scale-110">
                                    <ShieldCheck size={20} strokeWidth={2.5} />
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <h4 className="font-bold text-slate-900 dark:text-white leading-tight">Scheme<br/>Eligibility</h4>
                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Check public health insurance</p>
                                </div>
                            </button>

                            {/* Report Fake (Distinct Red Card) */}
                            <button
                                onClick={() => handleNavigation("report")}
                                className="group relative flex h-40 w-40 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl border border-rose-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/20 dark:border-rose-900/50 dark:bg-slate-900 sm:h-44 sm:w-auto"
                            >
                                {/* Decorative red gradient blob */}
                                <div className="absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-rose-500/10 blur-xl transition-transform duration-500 group-hover:scale-125 dark:bg-rose-500/10"></div>
                                
                                <div className="flex items-start justify-between relative z-10">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-500/30 transition-transform group-hover:-rotate-6 group-hover:scale-110">
                                        <AlertTriangle size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400">
                                        <ChevronRight size={14} strokeWidth={3} />
                                    </div>
                                </div>
                                
                                <div className="relative z-10 mt-auto">
                                    <h4 className="font-bold text-rose-700 dark:text-rose-400">Report Fake</h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Report suspicious medicine</p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── 7. VACCINE HUB BANNER ── */}
                    <section className="mb-16 md:mb-20">
                        <button
                            onClick={() => handleNavigation("vaccine-hub")}
                            className="group relative flex w-full flex-col items-start gap-4 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white p-6 text-left transition-all hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-900 sm:flex-row sm:items-center"
                        >
                            <div className="absolute top-0 right-0 h-full w-1/2 bg-linear-to-l from-emerald-50/50 to-transparent dark:from-emerald-900/10 pointer-events-none"></div>
                            
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-110 group-hover:rotate-3">
                                <Syringe size={24} strokeWidth={2.5} />
                            </div>
                            
                            <div className="relative z-10 flex-1">
                                <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                                    Vaccine Hub & Immunization Tracker
                                </h3>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    Explore vaccine schedules, safety info, and aftercare guidance for better public health awareness.
                                </p>
                            </div>
                            
                            <div className="relative z-10 mt-4 flex items-center justify-between w-full sm:mt-0 sm:w-auto gap-4">
                                <div className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition-colors group-hover:bg-emerald-700">
                                    Open Vaccine Hub <ArrowRight size={16} className="ml-1.5" />
                                </div>
                            </div>
                            <div className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400 sm:static sm:h-10 sm:w-10 sm:shrink-0 transition-transform group-hover:translate-x-1 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
                                <ChevronRight size={18} strokeWidth={3} />
                            </div>
                        </button>
                    </section>

                    {/* ── 8. AI HEALTH ASSISTANT ── */}
                    <section className="mb-16 md:mb-20 rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8 dark:border-slate-800/60 dark:bg-slate-900">
                        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Need help understanding your symptoms?
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                                    Ask SahiDawa for basic health information and guidance.
                                </p>
                            </div>
                            <button
                                onClick={() => handleNavigation("health")}
                                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 transition-all active:scale-[0.98]"
                            >
                                <MessageCircle size={16} />
                                Chat with SahiDawa
                            </button>
                        </div>
                        <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500">
                            * For informational purposes only. Not a replacement for professional medical care.
                        </p>
                    </section>



                    {/* ── 10. TRUST & COMMUNITY SECTION ── */}
                    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-16 md:mb-20">
                        {/* Built with the community */}
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-slate-800/60 dark:bg-slate-900 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Built with the community
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                    SahiDawa is open source. Developers, healthcare workers, researchers, and citizens can contribute to making medicine information more accessible.
                                </p>
                            </div>
                            <div className="mt-6 flex items-center gap-4">
                                <a
                                    href="https://github.com/RatLoopz/sahidawa-india"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                                >
                                    <FaGithub size={14} />
                                    GitHub Project
                                </a>
                                <Link
                                    href="/how-it-works"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                    How SahiDawa Works →
                                </Link>
                            </div>
                        </div>

                        {/* Built for safer healthcare decisions */}
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-slate-800/60 dark:bg-slate-900">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                                Built for safer healthcare decisions
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <FaGithub size={12} className="text-emerald-500" />
                                        Open Source
                                    </h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        Transparent and community-driven.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Lock size={12} className="text-emerald-500" />
                                        Privacy First
                                    </h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        No tracking or selling data.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Shield size={12} className="text-emerald-500" />
                                        Official Awareness
                                    </h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        Surfaces regulatory warnings.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Globe size={12} className="text-emerald-500" />
                                        Built for India
                                    </h4>
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        Multilingual & low-bandwidth.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>
        </div>
    );
}
