import React from "react";
import { Activity, ArrowLeft, Filter, AlertTriangle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Globe } from "lucide-react";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { LiveMessage } from "@/components/ui/LiveMessage";

export const revalidate = 0;

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

export default async function FullAlertsLogPage() {
    // Fetch ALL rows from medicines that fit alert criteria
    const { data: allAlerts, error } = await supabase
        .from("medicines")
        .select("*")
        .or(
            "is_counterfeit_alert.eq.true,cdsco_approval_status.eq.recalled,cdsco_approval_status.eq.banned, brand_name.eq.SYSTEM_UPDATE"
        )
        .order("created_at", { ascending: false });

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 text-(--color-text-primary)">
            <div className="mb-6 flex flex-col items-start gap-4">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
                >
                    <ArrowLeft size={16} />
                    Back to Home Page
                </Link>

                <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 duration-700">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    Live Alerts
                </div>
            </div>

            <div className="mb-8 flex flex-col justify-between gap-4 border-b border-(--color-border-muted) pb-6 md:flex-row md:items-center">
                <div>
                    <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-(--color-text-primary)">
                        <Activity className="text-red-500" size={28} />
                        Live CDSCO Alerts
                    </h1>
                    <p className="mt-1 font-medium text-(--color-text-secondary)">
                        Complete historical safety logging stream directly mapped to the master
                        CDSCO registry.
                    </p>
                </div>
                <span className="hidden rounded-full bg-red-100 dark:bg-red-950/30 px-2.5 py-1 text-xs font-bold tracking-wider text-red-600 dark:text-red-400 uppercase sm:block">
                    India Region
                </span>
                <div className="inline-flex items-center gap-2 self-start rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) px-4 py-2 text-sm font-bold text-(--color-text-primary) shadow-sm md:self-auto">
                    <Filter size={16} />
                    Total Count: {allAlerts?.length || 0}
                </div>
            </div>

            {error && (
                <LiveMessage
                    tone="critical"
                    className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 text-sm font-medium text-red-800 dark:text-red-400"
                >
                    Database synchronization error encountered while fetching active logs.
                </LiveMessage>
            )}

            <RecallPushSubscriber />

            <div className="space-y-4">
                {allAlerts && allAlerts.length > 0 ? (
                    allAlerts.map((alert) => {
                        const isSystem = alert.brand_name === "SYSTEM_UPDATE";
                        const isCritical =
                            alert.cdsco_approval_status === "banned" || alert.is_counterfeit_alert;

                        return (
                            <div
                                key={alert.id}
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
                                            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30"
                                            : isCritical
                                              ? "bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30"
                                              : "bg-orange-50 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30"
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
                                                {isSystem ? "System Update" : alert.brand_name}
                                            </h4>
                                            {!isSystem && (
                                                <span
                                                    className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                                        isCritical
                                                            ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-450"
                                                            : "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-450"
                                                    }`}
                                                >
                                                    {alert.cdsco_approval_status}
                                                </span>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-[11px] font-medium text-(--color-text-muted)">
                                            {formatRelativeTime(alert.created_at)}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm leading-snug font-medium text-(--color-text-secondary)">
                                        {alert.composition}
                                    </p>

                                    {/* Render metadata bottom line layout only if it's not a system update card */}
                                    {!isSystem && (
                                        <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-(--color-text-muted)">
                                            <span>
                                                Batch:{" "}
                                                <span className="font-bold text-(--color-text-primary)">
                                                    {alert.batch_number}
                                                </span>
                                            </span>
                                            <span>•</span>
                                            <span>
                                                Manufacturer:{" "}
                                                <span className="font-bold text-(--color-text-primary)">
                                                    {alert.manufacturer}
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) py-16 text-center font-medium text-(--color-text-muted)">
                        No health alerts currently flagged inside the registry database.
                    </div>
                )}
            </div>
        </div>
    );
}
