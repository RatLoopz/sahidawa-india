"use client";
import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import {
    Activity,
    Filter,
    AlertTriangle,
    Search,
    Globe,
    AlertCircle,
    MapPin,
    ChevronDown,
    ShieldAlert,
    BellOff,
    RefreshCw,
    Download,
    Building2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { CopyButton } from "@/components/ui/CopyButton";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { API_BASE } from "@/lib/api";
import BackToTopButton from "@/app/[locale]/components/BackToTopButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useInView } from "react-intersection-observer";

// Debounce hook for search inputs - prevents API calls on every keystroke
function useDebounce(value: string, delay: number = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return "Recent";
    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) return "Just now";
    if (elapsed < msPerHour) return `${Math.round(elapsed / msPerMinute)}m ago`;
    if (elapsed < msPerDay) return `${Math.round(elapsed / msPerHour)}h ago`;
    return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface Alert {
    id: string;
    cdsco_approval_status?: string;
    is_counterfeit_alert?: boolean;
    alert_type?: string;
    state?: string;
    district?: string;
    reported_brand_name?: string;
    brand_name?: string;
    brand?: string;
    batch_number?: string;
    manufacturer?: string;
    reported_at?: string | null;
    created_at?: string | null;
    composition?: string;
}

export default function FullAlertsLogPage() {
    const t = useTranslations("Alerts");
    const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);

    // Filters
    const [brandSearch, setBrandSearch] = useState("");
    const [regionSearch, setRegionSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Debounced search values - prevents API calls on every keystroke
    const debouncedBrandSearch = useDebounce(brandSearch, 300);
    const debouncedRegionSearch = useDebounce(regionSearch, 300);

    // Accordion active expanded state
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

    // Intersection Observer for infinite scroll
    const [inViewRef, inView] = useInView({
        triggerOnce: false,
        threshold: 0.1,
        rootMargin: "0px 0px 100px 0px",
    });

    useEffect(() => {
        if (inView && !loadingMore && hasMore && !loading) {
            setPage((prev) => prev + 1);
        }
    }, [inView, loadingMore, hasMore, loading]);

    const fetchAlerts = async (pageNum: number, append = false) => {
        try {
            let url = `${API_BASE}/api/v1/alerts?page=${pageNum}&limit=50`;
            if (debouncedBrandSearch) url += `&brand=${encodeURIComponent(debouncedBrandSearch)}`;
            if (debouncedRegionSearch)
                url += `&region=${encodeURIComponent(debouncedRegionSearch)}`;

            const res = await fetch(url);
            if (!res.ok) {
                setError(true);
                return;
            }
            const data = await res.json();

            if (append) {
                setAllAlerts((prev) => [...prev, ...(data.data || [])]);
            } else {
                setAllAlerts(data.data || []);
            }

            setTotalCount(data.totalCount || 0);
            setHasMore(pageNum * 50 < (data.totalCount || 0));
        } catch {
            setError(true);
        }
    };

    // Initial load and when debounced filters change
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setPage(1);
            setHasMore(true);
            await fetchAlerts(1, false);
            setLoading(false);
        };

        const timer = setTimeout(loadData, 400);
        return () => clearTimeout(timer);
    }, [debouncedBrandSearch, debouncedRegionSearch, refreshTrigger]);

    // Load more when page changes (triggered by intersection observer)
    useEffect(() => {
        if (page > 1 && !loading) {
            const loadMore = async () => {
                setLoadingMore(true);
                await fetchAlerts(page, true);
                setLoadingMore(false);
            };
            loadMore();
        }
    }, [page]);

    const criticalCount = allAlerts.filter(
        (alert) =>
            alert.cdsco_approval_status === "banned" ||
            alert.is_counterfeit_alert ||
            alert.alert_type === "Banned"
    ).length;

    const uniqueRegionsCount = Array.from(
        new Set(allAlerts.map((alert) => alert.state).filter(Boolean))
    ).length;

    const toggleExpand = (id: string) => {
        setExpandedAlertId((prev) => (prev === id ? null : id));
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleShareAlert = (e: React.MouseEvent, alert: Alert) => {
        e.stopPropagation();
        const brand =
            alert.reported_brand_name || alert.brand_name || alert.brand || "SYSTEM_UPDATE";
        const shareText = `⚠️ SahiDawa CDSCO Drug Safety Alert:\n\nBrand: ${brand}\nBatch: ${alert.batch_number || "N/A"}\n\nPlease check safety logs.`;

        if (navigator.share) {
            navigator.share({ title: `Safety Alert: ${brand}`, text: shareText }).catch(() => {
                navigator.clipboard.writeText(shareText);
                toast.success("Alert details copied to clipboard!");
            });
        } else {
            navigator.clipboard.writeText(shareText);
            toast.success("Alert details copied to clipboard!");
        }
    };

    const handleExportCSV = () => {
        if (!allAlerts || allAlerts.length === 0) {
            toast.error("No alerts available to export.");
            return;
        }

        const headers = [
            "Brand Name",
            "Batch Number",
            "Manufacturer",
            "Status",
            "Type",
            "State",
            "Reported At",
        ];

        const csvRows = allAlerts.map((alert) => {
            const brand =
                alert.reported_brand_name || alert.brand_name || alert.brand || "SYSTEM_UPDATE";
            return [
                `"${brand.replace(/"/g, '""')}"`,
                `"${(alert.batch_number || "N/A").replace(/"/g, '""')}"`,
                `"${(alert.manufacturer || "N/A").replace(/"/g, '""')}"`,
                `"${(alert.cdsco_approval_status || alert.alert_type || "Flagged").replace(/"/g, '""')}"`,
                `"${(alert.alert_type || "NSQ").replace(/"/g, '""')}"`,
                `"${(alert.state || "N/A").replace(/"/g, '""')}"`,
                `"${(alert.reported_at || alert.created_at || "N/A").replace(/"/g, '""')}"`,
            ].join(",");
        });

        const csvString = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute(
            "download",
            `alerts_export_${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Alerts exported successfully!");
    };

    return (
        <>
            <div
                id="main-content"
                className="mx-auto max-w-5xl min-w-[320px] px-4 py-8 text-(--color-text-primary)"
            >
                {/* Top Navigation Row */}
                <div className="mb-6 flex flex-col gap-4">
                    <PageHeader backHref="/" variant="light" />

                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-xs font-black text-emerald-700 duration-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badge")}
                    </div>
                </div>

                {/* Dashboard Title Panel */}
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
                    <div className="flex items-center gap-3">
                        <span className="hidden rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold tracking-wider text-red-600 uppercase sm:block dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                            {t("regionBadge")}
                        </span>
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-(--color-border-muted) bg-white px-4 py-2 text-xs font-bold text-(--color-text-primary) shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                            <Download size={14} />
                            Export CSV
                        </button>
                    </div>
                </div>

                <RecallPushSubscriber />

                {/* Dashboard Stats Panel */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-xs dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black tracking-wider text-(--color-text-muted) uppercase">
                                Registered Safety Logs
                            </span>
                            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                <ShieldAlert size={20} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-(--color-text-primary)">
                                {totalCount}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                </span>
                                Live Sync
                            </span>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-xs dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black tracking-wider text-(--color-text-muted) uppercase">
                                Critical / Banned
                            </span>
                            <div className="rounded-2xl bg-red-500/10 p-2.5 text-red-500 dark:bg-red-500/20 dark:text-red-400">
                                <AlertCircle size={20} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-(--color-text-primary)">
                                {loading ? "..." : criticalCount}
                            </span>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-xs dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black tracking-wider text-(--color-text-muted) uppercase">
                                Impacted Areas
                            </span>
                            <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                                <MapPin size={20} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tight text-(--color-text-primary)">
                                {loading ? "..." : uniqueRegionsCount}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="mb-6 rounded-3xl border border-(--color-border-muted) bg-slate-50/40 p-5 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-(--color-text-secondary) uppercase">
                        <Filter size={14} className="text-emerald-500" />
                        Refine Safety Registry
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                <Search size={18} className="text-(--color-text-muted)" />
                            </div>
                            <input
                                type="text"
                                placeholder={t("brandPlaceholder")}
                                value={brandSearch}
                                onChange={(e) => {
                                    setBrandSearch(e.target.value);
                                    setPage(1);
                                    setHasMore(true);
                                }}
                                className="block w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted)/40 p-3 pl-11 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner transition-all focus:border-emerald-500/80 focus:bg-white focus:outline-hidden dark:focus:bg-slate-900/50"
                            />
                        </div>
                        <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                <Globe size={18} className="text-(--color-text-muted)" />
                            </div>
                            <input
                                type="text"
                                placeholder={t("regionPlaceholder")}
                                value={regionSearch}
                                onChange={(e) => {
                                    setRegionSearch(e.target.value);
                                    setPage(1);
                                    setHasMore(true);
                                }}
                                className="block w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted)/40 p-3 pl-11 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner transition-all focus:border-emerald-500/80 focus:bg-white focus:outline-hidden dark:focus:bg-slate-900/50"
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <LiveMessage
                        tone="critical"
                        className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400"
                    >
                        {t("error")}
                    </LiveMessage>
                )}

                {/* Main Render Pipeline */}
                {loading ? (
                    <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) py-20 text-center font-bold text-(--color-text-muted) shadow-inner">
                        <span className="mr-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent align-middle"></span>
                        {t("loading")}
                    </div>
                ) : allAlerts.length === 0 ? (
                    <div className="group my-6 flex flex-col items-center justify-center rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) px-6 py-16 text-center shadow-xs transition-all duration-300 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <div className="rounded-full bg-amber-50 p-4 text-amber-600 shadow-inner transition-transform duration-300 group-hover:scale-105 dark:bg-amber-950/30 dark:text-amber-400">
                            <BellOff className="h-8 w-8" />
                        </div>
                        <div className="mt-4 max-w-sm space-y-2">
                            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                No Active Health Alerts
                            </h3>
                            <p className="text-sm leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                                {error
                                    ? "Database synchronization error encountered while fetching active logs. Please try checking for sync updates."
                                    : "The safety registry is clear. No active drug recalls, counterfeit warnings, or banned formulations match your filters."}
                            </p>
                        </div>
                        <div className="pt-6">
                            <button
                                type="button"
                                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                                className="group/btn inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                            >
                                <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover/btn:rotate-180" />
                                Check For Sync Updates
                            </button>
                        </div>
                    </div>
                ) : (
                    /* --- Alerts List View --- */
                    <div role="feed" className="space-y-4">
                        <motion.div layout className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {allAlerts.map((alert) => {
                                    const isSystem =
                                        alert.reported_brand_name === "SYSTEM_UPDATE" ||
                                        alert.brand_name === "SYSTEM_UPDATE" ||
                                        alert.brand === "SYSTEM_UPDATE";
                                    const isCritical =
                                        alert.cdsco_approval_status === "banned" ||
                                        alert.is_counterfeit_alert ||
                                        alert.alert_type === "Banned";
                                    // System updates have no detail metadata, so only
                                    // medicine alerts expose a collapsible detail pane.
                                    const isCollapsible = !isSystem;
                                    const isExpanded = expandedAlertId === alert.id;

                                    return (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -15 }}
                                            transition={{ duration: 0.3 }}
                                            key={alert.id}
                                            onClick={
                                                isCollapsible
                                                    ? () => toggleExpand(alert.id)
                                                    : undefined
                                            }
                                            tabIndex={isCollapsible ? 0 : undefined}
                                            role={isCollapsible ? "button" : undefined}
                                            aria-expanded={isCollapsible ? isExpanded : undefined}
                                            aria-controls={
                                                isCollapsible
                                                    ? `alert-details-${alert.id}`
                                                    : undefined
                                            }
                                            onKeyDown={
                                                isCollapsible
                                                    ? (e) => {
                                                          if (e.key === "Enter" || e.key === " ") {
                                                              e.preventDefault();
                                                              toggleExpand(alert.id);
                                                          }
                                                      }
                                                    : undefined
                                            }
                                            className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-(--color-surface-page) p-6 shadow-xs transition-all focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden ${
                                                isCollapsible ? "cursor-pointer" : ""
                                            } ${
                                                isExpanded
                                                    ? "border-emerald-500/30 ring-2 ring-emerald-500/5"
                                                    : "border-(--color-border-muted)"
                                            }`}
                                        >
                                            <div
                                                className={`absolute top-0 bottom-0 left-0 w-1.5 ${isSystem ? "bg-blue-500" : isCritical ? "bg-red-500" : "bg-amber-500"}`}
                                            ></div>
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-blue-500/10 text-blue-500" : isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600"}`}
                                                >
                                                    {isSystem ? (
                                                        <Globe size={20} />
                                                    ) : isCritical ? (
                                                        <ShieldAlert size={20} />
                                                    ) : (
                                                        <AlertTriangle size={20} />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <h4 className="text-base font-bold">
                                                            {isSystem
                                                                ? t("systemUpdate")
                                                                : alert.reported_brand_name ||
                                                                  alert.brand_name ||
                                                                  alert.brand}
                                                        </h4>
                                                        <span className="shrink-0 text-[11px] font-bold text-(--color-text-muted)">
                                                            {formatRelativeTime(
                                                                alert.reported_at ||
                                                                    alert.created_at ||
                                                                    null
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-sm text-(--color-text-secondary)">
                                                        {alert.alert_type
                                                            ? t("alertType", {
                                                                  type: alert.alert_type,
                                                              })
                                                            : alert.composition || t("noDetails")}
                                                    </p>

                                                    {/* Key-Value Metadata Grid (collapsible detail pane) */}
                                                    <AnimatePresence initial={false}>
                                                        {isCollapsible && isExpanded && (
                                                            <motion.div
                                                                key="details"
                                                                id={`alert-details-${alert.id}`}
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{
                                                                    height: "auto",
                                                                    opacity: 1,
                                                                }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{
                                                                    duration: 0.25,
                                                                    ease: "easeInOut",
                                                                }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-(--color-text-muted)">
                                                                    <div
                                                                        className="flex items-center gap-1.5"
                                                                        onClick={(e) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        <span>
                                                                            {t("batchLabel")}{" "}
                                                                            <span className="font-extrabold text-(--color-text-primary)">
                                                                                {alert.batch_number}
                                                                            </span>
                                                                        </span>
                                                                        <CopyButton
                                                                            text={
                                                                                alert.batch_number ||
                                                                                ""
                                                                            }
                                                                        />
                                                                    </div>
                                                                    {alert.manufacturer && (
                                                                        <>
                                                                            <span className="text-(--color-border-muted)">
                                                                                •
                                                                            </span>
                                                                            <div className="flex items-center gap-1">
                                                                                <Building2
                                                                                    size={12}
                                                                                    className="opacity-80"
                                                                                />
                                                                                <span>
                                                                                    {t(
                                                                                        "manufacturerLabel"
                                                                                    )}{" "}
                                                                                    <span className="inline-block max-w-[150px] truncate align-bottom font-extrabold text-(--color-text-primary) sm:max-w-[250px]">
                                                                                        {
                                                                                            alert.manufacturer
                                                                                        }
                                                                                    </span>
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {(alert.state ||
                                                                        alert.district) && (
                                                                        <>
                                                                            <span className="text-(--color-border-muted)">
                                                                                •
                                                                            </span>
                                                                            <div className="flex items-center gap-1">
                                                                                <MapPin
                                                                                    size={12}
                                                                                    className="opacity-80"
                                                                                />
                                                                                <span>
                                                                                    {t(
                                                                                        "regionLabel"
                                                                                    )}{" "}
                                                                                    <span className="font-extrabold text-(--color-text-primary)">
                                                                                        {[
                                                                                            alert.state,
                                                                                            alert.district,
                                                                                        ]
                                                                                            .filter(
                                                                                                Boolean
                                                                                            )
                                                                                            .join(
                                                                                                ", "
                                                                                            )}
                                                                                    </span>
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {isCollapsible && (
                                                    <div className="group-hover:text-slate-650 shrink-0 text-slate-400 transition-colors">
                                                        <ChevronDown
                                                            size={18}
                                                            className={`transition-transform duration-300 ${
                                                                isExpanded ? "rotate-180" : ""
                                                            }`}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}

                {/* Infinite Scroll Load More Trigger */}
                {!loading && allAlerts.length > 0 && (
                    <div className="mt-8">
                        {loadingMore && (
                            <div className="flex justify-center py-4">
                                <div className="flex items-center gap-3 text-sm font-semibold text-(--color-text-muted)">
                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></span>
                                    Loading more alerts...
                                </div>
                            </div>
                        )}
                        {hasMore && !loadingMore && (
                            <div
                                ref={inViewRef}
                                className="w-full rounded-2xl border border-dashed border-(--color-border-muted) bg-(--color-surface-muted)/30 py-4 text-center text-sm font-semibold text-(--color-text-muted) transition-all hover:bg-(--color-surface-muted)"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                                    Scroll for more alerts
                                </span>
                            </div>
                        )}

                        {!hasMore && totalCount > 0 && (
                            <div className="text-center text-sm font-semibold text-(--color-text-muted)">
                                ✅ You've seen all {totalCount} safety alerts
                            </div>
                        )}
                    </div>
                )}
            </div>
            <BackToTopButton />
        </>
    );
}
