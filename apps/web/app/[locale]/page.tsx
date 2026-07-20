"use client";

import { MedicineSafetyPanel } from "@/components/medicine";
import React, { useEffect, useState } from "react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { usePendingSearchQueue } from "@/hooks/usePendingSearchQueue";
import { addToSearchQueue } from "@/lib/db/searchQueue";
import { PendingSearchQueue } from "@/components/SearchBar/PendingSearchQueue";
import {
    Camera,
    Mic,
    MapPin,
    ShieldCheck,
    AlertTriangle,
    Globe,
    ChevronRight,
    Activity,
    MessageCircle,
    Syringe,
    ArrowRight,
    Quote,
    Star,
} from "lucide-react";

import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import SearchBar from "./components/SearchBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import SafetyStatsBanner from "@/components/SafetyStatsBanner";
import { getVisibleAlertBatchNumber } from "@/lib/alertFormatting";
import { usePredictivePrefetch } from "@/src/hooks/usePredictivePrefetch";

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

const testimonials = [
    {
        quote: "SahiDawa helped our family verify a batch number before buying medicine for my father. The result was quick and gave us real confidence.",
        name: "Priya Sharma",
        role: "Caregiver, Jaipur",
    },
    {
        quote: "The scanner makes medicine checks simple enough for first-time smartphone users. It fits naturally into our community health camps.",
        name: "Amit Verma",
        role: "Health Volunteer, Lucknow",
    },
    {
        quote: "I use the pharmacy finder when travelling for field work. It cuts down the guesswork and points me toward safer options nearby.",
        name: "Nandini Rao",
        role: "NGO Coordinator, Bengaluru",
    },
    {
        quote: "The alert log is clear and timely. It has become a useful reference when customers ask about recalls or counterfeit warnings.",
        name: "Rahul Mehta",
        role: "Pharmacist, Pune",
    },
    {
        quote: "Voice triage makes the platform approachable for patients who are not comfortable typing symptoms or medicine names.",
        name: "Dr. Sana Khan",
        role: "Primary Care Doctor, Bhopal",
    },
    {
        quote: "The open-source approach matters. It gives contributors and citizens a shared way to improve medicine safety across India.",
        name: "Arjun Patel",
        role: "Open Source Contributor, Ahmedabad",
    },
];

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : (params.locale ?? "en");
    const tHome = useTranslations("Home");
    const tContact = useTranslations("contact");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");

    const { isOffline } = useOfflineStatus();
    const {
        pendingSearches,
        isSyncing,
        isLoading: isSearchQueueLoading,
        executingId,
        execute: executeQueuedSearch,
        refresh: refreshSearchQueue,
    } = usePendingSearchQueue((query) => {
        setActiveSearchQuery(query);
    });

    const handleSearchSubmit = async (query: string) => {
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
    };

    // 1. Define the predictive query layer
    const prefetchAlertsData = async () => {
        try {
            if (homepageAlerts.length > 0) return; // Prevent double fetching

            const { data } = await supabase
                .from("drug_alerts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(4);

            if (data) {
                // Map drug_alerts format to match expected properties
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

    // 2. Instantiate the hook observer
    const alertsPrefetchRef = usePredictivePrefetch<HTMLElement>({
        preloadQuery: prefetchAlertsData,
        threshold: 0.1,
    });

    // 3. Run on mount only if the user didn't trigger the prefetch hook first
    useEffect(() => {
        prefetchAlertsData();
    }, []);

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
    };

    return (
        <div className="relative min-h-screen bg-(--color-surface-page) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* ── Background Mesh (Static & High Performance) ── */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
                <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[130px] transition-colors duration-300 dark:bg-purple-900/10"></div>
                <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[130px] transition-colors duration-300 dark:bg-emerald-900/10"></div>
                <div className="absolute bottom-10 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[130px] transition-colors duration-300 dark:bg-blue-900/10"></div>
            </div>

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
                        {tContact("badge")}
                    </div>

                    {/* Split-color title */}
                    <h1 className="text-4xl leading-tight font-black tracking-tight text-slate-900 transition-colors duration-300 sm:text-5xl md:text-6xl dark:text-white">
                        {tHome("heroTitle.prefix")}
                        <span className="ml-1 block bg-linear-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent sm:inline dark:from-emerald-400 dark:to-teal-400">
                            {tHome("heroTitle.highlight")}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed font-semibold text-slate-500 transition-colors duration-300 md:text-base dark:text-slate-400">
                        {tHome("subtitle")}
                    </p>
                    {/*Safety Stats Banner*/}
                    <SafetyStatsBanner />

                    {/* Search Bar */}
                    <div className="mx-auto w-full max-w-2xl pt-2">
                        <PendingSearchQueue
                            pending={pendingSearches}
                            isSyncing={isSyncing}
                            isLoading={isSearchQueueLoading}
                            executingId={executingId}
                            onExecute={executeQueuedSearch}
                        />
                        <SearchBar onSearchChange={handleSearchSubmit} />
                    </div>

                    {/* Medicine Safety Panel — shown inline on home page, NO redirect */}
                    {activeSearchQuery && (
                        <div className="animate-in fade-in slide-in-from-top-4 mx-auto mt-4 w-full max-w-2xl text-left duration-200">
                            <MedicineSafetyPanel
                                key={activeSearchQuery}
                                searchQuery={activeSearchQuery}
                                onClose={() => setActiveSearchQuery("")}
                            />
                        </div>
                    )}
                </section>

                <div className="container mx-auto max-w-6xl px-4">
                    {/* ── Primary Action: Scan Medicine ── */}
                    <section className="mt-8 mb-12">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 transition-colors duration-300 dark:text-white">
                                {tHome("scan_section_title")}
                            </h2>
                            <p className="mt-2 text-slate-500 transition-colors duration-300 dark:text-slate-400">
                                {tHome("scan_section_subtitle")}
                            </p>
                        </div>
                        <section
                            ref={alertsPrefetchRef}
                            className="animate-in slide-in-from-bottom-8 fade-in fill-mode-both mt-4 mb-10 duration-500"
                        >
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex w-full transform-gpu cursor-pointer flex-col justify-center overflow-hidden rounded-[2.5rem] border border-white/10 p-8 text-left text-white shadow-2xl shadow-emerald-900/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-emerald-500/30 active:scale-[0.98] md:p-10"
                                aria-label="Scan medicine"
                            >
                                {/* Rich Depth Background */}
                                <div className="absolute inset-0 z-0 bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-700"></div>

                                {/* Inner Glow / Vignette */}
                                <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
                                <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-black/10 via-transparent to-transparent"></div>

                                {/* Floating decorative blobs */}
                                <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-teal-400/30 mix-blend-overlay blur-3xl transition-transform duration-700 group-hover:translate-x-10 group-hover:scale-110"></div>
                                <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-300/20 mix-blend-overlay blur-3xl transition-transform duration-700 group-hover:-translate-x-10 group-hover:scale-110"></div>

                                {/* Premium reflective shine effect */}
                                <div className="absolute inset-0 z-10 translate-x-[-150%] skew-x-[-30deg] bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-[150%]"></div>

                                <div className="relative z-20 flex flex-col justify-between gap-6 md:flex-row md:items-center">
                                    <div className="flex items-center gap-6 md:gap-8">
                                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/30 bg-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-white/30 md:h-24 md:w-24">
                                            <div className="absolute inset-0 bg-linear-to-tr from-white/0 to-white/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                                            <Camera
                                                className="h-10 w-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-500 group-hover:scale-110 md:h-12 md:w-12"
                                                strokeWidth={2}
                                            />
                                        </div>
                                        <div>
                                            <span className="block bg-linear-to-r from-white to-emerald-100 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent drop-shadow-md md:text-5xl">
                                                {tHome("scan_button")}
                                            </span>
                                            <span className="mt-2 block text-sm font-medium text-emerald-50 opacity-90 drop-shadow-sm md:text-lg">
                                                {tHome("scan_subtitle")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Refined Arrow */}
                                    <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-all duration-500 group-hover:translate-x-2 group-hover:bg-white/20 md:flex">
                                        <ChevronRight
                                            size={28}
                                            className="text-white drop-shadow-md"
                                        />
                                    </div>
                                </div>
                            </button>
                        </section>
                    </section>

                    {/* ── Vaccine Hub & Tracker ── */}
                    <section className="mb-6">
                        <h2 className="sr-only">Vaccine Hub</h2>
                        <Link
                            href="/vaccine-hub"
                            className="group relative flex w-full transform-gpu cursor-pointer flex-col overflow-hidden rounded-3xl border border-emerald-200/60 bg-white p-6 shadow-[0_4px_24px_rgba(16,185,129,0.07)] transition-all duration-300 select-none hover:-translate-y-1 hover:border-emerald-300/80 hover:shadow-[0_12px_32px_rgba(16,185,129,0.15)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-700/60 dark:bg-slate-900/70 dark:hover:border-emerald-500/40 dark:hover:shadow-[0_12px_32px_rgba(16,185,129,0.08)]"
                            aria-label="Open Vaccine Hub"
                        >
                            {/* Subtle gradient wash */}
                            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-emerald-500/10 dark:to-teal-500/10" />

                            {/* Header row: icon badge + CTA arrow */}
                            <div className="relative z-10 flex items-start justify-between gap-4">
                                {/* Circular icon badge */}
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 to-teal-50 text-emerald-600 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:from-emerald-500 group-hover:to-teal-400 group-hover:text-white group-hover:shadow-[0_0_18px_rgba(16,185,129,0.4)] dark:from-emerald-950/60 dark:to-teal-900/40 dark:text-emerald-400">
                                    <Syringe
                                        size={26}
                                        strokeWidth={2.5}
                                        className="transition-transform duration-300"
                                    />
                                </div>

                                {/* Animated arrow indicator */}
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 opacity-0 transition-all duration-300 group-hover:opacity-100 dark:bg-emerald-900/40">
                                    <ChevronRight
                                        className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                        aria-hidden="true"
                                    />
                                </div>
                            </div>

                            {/* Text hierarchy */}
                            <div className="relative z-10 mt-4">
                                <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                                    {tHome("vaccine_title")}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                    {tHome("vaccine_subtitle")}
                                </p>
                            </div>

                            {/* Pill-shaped CTA button */}
                            <div className="relative z-10 mt-6">
                                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:border-emerald-500 dark:group-hover:bg-emerald-600 dark:group-hover:text-white">
                                    {tHome("vaccine_open")}
                                    <ArrowRight
                                        size={15}
                                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </span>
                            </div>
                        </Link>
                    </section>

                    <section className="relative mb-20">
                        {/* Decorative Background for Section */}
                        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50 dark:from-emerald-900/20"></div>

                        <div className="mb-12 flex flex-col items-center justify-center space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/50 bg-white/50 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
                                <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                                <span className="text-slate-700 dark:text-slate-300">
                                    {tHome("powerful_capabilities")}
                                </span>
                            </div>
                            <h2 className="bg-linear-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-center text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl dark:from-white dark:via-slate-200 dark:to-slate-400">
                                {tHome("explore_features")}
                            </h2>
                            <p className="max-w-2xl text-center font-medium text-slate-500 dark:text-slate-400">
                                {tHome("features_description")}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                            {/* Upload Photo */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-4xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 select-none hover:-translate-y-1 hover:border-emerald-500 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-emerald-500 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                                aria-label="Upload photo"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-emerald-500/20"></div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:from-emerald-500 group-hover:to-teal-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:from-emerald-950/60 dark:to-emerald-900/40 dark:text-emerald-400">
                                        <Camera
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                                        {tHome("upload_photo")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("upload_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Voice Triage */}
                            <button
                                onClick={() => handleNavigation("voice")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-4xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 select-none hover:-translate-y-1 hover:border-blue-500 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-blue-500 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                                aria-label="Voice triage"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-blue-500/20"></div>

                                <div className="absolute right-6 bottom-8 flex h-10 items-end gap-1.5 opacity-30 transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="h-4 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 group-hover:h-8 group-hover:bg-blue-500"></div>
                                    <div className="h-6 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.2s] group-hover:h-6 group-hover:bg-blue-500"></div>
                                    <div className="h-3 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.4s] group-hover:h-10 group-hover:bg-blue-500"></div>
                                    <div className="h-7 w-1.5 animate-pulse rounded-full bg-blue-400/60 transition-all duration-300 [animation-delay:0.1s] group-hover:h-5 group-hover:bg-blue-500"></div>
                                </div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-100 to-blue-50 text-blue-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:from-blue-500 group-hover:to-cyan-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] dark:from-blue-950/60 dark:to-blue-900/40 dark:text-blue-400">
                                        <Mic
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-blue-600 dark:text-blue-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                                        {tHome("voice_triage")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("voice_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Pharmacy Map */}
                            <button
                                onClick={() => handleNavigation("map")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-4xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 select-none hover:-translate-y-1 hover:border-amber-500 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-amber-500 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                                aria-label="Pharmacy map"
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-amber-500/20"></div>

                                <svg
                                    className="absolute right-0 bottom-0 h-24 w-24 translate-x-4 translate-y-4 text-amber-500/5 transition-all duration-700 group-hover:-translate-x-2 group-hover:-translate-y-2 group-hover:scale-125 group-hover:rotate-45 group-hover:text-amber-500/20 dark:text-amber-400/5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={0.5}
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <circle cx="12" cy="12" r="5" />
                                </svg>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-amber-50 text-amber-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:from-amber-500 group-hover:to-orange-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] dark:from-amber-950/60 dark:to-amber-900/40 dark:text-amber-400">
                                        <MapPin
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500 group-hover:-translate-y-1"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-amber-600 dark:text-amber-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300">
                                        {tHome("pharmacy_map")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("pharmacy_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Scheme Eligibility */}
                            <button
                                onClick={() => handleNavigation("scheme-eligibility")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-4xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 select-none hover:-translate-y-1 hover:border-emerald-500 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-emerald-500 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                                aria-label={tHome("scheme_eligibility")}
                            >
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-emerald-500/20"></div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:from-emerald-500 group-hover:to-teal-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] dark:from-emerald-950/60 dark:to-emerald-900/40 dark:text-emerald-400">
                                        <ShieldCheck
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                                        {tHome("scheme_eligibility")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("scheme_eligibility_subtitle")}
                                    </p>
                                </div>
                            </button>

                            {/* Report Fake Medicine */}
                            <button
                                onClick={() => handleNavigation("report")}
                                className="group relative flex h-[220px] w-full transform-gpu cursor-pointer flex-col justify-between overflow-hidden rounded-4xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 select-none hover:-translate-y-1 hover:border-red-500 hover:shadow-md focus-visible:-translate-y-1 focus-visible:border-red-500 focus-visible:outline-none active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                                aria-label="Report fake medicine"
                            >
                                <div className="absolute right-0 bottom-0 h-24 w-24 translate-x-8 translate-y-8 rounded-full bg-red-500/5 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:bg-red-500/10"></div>

                                <div className="relative z-10 flex items-start justify-between gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-red-100 to-red-50 text-red-600 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 group-hover:from-red-500 group-hover:to-rose-400 group-hover:text-white dark:from-red-950/60 dark:to-red-900/40 dark:text-red-400">
                                        <AlertTriangle
                                            size={26}
                                            strokeWidth={2.5}
                                            className="transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/50 opacity-0 transition-all duration-300 group-hover:opacity-100 dark:bg-slate-800/50">
                                        <ChevronRight
                                            className="h-5 w-5 text-red-600 dark:text-red-400"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>

                                <div className="relative z-10 pt-4">
                                    <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-red-700 dark:text-white dark:group-hover:text-red-300">
                                        {tHome("report_fake")}
                                    </h3>
                                    <p className="mt-2 text-sm leading-snug font-medium text-slate-500 transition-colors group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300">
                                        {tHome("report_fake_subtitle")}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── Health Assistant CTA Banner ── */}
                    <div className="group relative mt-4 transform-gpu overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-8 transition-all duration-500 select-none hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/30 sm:p-10">
                        {/* Decorative Background Elements */}
                        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/20 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>
                        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-900/20 blur-3xl transition-transform duration-700 group-hover:scale-110"></div>

                        <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                            <div className="flex items-center gap-5">
                                {/* Icon */}
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                                    <MessageCircle
                                        size={32}
                                        className="text-white drop-shadow-md"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl">
                                            {tHome("ai_health_assistant")}
                                        </h3>
                                        {/* AI CHAT badge */}
                                        <span className="inline-flex items-center rounded-lg border border-white/30 bg-white/20 px-3 py-1 text-xs font-black tracking-widest text-white uppercase shadow-sm backdrop-blur-sm">
                                            {tHome("ai_chat")}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-emerald-50 opacity-90 drop-shadow-sm sm:text-lg">
                                        {tHome("ai_health_assistant_description")}
                                    </p>
                                </div>
                            </div>

                            {/* Chat Now button */}
                            <button
                                onClick={() => handleNavigation("health")}
                                className="group/btn flex w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-extrabold text-emerald-600 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-emerald-50 hover:shadow-emerald-900/20 sm:w-auto"
                            >
                                <MessageCircle
                                    size={22}
                                    className="transition-transform duration-300 group-hover/btn:scale-110"
                                />
                                {tHome("chat_now")}
                                <ChevronRight
                                    size={22}
                                    className="transition-transform duration-300 group-hover/btn:translate-x-1"
                                />
                            </button>
                        </div>
                    </div>

                    {/* Global Search moved to Hero */}

                    {/* ── Live Alerts Panel (Premium UI) ── */}
                    <div className="mt-12 mb-20">
                        <div className="group/alerts relative flex flex-col overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_8px_40px_rgba(239,68,68,0.08)] dark:border-slate-800/60 dark:bg-slate-900/80">
                            {/* Decorative Top Glow */}
                            <div className="absolute top-0 left-1/2 h-1 w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-red-500/50 to-transparent blur-sm transition-all duration-500 group-hover/alerts:via-red-500/80" />

                            <div className="relative z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-950/50">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-inner dark:bg-red-500/10 dark:text-red-400">
                                        <Activity size={24} className="animate-pulse" />
                                    </div>
                                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                        {tHome("live_cdsco_alerts")}
                                    </h3>
                                </div>
                                <span className="hidden items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-bold tracking-widest text-red-600 uppercase shadow-sm sm:flex dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                                    </span>
                                    {tHome("india_region")}
                                </span>
                            </div>

                            <div className="relative z-10 flex-1 bg-slate-50/30 p-6 sm:p-8 dark:bg-slate-950/30">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-6">
                                    {loading ? (
                                        <>
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
                                                >
                                                    <div className="absolute top-0 bottom-0 left-0 w-2 bg-slate-200 dark:bg-slate-700" />
                                                    <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                                                    <div className="flex-1 space-y-2 pt-1">
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
                                        homepageAlerts.map((alert) => {
                                            const visibleBatchNumber = getVisibleAlertBatchNumber(
                                                alert.composition,
                                                alert.batch_number
                                            );
                                            return (
                                                <div
                                                    key={alert.id}
                                                    className={`group relative flex cursor-pointer items-start gap-4 rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 ${
                                                        alert.brand_name === "SYSTEM_UPDATE"
                                                            ? "border-l-blue-500 hover:border-l-blue-600"
                                                            : alert.cdsco_approval_status ===
                                                                    "banned" ||
                                                                alert.is_counterfeit_alert
                                                              ? "border-l-red-500 hover:border-l-red-600"
                                                              : "border-l-orange-500 hover:border-l-orange-600"
                                                    }`}
                                                    onClick={() => handleNavigation("alerts")}
                                                >
                                                    <div className="pointer-events-none absolute inset-0 z-0 rounded-r-2xl bg-linear-to-br from-transparent to-slate-50/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:to-slate-800/20" />

                                                    {/* Icon */}
                                                    <div
                                                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                                                            alert.brand_name === "SYSTEM_UPDATE"
                                                                ? "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-500/10 dark:text-blue-400"
                                                                : alert.cdsco_approval_status ===
                                                                        "banned" ||
                                                                    alert.is_counterfeit_alert
                                                                  ? "border-red-100 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-400"
                                                                  : "border-orange-100 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-500/10 dark:text-orange-400"
                                                        }`}
                                                    >
                                                        {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                            <Globe size={18} strokeWidth={2.5} />
                                                        ) : (
                                                            <AlertTriangle
                                                                size={18}
                                                                strokeWidth={2.5}
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="relative z-10 min-w-0 flex-1 pt-0.5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h4 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
                                                                {alert.brand_name}
                                                            </h4>
                                                            <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
                                                                {formatRelativeTime(
                                                                    alert.created_at,
                                                                    locale || "en"
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                                            <span className="truncate">
                                                                {alert.composition}
                                                            </span>
                                                            {visibleBatchNumber ? (
                                                                <>
                                                                    <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                                    <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">
                                                                        Batch{" "}
                                                                        <span className="font-bold">
                                                                            {visibleBatchNumber}
                                                                        </span>
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
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
                                                title={tHome("alerts_empty_title")}
                                                description={tHome("alerts_empty_description")}
                                                className="border-none bg-transparent! p-6"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Alert Log CTA ── */}
                            <div className="relative z-10 border-t border-slate-100 bg-white/50 p-6 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/50">
                                <Link href="/alerts" className="block w-full">
                                    <button className="group/btn flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white py-4 text-base font-extrabold text-slate-700 shadow-sm transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:ring-4 focus:ring-slate-100 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:ring-slate-800">
                                        <Activity
                                            size={20}
                                            className="transition-transform duration-300 group-hover/btn:scale-110"
                                        />
                                        {tHome("view_full_alert_log")}
                                        <ChevronRight
                                            size={20}
                                            className="text-slate-400 transition-transform duration-300 group-hover/btn:translate-x-1"
                                        />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <section className="mb-20 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 py-10 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="mb-8 flex flex-col gap-3 px-5 sm:px-8 md:flex-row md:items-end md:justify-between">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-extrabold tracking-widest text-emerald-600 uppercase dark:border-emerald-400/20 dark:text-emerald-400">
                                    <Star size={13} className="fill-current" aria-hidden="true" />
                                    {tHome("trusted_by_citizens")}
                                </div>
                                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                                    {tHome("voices_title")}
                                </h2>
                            </div>
                            <p className="max-w-md text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                                {tHome("voices_description")}
                            </p>
                        </div>

                        <div className="testimonial-marquee relative flex overflow-hidden">
                            <div className="testimonial-marquee-track flex min-w-full shrink-0 gap-5 px-5 sm:px-8">
                                {[...testimonials, ...testimonials].map((testimonial, index) => (
                                    <article
                                        key={`${testimonial.name}-${index}`}
                                        className="flex h-[250px] w-[300px] shrink-0 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500 hover:shadow-md sm:w-[360px] dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div>
                                            <Quote
                                                size={24}
                                                className="mb-4 text-emerald-500"
                                                aria-hidden="true"
                                            />
                                            <p className="text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
                                                {testimonial.quote}
                                            </p>
                                        </div>
                                        <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-500 text-sm font-black text-white shadow-sm">
                                                {testimonial.name
                                                    .split(" ")
                                                    .map((part) => part[0])
                                                    .join("")}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                                    {testimonial.name}
                                                </h3>
                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    {testimonial.role}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
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
