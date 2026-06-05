"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";
import {
    TrendingUp, Users, Pill, AlertTriangle, CheckCircle, Activity,
    Calendar, MapPin, ArrowUp, ArrowDown, Loader2, BarChart3,
    PieChart as PieChartIcon, Clock, FileText, RefreshCw, Search,
    ShieldAlert, Eye, MessageCircle, Star,
} from "lucide-react";

const COLORS = {
    emerald: "#10b981",
    blue: "#3b82f6",
    amber: "#f59e0b",
    red: "#ef4444",
    purple: "#8b5cf6",
    teal: "#14b8a6",
    slate: "#64748b",
    rose: "#f43f5e",
    cyan: "#06b6d4",
    indigo: "#6366f1",
};

const STATUS_COLORS: Record<string, string> = {
    pending: COLORS.amber,
    verified_fake: COLORS.red,
    false_alarm: COLORS.emerald,
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
}

function getToken(): string {
    if (globalThis.window === undefined) return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

export default function AnalyticsDashboard() {
    const t = useTranslations("AdminAnalytics");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");

    const [medicineCount, setMedicineCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [resolvedCount, setResolvedCount] = useState(0);
    const [districtCount, setDistrictCount] = useState(0);
    const [reports, setReports] = useState<any[]>([]);
    const [medicines, setMedicines] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    const daysMap = { "7d": 7, "30d": 30, "90d": 90, all: 9999 };
    const filterDays = daysMap[timeframe];

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [medicinesRes, reportsRes, auditRes] = await Promise.all([
                supabase.from("medicines").select("*").order("created_at", { ascending: false }),
                supabase.from("reports").select("*").order("created_at", { ascending: false }),
                supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
            ]);

            if (medicinesRes.error) console.error("Medicines fetch error:", medicinesRes.error);
            if (reportsRes.error) console.error("Reports fetch error:", reportsRes.error);
            if (auditRes.error) console.error("Audit logs fetch error:", auditRes.error);

            const allMedicines = medicinesRes.data ?? [];
            const allReports = reportsRes.data ?? [];
            const allAudits = auditRes.data ?? [];

            setMedicines(allMedicines);
            setReports(allReports);
            setAuditLogs(allAudits);

            setMedicineCount(allMedicines.length);
            setReportCount(allReports.length);
            setResolvedCount(allReports.filter((r: any) => r.status === "verified_fake" || r.status === "false_alarm").length);
            setDistrictCount(new Set(allReports.map((r: any) => r.district).filter(Boolean)).size);
        } catch (err) {
            console.error("Failed to fetch analytics data:", err);
            setError("Failed to load analytics data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredReports = useMemo(() => {
        if (timeframe === "all") return reports;
        const cutoff = new Date(Date.now() - filterDays * 86400000);
        return reports.filter((r) => new Date(r.created_at) >= cutoff);
    }, [reports, timeframe, filterDays]);

    const monthlyTrend = useMemo(() => {
        const allItems = [...medicines, ...reports].filter(Boolean);
        const monthMap: Record<string, { medicines: number; reports: number }> = {};

        allItems.forEach((item) => {
            if (!item?.created_at) return;
            const d = new Date(item.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!monthMap[key]) monthMap[key] = { medicines: 0, reports: 0 };
            if (medicines.includes(item)) monthMap[key].medicines++;
            if (reports.includes(item)) monthMap[key].reports++;
        });

        return Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([month, data]) => ({ month, ...data }));
    }, [medicines, reports]);

    const reportStatusDist = useMemo(() => {
        const counts: Record<string, number> = { pending: 0, verified_fake: 0, false_alarm: 0 };
        filteredReports.forEach((r) => {
            if (r.status in counts) counts[r.status]++;
            else counts.pending++;
        });
        return Object.entries(counts)
            .filter(([_, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
    }, [filteredReports]);

    const topDistricts = useMemo(() => {
        const counts: Record<string, number> = {};
        reports.forEach((r) => {
            if (r.district) counts[r.district] = (counts[r.district] ?? 0) + 1;
        });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }));
    }, [reports]);

    const recentActivity = useMemo(() => {
        return [...reports, ...medicines, ...auditLogs]
            .filter(Boolean)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20);
    }, [reports, medicines, auditLogs]);

    const weeklyGrowth = useMemo(() => {
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;
        const twoWeeksAgo = now - 14 * 86400000;

        const thisWeekReports = reports.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;
        const lastWeekReports = reports.filter(
            (r) => new Date(r.created_at).getTime() >= twoWeeksAgo && new Date(r.created_at).getTime() < weekAgo
        ).length;

        const thisWeekMeds = medicines.filter((m) => new Date(m.created_at).getTime() >= weekAgo).length;
        const lastWeekMeds = medicines.filter(
            (m) => new Date(m.created_at).getTime() >= twoWeeksAgo && new Date(m.created_at).getTime() < weekAgo
        ).length;

        return {
            reportGrowth: lastWeekReports === 0 ? 100 : Math.round(((thisWeekReports - lastWeekReports) / lastWeekReports) * 100),
            medicineGrowth: lastWeekMeds === 0 ? 100 : Math.round(((thisWeekMeds - lastWeekMeds) / lastWeekMeds) * 100),
            thisWeekReports,
            lastWeekReports,
            thisWeekMeds,
            lastWeekMeds,
        };
    }, [reports, medicines]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    <p className="text-sm font-medium">Loading analytics...</p>
                </div>
            </div>
        );
    }

    const reportGrowthIcon = weeklyGrowth.reportGrowth >= 0 ? ArrowUp : ArrowDown;
    const reportGrowthColor = weeklyGrowth.reportGrowth >= 0 ? "text-red-500" : "text-emerald-500";
    const medGrowthIcon = weeklyGrowth.medicineGrowth >= 0 ? ArrowUp : ArrowDown;
    const medGrowthColor = weeklyGrowth.medicineGrowth >= 0 ? "text-emerald-500" : "text-red-500";

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 px-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">S</div>
                    <span className="font-bold text-slate-800">SahiDawa <span className="text-emerald-600">Analytics</span></span>
                </div>
                <nav className="flex flex-1 flex-col gap-0.5">
                    <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <BarChart3 className="h-4 w-4 text-slate-400" />
                        Dashboard
                    </Link>
                    <div className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-600">
                        <Activity className="h-4 w-4" />
                        Analytics
                    </div>
                </nav>
                <p className="px-1 text-xs text-slate-400">SahiDawa Admin v1.0</p>
            </aside>

            <main className="flex min-h-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Impact Analytics Dashboard</h1>
                        <p className="text-xs text-slate-400">Community engagement metrics and growth trends</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                            {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                                        timeframe === tf
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    {tf === "all" ? "All" : tf}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={fetchData}
                            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                            <ShieldAlert className="mr-2 inline h-4 w-4" />
                            {error}
                            <button onClick={fetchData} className="ml-2 underline">Retry</button>
                        </div>
                    )}

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            label="Total Medicines"
                            value={formatNumber(medicineCount)}
                            icon={Pill}
                            color="text-emerald-500"
                            bg="bg-emerald-50"
                            trend={`${medGrowthIcon === ArrowUp ? "+" : ""}${weeklyGrowth.medicineGrowth}% this week`}
                            trendColor={medGrowthColor}
                            TrendIcon={medGrowthIcon}
                        />
                        <MetricCard
                            label="Total Reports"
                            value={formatNumber(reportCount)}
                            icon={AlertTriangle}
                            color="text-amber-500"
                            bg="bg-amber-50"
                            trend={`${reportGrowthIcon === ArrowUp ? "+" : ""}${weeklyGrowth.reportGrowth}% this week`}
                            trendColor={reportGrowthColor}
                            TrendIcon={reportGrowthIcon}
                        />
                        <MetricCard
                            label="Resolved"
                            value={formatNumber(resolvedCount)}
                            icon={CheckCircle}
                            color="text-emerald-500"
                            bg="bg-green-50"
                            trend={`${reportCount > 0 ? Math.round((resolvedCount / reportCount) * 100) : 0}% resolution rate`}
                            trendColor="text-emerald-500"
                        />
                        <MetricCard
                            label="Districts Covered"
                            value={formatNumber(districtCount)}
                            icon={MapPin}
                            color="text-purple-500"
                            bg="bg-purple-50"
                            trend="Geographic reach"
                            trendColor="text-purple-500"
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Monthly Growth Trend */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                <h2 className="font-semibold text-slate-800">Monthly Growth Trend</h2>
                            </div>
                            <div className="p-6">
                                {monthlyTrend.length === 0 ? (
                                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                                        <FileText className="mr-2 h-5 w-5" />
                                        No data available for chart
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={monthlyTrend}>
                                            <defs>
                                                <linearGradient id="medGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="repGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                                            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: "12px",
                                                    border: "1px solid #e2e8f0",
                                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="medicines"
                                                stroke={COLORS.emerald}
                                                fill="url(#medGradient)"
                                                strokeWidth={2}
                                                name="Medicines"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="reports"
                                                stroke={COLORS.amber}
                                                fill="url(#repGradient)"
                                                strokeWidth={2}
                                                name="Reports"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Report Status Distribution */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                                <PieChartIcon className="h-4 w-4 text-emerald-500" />
                                <h2 className="font-semibold text-slate-800">Report Status Distribution</h2>
                            </div>
                            <div className="p-6">
                                {reportStatusDist.length === 0 ? (
                                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                                        <FileText className="mr-2 h-5 w-5" />
                                        No reports to display
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie
                                                data={reportStatusDist}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={4}
                                                dataKey="value"
                                                nameKey="name"
                                            >
                                                {reportStatusDist.map((entry) => (
                                                    <Cell
                                                        key={entry.name}
                                                        fill={STATUS_COLORS[entry.name] || COLORS.slate}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend
                                                formatter={(value: string) => {
                                                    const labels: Record<string, string> = {
                                                        pending: "Pending Review",
                                                        verified_fake: "Verified Fake",
                                                        false_alarm: "False Alarm",
                                                    };
                                                    return labels[value] ?? value;
                                                }}
                                                wrapperStyle={{ fontSize: "12px" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Second Row */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Top Districts */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                                <MapPin className="h-4 w-4 text-emerald-500" />
                                <h2 className="font-semibold text-slate-800">Top Districts by Reports</h2>
                            </div>
                            <div className="p-6">
                                {topDistricts.length === 0 ? (
                                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                                        <MapPin className="mr-2 h-5 w-5" />
                                        No district data available
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={topDistricts} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                tick={{ fontSize: 11, fill: "#64748b" }}
                                                width={120}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: "12px",
                                                    border: "1px solid #e2e8f0",
                                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                                }}
                                            />
                                            <Bar dataKey="value" fill={COLORS.emerald} radius={[0, 6, 6, 0]} name="Reports" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                <h2 className="font-semibold text-slate-800">Recent Activity</h2>
                            </div>
                            <div className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">
                                {recentActivity.length === 0 ? (
                                    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
                                        <Clock className="mr-2 h-5 w-5" />
                                        No recent activity
                                    </div>
                                ) : (
                                    recentActivity.slice(0, 10).map((item: any, idx) => {
                                        const isReport = item.status !== undefined;
                                        const isMedicine = item.brand_name !== undefined && item.generic_name !== undefined;
                                        const isLog = item.action !== undefined;

                                        let icon = <FileText className="h-4 w-4" />;
                                        let iconBg = "bg-slate-100 text-slate-500";
                                        let label = "";

                                        if (isLog) {
                                            icon = item.action.includes("VERIFIED_FAKE")
                                                ? <AlertTriangle className="h-4 w-4" />
                                                : item.action.includes("FALSE_ALARM")
                                                    ? <CheckCircle className="h-4 w-4" />
                                                    : <FileText className="h-4 w-4" />;
                                            iconBg = item.action.includes("VERIFIED_FAKE")
                                                ? "bg-red-50 text-red-500"
                                                : item.action.includes("FALSE_ALARM")
                                                    ? "bg-green-50 text-green-500"
                                                    : "bg-blue-50 text-blue-500";
                                            label = item.details || item.action;
                                        } else if (isReport) {
                                            icon = <AlertTriangle className="h-4 w-4" />;
                                            iconBg = "bg-amber-50 text-amber-500";
                                            label = `Report: ${item.reported_brand_name || "Unknown"} - ${item.status || "pending"}`;
                                        } else if (isMedicine) {
                                            icon = <Pill className="h-4 w-4" />;
                                            iconBg = "bg-emerald-50 text-emerald-500";
                                            label = `Medicine: ${item.brand_name} (${item.generic_name})`;
                                        }

                                        return (
                                            <div
                                                key={item.id ?? idx}
                                                className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-slate-50/60"
                                            >
                                                <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${iconBg}`}>
                                                    {icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-slate-800">
                                                        {label}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-xs text-slate-400">
                                                    {timeAgo(item.created_at)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Footer */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 font-semibold text-slate-800">Platform Overview</h3>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <OverviewStat label="Avg Reports/Day" value={reportCount > 0 ? (reportCount / 30).toFixed(1) : "0"} />
                            <OverviewStat label="Resolution Rate" value={`${reportCount > 0 ? Math.round((resolvedCount / reportCount) * 100) : 0}%`} />
                            <OverviewStat label="This Week Reports" value={String(weeklyGrowth.thisWeekReports)} />
                            <OverviewStat label="This Week Medicines" value={String(weeklyGrowth.thisWeekMeds)} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function MetricCard({
    label, value, icon: Icon, color, bg, trend, trendColor, TrendIcon,
}: {
    label: string;
    value: string;
    icon: any;
    color: string;
    bg: string;
    trend?: string;
    trendColor?: string;
    TrendIcon?: any;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className={`inline-flex rounded-xl p-2.5 ${bg} ${color} mb-3`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="mb-1 text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {trend && (
                <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trendColor ?? "text-slate-400"}`}>
                    {TrendIcon && <TrendIcon className="h-3 w-3" />}
                    {trend}
                </p>
            )}
        </div>
    );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
        </div>
    );
}
