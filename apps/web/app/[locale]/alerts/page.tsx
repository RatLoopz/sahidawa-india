"use client";
import React, { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import {
    Activity,
    Filter,
    Search,
    Globe,
    AlertCircle,
    MapPin,
    ShieldAlert,
    BellOff,
    Download,
} from "lucide-react";
import { useTranslations } from "next-intl";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveMessage } from "@/components/ui/LiveMessage";
import BackToTopButton from "@/app/[locale]/components/BackToTopButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useInView } from "react-intersection-observer";
import { useAlerts } from "@/hooks/useAlerts";
import { AlertItem } from "@/components/alerts/AlertItem";

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

    // Filters
    const [brandSearch, setBrandSearch] = useState("");
    const [regionSearch, setRegionSearch] = useState("");

    // Debounced search values - prevents API calls on every keystroke
    const debouncedBrandSearch = useDebounce(brandSearch, 300);
    const debouncedRegionSearch = useDebounce(regionSearch, 300);

    const {
        allAlerts,
        loading,
        loadingMore,
        error,
        fetchNextPage,
        hasNextPage,
        totalCount,
        snoozeAlert,
        refetch,
    } = useAlerts({ debouncedBrandSearch, debouncedRegionSearch });

    // Accordion active expanded state
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

    // Intersection Observer for infinite scroll
    const { ref: inViewRef } = useInView({
        triggerOnce: false,
        threshold: 0.1,
        rootMargin: "0px 0px 100px 0px",
        onChange: (inView) => {
            if (inView && !loadingMore && hasNextPage && !loading) {
                fetchNextPage();
            }
        },
    });

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

        const writeToClipboard = () => {
            navigator.clipboard
                .writeText(shareText)
                .then(() => {
                    toast.success("Alert details copied to clipboard!");
                })
                .catch((err) => {
                    console.error("Clipboard copy failed:", err);
                    toast.error("Failed to copy alert details to clipboard.");
                });
        };

        if (navigator.share) {
            navigator.share({ title: `Safety Alert: ${brand}`, text: shareText }).catch(() => {
                writeToClipboard();
            });
        } else {
            writeToClipboard();
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
        URL.revokeObjectURL(url);
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
                    <EmptyState
                        icon={<BellOff className="h-8 w-8" />}
                        title={
                            error
                                ? "We couldn't load alerts right now"
                                : brandSearch.trim() || regionSearch.trim()
                                  ? "No alerts match your filters"
                                  : "No active health alerts"
                        }
                        description={
                            error
                                ? "The safety registry is temporarily unavailable. Try refreshing to sync the latest reports."
                                : brandSearch.trim() || regionSearch.trim()
                                  ? "Try clearing one of your filters or refreshing the feed to see the latest safety updates."
                                  : "The safety registry is clear right now. No active drug recalls, counterfeit warnings, or banned formulations match your search."
                        }
                        actionLabel="Refresh alerts"
                        onAction={() => refetch()}
                        className="my-6 border border-(--color-border-muted) bg-(--color-surface-page) px-6 py-16 shadow-xs"
                    />
                ) : (
                    /* --- Alerts List View --- */
                    <div role="feed" className="space-y-4">
                        <motion.div layout className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {allAlerts.map((alert) => (
                                    <AlertItem
                                        key={alert.id}
                                        alert={alert}
                                        expandedAlertId={expandedAlertId}
                                        toggleExpand={toggleExpand}
                                        snoozeAlert={snoozeAlert}
                                        t={t}
                                    />
                                ))}
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
                        {hasNextPage && !loadingMore && (
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

                        {!hasNextPage && totalCount > 0 && (
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
