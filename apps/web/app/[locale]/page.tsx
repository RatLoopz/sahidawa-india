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
    HelpCircle
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
                <section className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-bold text-emerald-600 dark:border-emerald-400/20 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        FREE & OPEN SOURCE
                    </div>

                    {/* Headline */}
                    <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-slate-900 dark:text-white leading-tight">
                        Scan a medicine.<br />
                        Check its safety status.<br />
                        <span className="text-emerald-600 dark:text-emerald-400">Stay ahead of recalls.</span>
                    </h1>

                    {/* Supporting Text */}
                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
                        Check available medicine and regulatory information, see safety alerts, and find trusted pharmacies with SahiDawa.
                    </p>

                    {/* Compact CTAs */}
                    <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <button
                            onClick={() => handleNavigation("scan")}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-bold text-white shadow-md shadow-emerald-600/10 hover:bg-emerald-700 hover:shadow-emerald-600/20 transition-all active:scale-[0.98]"
                        >
                            <Camera size={18} />
                            Scan Medicine
                        </button>
                        <button
                            onClick={() => handleNavigation("map")}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                            <MapPin size={18} />
                            Find a Pharmacy
                        </button>
                    </div>
                </section>

                <div className="mx-auto max-w-5xl px-4">
                    {/* ── 2. MEDICINE SEARCH SECTION ── */}
                    <section className="mb-14 rounded-3xl border border-slate-200/60 bg-white/70 p-6 sm:p-8 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/60">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Check a medicine
                            </h2>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
                    <section className="mb-14">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                How SahiDawa helps
                            </h2>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Accessible tools designed to protect you and your family.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {/* Highlighted: Scan & Verify */}
                            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-xs hover:shadow-md transition-all md:col-span-1">
                                <div className="absolute inset-0 -z-10 bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                                <div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/10">
                                        <Camera size={22} />
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                                        Scan & Verify
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        Scan a barcode or medicine package and check available medicine information.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleNavigation("scan")}
                                    className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                    Verify Medicine →
                                </button>
                            </div>

                            {/* Find a Pharmacy */}
                            <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900">
                                <div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        <MapPin size={22} />
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                                        Find a Pharmacy
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Find trusted pharmacies and nearby healthcare resources.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleNavigation("map")}
                                    className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                    Locate Stores →
                                </button>
                            </div>

                            {/* Ask SahiDawa */}
                            <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-slate-300 hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900">
                                <div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        <MessageCircle size={22} />
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                                        Ask SahiDawa
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Get basic health information and triage guidance in supported languages.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleNavigation("health")}
                                    className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                >
                                    Consult AI →
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── 4. SAFETY ALERTS ── */}
                    <section className="mb-14">
                        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-xs dark:border-slate-800/60 dark:bg-slate-900">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
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

                    {/* ── 5. SECONDARY FEATURES ── */}
                    <section className="mb-14">
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Additional Tools
                            </h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Explore other capabilities and medical resources.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                            {/* Upload Photo */}
                            <button
                                onClick={() => handleNavigation("scan")}
                                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <Camera size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                        Upload Photo
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Check packaging using images
                                    </p>
                                </div>
                            </button>

                            {/* Report Fake Medicine */}
                            <button
                                onClick={() => handleNavigation("report")}
                                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                                        Report Suspicious
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Alert public health authorities
                                    </p>
                                </div>
                            </button>

                            {/* Vaccine Hub */}
                            <button
                                onClick={() => handleNavigation("vaccine-hub")}
                                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                    <Syringe size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        Vaccine Hub
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Immunization schedules & safety
                                    </p>
                                </div>
                            </button>

                            {/* Scheme Eligibility */}
                            <button
                                onClick={() => handleNavigation("scheme-eligibility")}
                                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                        Scheme Eligibility
                                    </h4>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Check healthcare assistance
                                    </p>
                                </div>
                            </button>
                        </div>
                    </section>

                    {/* ── 6. AI HEALTH ASSISTANT ── */}
                    <section className="mb-14 rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-8 dark:border-slate-800/60 dark:bg-slate-900">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-2">
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

                    {/* ── 7. TRUST & COMMUNITY SECTION ── */}
                    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-14">
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
