"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { FileText, MapPin } from "lucide-react";
import { PieChart as PieChartIcon } from "lucide-react";

const COLORS = {
    emerald: "#10b981",
    amber: "#f59e0b",
    red: "#ef4444",
    blue: "#3b82f6",
    slate: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
    pending: COLORS.amber,
    verified_fake: COLORS.red,
    false_alarm: COLORS.emerald,
};

interface MonthlyTrendEntry {
    month: string;
    medicines: number;
    reports: number;
}

interface ReportStatusEntry {
    name: string;
    value: number;
}

interface DistrictEntry {
    name: string;
    value: number;
}

interface AnalyticsChartsProps {
    monthlyTrend: MonthlyTrendEntry[];
    reportStatusDist: ReportStatusEntry[];
    topDistricts: DistrictEntry[];
}

export default function AnalyticsCharts({
    monthlyTrend,
    reportStatusDist,
    topDistricts,
}: AnalyticsChartsProps) {
    return (
        <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Monthly Growth Trend */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
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
                                        <linearGradient
                                            id="medGradient"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="5%"
                                                stopColor={COLORS.emerald}
                                                stopOpacity={0.3}
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor={COLORS.emerald}
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                        <linearGradient
                                            id="repGradient"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="5%"
                                                stopColor={COLORS.amber}
                                                stopOpacity={0.3}
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor={COLORS.amber}
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: "#64748b" }}
                                    />
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

            {/* Top Districts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                                    <Bar
                                        dataKey="value"
                                        fill={COLORS.emerald}
                                        radius={[0, 6, 6, 0]}
                                        name="Reports"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
