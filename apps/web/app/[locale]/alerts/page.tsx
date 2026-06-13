"use client";
import React, { useEffect, useState } from "react";
import {
    Activity,
    ArrowLeft,
    Filter,
    AlertTriangle,
    Search,
    Globe,
    AlertCircle,
    MapPin,
    Building2,
    ExternalLink,
    Share2,
    ChevronDown,
    CheckCircle2,
    ShieldAlert,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { CopyButton } from "@/components/ui/CopyButton";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { API_BASE } from "@/lib/api";
import BackToTopButton from "@/app/[locale]/components/BackToTopButton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

    // Accordion active expanded state
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

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
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchAlerts();
        }, 400);

        return () => clearTimeout(timer);
    }, [page, brandSearch, regionSearch]);

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

    const handleShareAlert = (e: React.MouseEvent, alert: any) => {
        e.stopPropagation();
        const brand =
            alert.reported_brand_name || alert.brand_name || alert.brand || "SYSTEM_UPDATE";
        const shareText =
            `⚠️ SahiDawa CDSCO Drug Safety Alert:\n\n` +
            `Brand: ${brand}\n` +
            `Batch: ${alert.batch_number || "N/A"}\n` +
            `Manufacturer: ${alert.manufacturer || "N/A"}\n` +
            `Status: ${alert.cdsco_approval_status || alert.alert_type || "Flagged"}\n` +
            `Reason: Alert of type ${alert.alert_type || "NSQ"}\n\n` +
            `Please check your medical supplies immediately. For details, check SahiDawa safety logs.`;

        if (navigator.share) {
            navigator
                .share({
                    title: `Safety Alert: ${brand}`,
                    text: shareText,
                })
                .catch(() => {
                    navigator.clipboard.writeText(shareText);
                    toast.success("Alert details copied to clipboard!");
                });
        } else {
            navigator.clipboard.writeText(shareText);
            toast.success("Alert details copied to clipboard!");
        }
    };

    return (
        <>
            <div
                id="main-content"
                className="mx-auto max-w-5xl px-4 py-8 text-(--color-text-primary)"
            >
                {/* Top Navigation Row */}
                <div className="mb-6 flex flex-col items-start gap-4">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-bold text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
                    >
                        <ArrowLeft size={16} />
                        {t("backHome")}
                    </Link>

                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-xs font-black text-emerald-700 duration-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
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
                    </div>
                </div>

                <RecallPushSubscriber />

                {/* Dashboard Stats Panel */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Stat Card 1: Total Alerts */}
                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
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
                        <p className="mt-2 text-[11px] font-semibold text-(--color-text-muted)">
                            Active CDSCO safety notifications
                        </p>
                    </div>

                    {/* Stat Card 2: Banned Drugs */}
                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
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
                            <span className="text-xs font-bold text-red-500">On Current Page</span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-(--color-text-muted)">
                            High-severity banned formulation counts
                        </p>
                    </div>

                    {/* Stat Card 3: Affected Regions */}
                    <div className="relative overflow-hidden rounded-3xl border border-(--color-border-muted) bg-linear-to-br from-(--color-surface-page) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
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
                            <span className="text-xs font-bold text-amber-500">
                                States Affected
                            </span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-(--color-text-muted)">
                            Unique regional origins detected
                        </p>
                    </div>
                </div>

                {/* Glassmorphic Filters Section */}
                <div className="mb-6 rounded-3xl border border-(--color-border-muted) bg-slate-50/40 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/30">
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
                                }}
                                className="block w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted)/40 p-3 pl-11 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner transition-all focus:border-emerald-500/80 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:outline-hidden dark:focus:bg-slate-900/50"
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
                                }}
                                className="block w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted)/40 p-3 pl-11 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner transition-all focus:border-emerald-500/80 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:outline-hidden dark:focus:bg-slate-900/50"
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

                {/* Alerts Feed */}
                <div role="feed" aria-busy={loading} className="space-y-4">
                    {loading ? (
                        <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) py-20 text-center font-bold text-(--color-text-muted) shadow-inner">
                            <span className="mr-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent align-middle"></span>
                            {t("loading")}
                        </div>
                    ) : allAlerts.length > 0 ? (
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

                                    return (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -15 }}
                                            transition={{ duration: 0.3 }}
                                            key={alert.id}
                                            onClick={() => toggleExpand(alert.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    toggleExpand(alert.id);
                                                }
                                            }}
                                            tabIndex={0}
                                            role="button"
                                            aria-expanded={expandedAlertId === alert.id}
                                            className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-(--color-surface-page) p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden ${
                                                expandedAlertId === alert.id
                                                    ? "border-emerald-500/30 ring-2 ring-emerald-500/5 dark:border-emerald-500/20"
                                                    : isSystem
                                                      ? "border-(--color-border-muted) hover:border-blue-500/35"
                                                      : isCritical
                                                        ? "border-(--color-border-muted) hover:border-red-500/35"
                                                        : "border-(--color-border-muted) hover:border-amber-500/35"
                                            }`}
                                        >
                                            {/* Left accent color strip */}
                                            <div
                                                className={`absolute top-0 bottom-0 left-0 w-1.5 transition-all duration-300 group-hover:w-2.5 ${
                                                    isSystem
                                                        ? "bg-blue-500"
                                                        : isCritical
                                                          ? "bg-red-500"
                                                          : "bg-amber-500"
                                                }`}
                                            ></div>

                                            <div className="flex items-start gap-4">
                                                {/* Icon Wrapper */}
                                                <div
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                                                        isSystem
                                                            ? "bg-blue-50 text-blue-500 group-hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400"
                                                            : isCritical
                                                              ? "bg-red-50 text-red-500 group-hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400"
                                                              : "bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                                                    }`}
                                                >
                                                    {isSystem ? (
                                                        <Globe size={20} strokeWidth={2.5} />
                                                    ) : isCritical ? (
                                                        <ShieldAlert size={20} strokeWidth={2.5} />
                                                    ) : (
                                                        <AlertTriangle
                                                            size={20}
                                                            strokeWidth={2.5}
                                                        />
                                                    )}
                                                </div>

                                                {/* Header Content */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                                            <h4 className="text-base leading-tight font-bold text-(--color-text-primary)">
                                                                {isSystem
                                                                    ? t("systemUpdate")
                                                                    : alert.reported_brand_name ||
                                                                      alert.brand_name ||
                                                                      alert.brand}
                                                            </h4>
                                                            {!isSystem && (
                                                                <span
                                                                    className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${
                                                                        isCritical
                                                                            ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                                                                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                                                                    }`}
                                                                >
                                                                    {alert.cdsco_approval_status ||
                                                                        alert.alert_type ||
                                                                        "NSQ"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="shrink-0 text-[11px] font-bold text-(--color-text-muted)">
                                                            {formatRelativeTime(
                                                                alert.reported_at ||
                                                                    alert.created_at
                                                            )}
                                                        </span>
                                                    </div>

                                                    <p className="mt-2 text-sm leading-relaxed font-semibold text-(--color-text-secondary)">
                                                        {alert.alert_type
                                                            ? t("alertType", {
                                                                  type: alert.alert_type,
                                                              })
                                                            : alert.composition || t("noDetails")}
                                                    </p>

                                                    {/* Key-Value Metadata Grid */}
                                                    {!isSystem && (
                                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-(--color-text-muted)">
                                                            <div
                                                                className="flex items-center gap-1.5"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <span>
                                                                    {t("batchLabel")}{" "}
                                                                    <span className="font-extrabold text-(--color-text-primary)">
                                                                        {alert.batch_number}
                                                                    </span>
                                                                </span>
                                                                <CopyButton
                                                                    text={alert.batch_number}
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
                                                                            {t("manufacturerLabel")}{" "}
                                                                            <span className="inline-block max-w-[150px] truncate align-bottom font-extrabold text-(--color-text-primary) sm:max-w-[250px]">
                                                                                {alert.manufacturer}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {(alert.state || alert.district) && (
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
                                                                            {t("regionLabel")}{" "}
                                                                            <span className="font-extrabold text-(--color-text-primary)">
                                                                                {[
                                                                                    alert.state,
                                                                                    alert.district,
                                                                                ]
                                                                                    .filter(Boolean)
                                                                                    .join(", ")}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="group-hover:text-slate-650 shrink-0 text-slate-400 transition-colors">
                                                    <ChevronDown
                                                        size={18}
                                                        className={`transition-transform duration-300 ${
                                                            expandedAlertId === alert.id
                                                                ? "rotate-180"
                                                                : ""
                                                        }`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Expandable Safety Advisory Drawer */}
                                            <AnimatePresence initial={false}>
                                                {expandedAlertId === alert.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{
                                                            duration: 0.25,
                                                            ease: "easeInOut",
                                                        }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-4 border-t border-(--color-border-muted) pt-4 pl-14">
                                                            {isSystem ? (
                                                                <div className="mb-2 text-xs font-semibold text-(--color-text-secondary)">
                                                                    This system-level update logs a
                                                                    standard check or configuration
                                                                    sync with the primary CDSCO
                                                                    registry. No action is required.
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {/* Compliance Advisory Checklist */}
                                                                    <div className="mb-4">
                                                                        <h5 className="mb-2.5 text-xs font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                                            Patient Safety Advisory
                                                                        </h5>
                                                                        <ul className="space-y-2">
                                                                            <li className="flex items-start gap-2.5 text-xs leading-relaxed font-semibold text-(--color-text-secondary)">
                                                                                <CheckCircle2
                                                                                    size={15}
                                                                                    className="mt-0.5 shrink-0 text-red-500"
                                                                                />
                                                                                <span>
                                                                                    Verify the batch
                                                                                    code{" "}
                                                                                    <code className="rounded bg-red-50 px-1 py-0.5 font-mono font-extrabold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                                                                        {
                                                                                            alert.batch_number
                                                                                        }
                                                                                    </code>{" "}
                                                                                    matches your
                                                                                    medicine
                                                                                    packaging.
                                                                                </span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2.5 text-xs leading-relaxed font-semibold text-(--color-text-secondary)">
                                                                                <CheckCircle2
                                                                                    size={15}
                                                                                    className="text-amber-550 mt-0.5 shrink-0"
                                                                                />
                                                                                <span>
                                                                                    Stop taking this
                                                                                    batch
                                                                                    immediately if
                                                                                    matched and
                                                                                    consult your
                                                                                    physician for
                                                                                    alternative
                                                                                    prescriptions.
                                                                                </span>
                                                                            </li>
                                                                            <li className="flex items-start gap-2.5 text-xs leading-relaxed font-semibold text-(--color-text-secondary)">
                                                                                <CheckCircle2
                                                                                    size={15}
                                                                                    className="text-emerald-550 mt-0.5 shrink-0"
                                                                                />
                                                                                <span>
                                                                                    Return unused
                                                                                    stocks to the
                                                                                    point of
                                                                                    purchase or
                                                                                    notify your
                                                                                    local drug
                                                                                    licensing
                                                                                    authority.
                                                                                </span>
                                                                            </li>
                                                                        </ul>
                                                                    </div>

                                                                    {/* Action Buttons */}
                                                                    <div className="flex flex-wrap items-center gap-3">
                                                                        <a
                                                                            href="https://ipc.gov.in/mandates/pvpi/adr-reporting-forms.html"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) =>
                                                                                e.stopPropagation()
                                                                            }
                                                                            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition-all hover:scale-[1.02] hover:bg-slate-800 active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-700"
                                                                        >
                                                                            <ExternalLink
                                                                                size={13}
                                                                            />
                                                                            Report Adverse Reaction
                                                                            (ADR)
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) =>
                                                                                handleShareAlert(
                                                                                    e,
                                                                                    alert
                                                                                )
                                                                            }
                                                                            className="inline-flex items-center gap-1.5 rounded-2xl border border-(--color-border-muted) bg-white px-5 py-2.5 text-xs font-bold text-(--color-text-primary) transition-all hover:scale-[1.02] hover:bg-slate-50 active:scale-95 dark:bg-slate-900 dark:hover:bg-slate-800"
                                                                        >
                                                                            <Share2 size={13} />
                                                                            Share Safety Details
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) py-20 text-center font-bold text-(--color-text-muted) shadow-inner">
                            {t("empty")}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="mt-8 flex items-center justify-center gap-4">
                    <button
                        disabled={page === 1}
                        onClick={() => {
                            setPage((p) => p - 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) px-5 py-2.5 text-sm font-extrabold text-(--color-text-primary) shadow-sm transition-all hover:bg-(--color-surface-muted) active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t("previous")}
                    </button>
                    <span className="text-xs font-bold text-(--color-text-muted)">
                        Page{" "}
                        <span className="font-extrabold text-(--color-text-primary)">{page}</span>{" "}
                        of{" "}
                        <span className="font-extrabold text-(--color-text-primary)">
                            {Math.max(1, Math.ceil(totalCount / 50))}
                        </span>
                    </span>
                    <button
                        disabled={page * 50 >= totalCount}
                        onClick={() => {
                            setPage((p) => p + 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) px-5 py-2.5 text-sm font-extrabold text-(--color-text-primary) shadow-sm transition-all hover:bg-(--color-surface-muted) active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t("next")}
                    </button>
                </div>
            </div>
            <BackToTopButton />
        </>
    );
}
