"use client";
import React, { useEffect, useState } from "react";
import { Activity, ArrowLeft, Filter, AlertTriangle, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { API_BASE } from "@/lib/api";
import BackToTopButton from "@/app/[locale]/components/BackToTopButton";

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
        // Fall back to a standard date view if it's older than 24 hours
        return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
}

export default function FullAlertsLogPage() {
    const t = useTranslations("Alerts");
    const [allAlerts, setAllAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Filters
    const [brandSearch, setBrandSearch] = useState("");
    const [regionSearch, setRegionSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        const fetchAlerts = async () => {
            setLoading(true);
            setError(false);
            try {
                let url = `${API_BASE}/api/v1/alerts?page=${page}&limit=50`;
                if (brandSearch) url += `&brand=${encodeURIComponent(brandSearch)}`;
                if (regionSearch) url += `&region=${encodeURIComponent(regionSearch)}`;

                const res = await fetch(url);
                if (!res.ok) {
                    setError(true);
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                setAllAlerts(data.data || []);
                setTotalCount(data.totalCount || 0);
            } catch (err) {
                // Log silently to avoid Next.js dev overlay popup
                console.log("Fetch failed:", err instanceof Error ? err.message : err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search slightly
        const timer = setTimeout(() => {
            fetchAlerts();
        }, 400);

        return () => clearTimeout(timer);
    }, [page, brandSearch, regionSearch]);

    return (
        <>
            <div
                id="main-content"
                className="mx-auto max-w-5xl px-4 py-8 text-slate-900 dark:text-white"
            >
                <div className="mb-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        {t("backHome")}
                    </Link>
                </div>

                {/* Header Section */}
                <div className="mb-8 flex flex-col gap-6 border-b border-slate-100 pb-6 md:flex-row md:items-center md:justify-between dark:border-slate-800">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center rounded-xl bg-red-50 p-2.5 text-red-500 dark:bg-red-950/30 dark:text-red-400">
                                <Activity className="animate-pulse" size={24} />
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                {t("title")}
                            </h1>
                        </div>
                        <p className="font-medium text-slate-500 dark:text-slate-400">
                            {t("subtitle")}
                        </p>
                    </div>

                    {/* Grouped status markers in minimalist capsule badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                            </span>
                            {t("badge")}
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3.5 py-1.5 text-xs font-bold tracking-wider text-red-700 uppercase dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                            <Globe size={12} />
                            {t("regionBadge")}
                        </span>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            <Filter size={12} />
                            {t("totalCount", { count: totalCount })}
                        </div>
                    </div>
                </div>

                <RecallPushSubscriber />

                {/* Filters Section with soft ambient shadows */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row">
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <Search size={18} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <input
                            type="text"
                            placeholder={t("brandPlaceholder")}
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                            className="block w-full rounded-2xl border border-slate-100 bg-white p-3.5 pl-11 text-sm text-slate-900 placeholder-slate-400 shadow-md transition-all duration-250 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                        />
                    </div>
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <Globe size={18} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <input
                            type="text"
                            placeholder={t("regionPlaceholder")}
                            value={regionSearch}
                            onChange={(e) => setRegionSearch(e.target.value)}
                            className="block w-full rounded-2xl border border-slate-100 bg-white p-3.5 pl-11 text-sm text-slate-900 placeholder-slate-400 shadow-md transition-all duration-250 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
                        />
                    </div>
                </div>

                {error && (
                    <LiveMessage
                        tone="critical"
                        className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400"
                    >
                        {t("error")}
                    </LiveMessage>
                )}

                <div role="feed" aria-busy={loading} className="space-y-4">
                    {loading ? (
                        <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center font-medium text-slate-400 shadow-md dark:border-slate-800 dark:bg-slate-900">
                            {t("loading")}
                        </div>
                    ) : allAlerts.length > 0 ? (
                        allAlerts.map((alert) => {
                            const isSystem =
                                alert.reported_brand_name === "SYSTEM_UPDATE" ||
                                alert.brand_name === "SYSTEM_UPDATE" ||
                                alert.brand === "SYSTEM_UPDATE";
                            const isCritical =
                                alert.cdsco_approval_status === "banned" ||
                                alert.is_counterfeit_alert ||
                                alert.alert_type === "Banned";

                            const statusText = isSystem
                                ? "Update"
                                : alert.cdsco_approval_status || alert.alert_type || "NSQ";

                            return (
                                <div
                                    key={alert.id}
                                    role="article"
                                    className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-md transition-all duration-300 hover:shadow-lg md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
                                >
                                    {/* Left accent colored strip */}
                                    <div
                                        className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                                            isSystem
                                                ? "bg-blue-500"
                                                : isCritical
                                                  ? "bg-rose-500"
                                                  : "bg-amber-500"
                                        }`}
                                    ></div>

                                    {/* Left content: Icon + Title & Badges + Subtitle */}
                                    <div className="flex flex-1 items-start gap-4">
                                        {/* Alert Icon */}
                                        <div
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                                                isSystem
                                                    ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400"
                                                    : isCritical
                                                      ? "dark:text-rose-450 bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:bg-rose-950/40"
                                                      : "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400"
                                            }`}
                                        >
                                            {isSystem ? (
                                                <Globe size={22} strokeWidth={2.2} />
                                            ) : (
                                                <AlertTriangle size={22} strokeWidth={2.2} />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-base leading-tight font-extrabold tracking-tight text-slate-900 dark:text-white">
                                                    {isSystem
                                                        ? t("systemUpdate")
                                                        : alert.reported_brand_name ||
                                                          alert.brand_name ||
                                                          alert.brand}
                                                </h4>

                                                {/* Semi-transparent status badge */}
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-xs ${
                                                        isSystem
                                                            ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                                                            : isCritical
                                                              ? "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                                                              : "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                                                    }`}
                                                >
                                                    {statusText}
                                                </span>
                                            </div>

                                            <p className="dark:text-slate-350 text-sm font-medium text-slate-600">
                                                {alert.alert_type
                                                    ? t("alertType", { type: alert.alert_type })
                                                    : alert.composition || t("noDetails")}
                                            </p>

                                            {/* Grouped Metadata */}
                                            {!isSystem && (
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-normal text-slate-400 dark:text-slate-500">
                                                            {t("batchLabel")}
                                                        </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                            {alert.batch_number}
                                                        </span>
                                                    </span>
                                                    <span className="text-slate-300 dark:text-slate-700">
                                                        •
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-normal text-slate-400 dark:text-slate-500">
                                                            {t("manufacturerLabel")}
                                                        </span>
                                                        <span className="line-clamp-1 max-w-[180px] font-bold text-slate-700 sm:max-w-[240px] dark:text-slate-300">
                                                            {alert.manufacturer}
                                                        </span>
                                                    </span>
                                                    {(alert.state || alert.district) && (
                                                        <>
                                                            <span className="text-slate-300 dark:text-slate-700">
                                                                •
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-normal text-slate-400 dark:text-slate-500">
                                                                    {t("regionLabel")}
                                                                </span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                    {[alert.state, alert.district]
                                                                        .filter(Boolean)
                                                                        .join(", ")}
                                                                </span>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side anchor: Date & Interactive action */}
                                    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-50 pt-3 md:flex-col md:items-end md:justify-center md:border-0 md:pt-0 dark:border-slate-800/50">
                                        <span className="text-xs font-semibold text-slate-400 md:mb-1 dark:text-slate-500">
                                            {formatRelativeTime(
                                                alert.reported_at || alert.created_at
                                            )}
                                        </span>
                                        <span className="hover:text-emerald-750 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 transition-colors duration-200 group-hover:translate-x-0.5 dark:text-emerald-400 dark:hover:text-emerald-300">
                                            View Details{" "}
                                            <span className="text-sm font-bold">→</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center font-medium text-slate-400 shadow-md dark:border-slate-800 dark:bg-slate-900">
                            {t("empty")}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-center gap-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="dark:hover:bg-slate-750 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        {t("previous")}
                    </button>
                    <button
                        disabled={page * 50 >= totalCount}
                        onClick={() => setPage((p) => p + 1)}
                        className="dark:hover:bg-slate-750 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        {t("next")}
                    </button>
                </div>
            </div>
            <BackToTopButton />
        </>
    );
}
