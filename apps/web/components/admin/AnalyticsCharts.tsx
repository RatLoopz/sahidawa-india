"use client";

import {
    BarChart,
    Bar,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    LineChart,
    Line,
} from "recharts";

type TrendPoint = {
    month: string;
    medicines: number;
    reports: number;
};

type DistributionPoint = {
    name: string;
    value: number;
};

type AnalyticsChartsProps = {
    monthlyTrend: TrendPoint[];
    reportStatusDist: DistributionPoint[];
    topDistricts: DistributionPoint[];
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) return monthKey;

    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatTopDistrictLabel(name: string): string {
    return name.length > 16 ? `${name.slice(0, 16)}…` : name;
}

export default function AnalyticsCharts({
    monthlyTrend,
    reportStatusDist,
    topDistricts,
}: AnalyticsChartsProps) {
    const hasTrend = monthlyTrend.length > 0;
    const hasStatus = reportStatusDist.length > 0;
    const hasDistricts = topDistricts.length > 0;

    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                    <h2 className="font-semibold text-slate-800">Monthly Activity</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Medicines and reports created per month.
                    </p>
                </div>
                <div className="h-80 px-2 py-4">
                    {hasTrend ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={monthlyTrend}
                                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="month"
                                    tickFormatter={formatMonthLabel}
                                    stroke="#64748b"
                                />
                                <YAxis stroke="#64748b" />
                                <Tooltip
                                    labelFormatter={(label) => formatMonthLabel(String(label))}
                                    contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="medicines"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    name="Medicines"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="reports"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    name="Reports"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            No monthly activity yet.
                        </div>
                    )}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                    <h2 className="font-semibold text-slate-800">Report Status</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Current report status distribution.
                    </p>
                </div>
                <div className="h-80 px-2 py-4">
                    {hasStatus ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                />
                                <Legend />
                                <Pie
                                    data={reportStatusDist}
                                    dataKey="value"
                                    nameKey="name"
                                    outerRadius={110}
                                    innerRadius={65}
                                    paddingAngle={3}
                                >
                                    {reportStatusDist.map((entry, index) => (
                                        <Cell
                                            key={`${entry.name}-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            No report status data yet.
                        </div>
                    )}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
                <div className="border-b border-slate-100 px-6 py-4">
                    <h2 className="font-semibold text-slate-800">Top Districts</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Districts with the highest report volume.
                    </p>
                </div>
                <div className="h-80 px-2 py-4">
                    {hasDistricts ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={topDistricts}
                                margin={{ top: 8, right: 16, left: 0, bottom: 16 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#64748b"
                                    interval={0}
                                    tickFormatter={formatTopDistrictLabel}
                                    angle={-20}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis stroke="#64748b" />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]} name="Reports">
                                    {topDistricts.map((entry, index) => (
                                        <Cell
                                            key={`${entry.name}-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            No district data yet.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
