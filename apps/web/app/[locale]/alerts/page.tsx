"use client";
import React, { useEffect, useState } from "react";
import { Activity, ArrowLeft, Filter, AlertTriangle, Search } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { CopyButton } from "@/components/ui/CopyButton";
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
            } catch {
                // Log silently to avoid Next.js dev overlay popup

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
                className="mx-auto max-w-5xl px-4 py-8 text-(--color-text-primary)"
            >
                <div className="mb-6 flex flex-col items-start gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
                    >
                        <ArrowLeft size={16} />
                        {t("backHome")}
                    </Link>

                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 duration-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badge")}
                    </div>
                </div>

                <div className="mb-8 flex flex-col justify-between gap-4 border-b border-(--color-border-muted) pb-6 md:flex-row md:items-center">
                    <div>
                        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-(--color-text-primary)">
                            <Activity className="text-red-500" size={28} />
                            {t("title")}
                        </h1>
                        <p className="mt-1 font-medium text-(--color-text-secondary)">
                            {t("subtitle")}
                        </p>
                    </div>
                    <span className="hidden rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold tracking-wider text-red-600 uppercase sm:block dark:bg-red-950/30 dark:text-red-400">
                        {t("regionBadge")}
                    </span>
                    <div className="inline-flex items-center gap-2 self-start rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) px-4 py-2 text-sm font-bold text-(--color-text-primary) shadow-sm md:self-auto">
                        <Filter size={16} />
                        {t("totalCount", { count: totalCount })}
                    </div>
                </div>

                <RecallPushSubscriber />

                {/* Filters Section */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row">
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search size={18} className="text-(--color-text-muted)" />
                        </div>
                        <input
                            type="text"
                            placeholder={t("brandPlaceholder")}
                            value={brandSearch}
                            onChange={(e) => setBrandSearch(e.target.value)}
                            className="block w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 pl-10 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-hidden"
                        />
                    </div>
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Globe size={18} className="text-(--color-text-muted)" />
                        </div>
                        <input
                            type="text"
                            placeholder={t("regionPlaceholder")}
                            value={regionSearch}
                            onChange={(e) => setRegionSearch(e.target.value)}
                            className="block w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 pl-10 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-hidden"
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
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) py-16 text-center font-medium text-(--color-text-muted)">
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

                            return (
                                <div
                                    key={alert.id}
                                    role="article"
                                    className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    {/* Left edge colored strip */}
                                    <div
                                        className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                                            isSystem
                                                ? "bg-blue-500"
                                                : isCritical
                                                  ? "bg-red-500"
                                                  : "bg-orange-400"
                                        }`}
                                    ></div>

                                    {/* Dynamic Alert Icon Wrapper */}
                                    <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                            isSystem
                                                ? "bg-blue-50 text-blue-500 group-hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:group-hover:bg-blue-900/30"
                                                : isCritical
                                                  ? "bg-red-50 text-red-500 group-hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:group-hover:bg-red-900/30"
                                                  : "bg-orange-50 text-orange-500 group-hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:group-hover:bg-orange-900/30"
                                        }`}
                                    >
                                        {isSystem ? (
                                            <Globe size={20} strokeWidth={2.5} />
                                        ) : (
                                            <AlertTriangle size={20} strokeWidth={2.5} />
                                        )}
                                    </div>

                                    {/* Text Content */}
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <h4 className="leading-tight font-bold text-(--color-text-primary)">
                                                    {isSystem
                                                        ? t("systemUpdate")
                                                        : alert.reported_brand_name ||
                                                          alert.brand_name ||
                                                          alert.brand}
                                                </h4>
                                                {!isSystem && (
                                                    <span
                                                        className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                                            isCritical
                                                                ? "dark:text-red-450 bg-red-50 text-red-600 dark:bg-red-950/30"
                                                                : "dark:text-orange-450 bg-orange-50 text-orange-600 dark:bg-orange-950/30"
                                                        }`}
                                                    >
                                                        {alert.cdsco_approval_status ||
                                                            alert.alert_type ||
                                                            "NSQ"}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="shrink-0 text-[11px] font-medium text-(--color-text-muted)">
                                                {formatRelativeTime(
                                                    alert.reported_at || alert.created_at
                                                )}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                            {alert.alert_type
                                                ? t("alertType", { type: alert.alert_type })
                                                : alert.composition || t("noDetails")}
                                        </p>

                                        {/* Render metadata bottom line layout only if it's not a system update card */}
                                        {!isSystem && (
                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-(--color-text-muted)">
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        {t("batchLabel")}{" "}
                                                        <span className="font-bold text-(--color-text-primary)">
                                                            {alert.batch_number}
                                                        </span>
                                                    </span>
                                                    <CopyButton text={alert.batch_number} />
                                                </div>
                                                <span>•</span>
                                                <span>
                                                    {t("manufacturerLabel")}{" "}
                                                    <span className="font-bold text-(--color-text-primary)">
                                                        {alert.manufacturer}
                                                    </span>
                                                </span>
                                                {(alert.state || alert.district) && (
                                                    <>
                                                        <span>•</span>
                                                        <span>
                                                            {t("regionLabel")}{" "}
                                                            <span className="font-bold text-(--color-text-primary)">
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
                            );
                        })
                    ) : (
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) py-16 text-center font-medium text-(--color-text-muted)">
                            {t("empty")}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-center gap-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50"
                    >
                        {t("previous")}
                    </button>
                    <button
                        disabled={page * 50 >= totalCount}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("next")}
                    </button>
                </div>
            </div>
            <BackToTopButton />
        </>
    );
}
