"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import Card from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";

interface BlockedIP {
    ip: string;
    count: number;
    lastBlocked: string;
}

interface MetricsData {
    blockedIps: BlockedIP[];

    totalRejections: number;

    otpMetrics: {
        totalHits: number;
        blocked: number;
    };

    windowSeconds: number;
    fetchedAt: string;
    isDemo?: boolean;
}

type LoadState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; data: MetricsData };

export default function RateLimitsPage() {
    const [state, setState] = useState<LoadState>({ kind: "loading" });

    const fetchMetrics = async () => {
        try {
            setState({ kind: "loading" });
            const response = await fetch("/api/admin/rate-limit-metrics");

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to fetch metrics");
            }

            const data: MetricsData = await response.json();
            setState({ kind: "ready", data });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            setState({ kind: "error", message });
        }
    };

    useEffect(() => {
        fetchMetrics();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-(--color-text-primary)">
                        Rate Limit Monitor
                    </h1>
                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                        Monitor rate limit rejections and blocked IPs
                    </p>
                </div>
                <button
                    onClick={fetchMetrics}
                    disabled={state.kind === "loading"}
                    className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) p-2 text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-50"
                    aria-label="Refresh metrics"
                >
                    <RefreshCw
                        size={20}
                        className={state.kind === "loading" ? "animate-spin" : ""}
                    />
                </button>
            </div>

            {/* Loading State */}
            {state.kind === "loading" && (
                <div className="space-y-4">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-96 rounded-lg" />
                </div>
            )}

            {/* Error State */}
            {state.kind === "error" && (
                <Card className="border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/10">
                    <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-600" />
                        <div>
                            <h3 className="font-semibold text-rose-900 dark:text-rose-100">
                                Error
                            </h3>
                            <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                                {state.message}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Metrics Summary */}
            {state.kind === "ready" && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        {/* Total Rejections Card */}
                        <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-(--color-text-secondary)">
                                        Total Rejections
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-(--color-text-primary)">
                                        {state.data.totalRejections}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-amber-500" />
                            </div>
                        </Card>

                        {/* Unique IPs Card */}
                        <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                            <div>
                                <p className="text-sm text-(--color-text-secondary)">Blocked IPs</p>
                                <p className="mt-2 text-3xl font-bold text-(--color-text-primary)">
                                    {state.data.blockedIps.length}
                                </p>
                            </div>
                        </Card>

                        {/* Time Window Card */}
                        <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                            <div>
                                <p className="text-sm text-(--color-text-secondary)">Time Window</p>
                                <p className="mt-2 text-3xl font-bold text-(--color-text-primary)">
                                    {state.data.windowSeconds}s
                                </p>
                            </div>
                        </Card>
                        <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                            <div>
                                <p className="text-sm text-(--color-text-secondary)">
                                    OTP Registration Blocks
                                </p>

                                <p className="mt-2 text-3xl font-bold text-(--color-text-primary)">
                                    {state.data.otpMetrics.blocked}
                                </p>

                                <p className="mt-1 text-xs text-(--color-text-secondary)">
                                    Total Hits: {state.data.otpMetrics.totalHits}
                                </p>
                            </div>
                        </Card>
                    </div>

                    {/* Blocked IPs Table */}
                    <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                        <div>
                            <h2 className="mb-4 text-lg font-semibold text-(--color-text-primary)">
                                Blocked IPs
                            </h2>

                            {state.data.blockedIps.length === 0 ? (
                                <p className="py-8 text-center text-(--color-text-secondary)">
                                    No blocked IPs in the current window
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-(--color-border-muted)">
                                                <th className="px-4 py-3 text-left font-semibold text-(--color-text-secondary)">
                                                    IP Address
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-(--color-text-secondary)">
                                                    Rejections
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-(--color-text-secondary)">
                                                    Last Blocked
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-(--color-text-secondary)">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {state.data.blockedIps.map((ip, idx) => {
                                                const isSuspicious = ip.count > 10;
                                                return (
                                                    <tr
                                                        key={idx}
                                                        className={`border-b border-(--color-border-muted) transition ${isSuspicious ? "bg-rose-50 dark:bg-rose-950/10" : ""}`}
                                                    >
                                                        <td className="px-4 py-3 font-mono text-(--color-text-primary)">
                                                            {ip.ip}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-(--color-text-primary)">
                                                            <span
                                                                className={`inline-block rounded-full px-3 py-1 font-semibold ${isSuspicious ? "bg-rose-200 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100" : "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"}`}
                                                            >
                                                                {ip.count}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-(--color-text-secondary)">
                                                            {formatTime(ip.lastBlocked)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {isSuspicious ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-100">
                                                                    <AlertTriangle size={12} />
                                                                    Suspicious
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                                                    Normal
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Footer Info */}
                    <div className="text-xs text-(--color-text-secondary)">
                        <p>Last refreshed: {formatTime(state.data.fetchedAt)}</p>
                        {state.data.isDemo && (
                            <p className="mt-1 text-amber-600 dark:text-amber-400">
                                ⚠️ Demo mode: Redis is not configured. Showing mock data.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
