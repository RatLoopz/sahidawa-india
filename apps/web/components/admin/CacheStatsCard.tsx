"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ADMIN_API_BASE } from "@/lib/adminApi";

function getToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    tierBreakdown: {
        hot: number;
        warm: number;
        cold: number;
    };
    topDrugs: {
        name: string;
        count: number;
    }[];
}

export default function CacheStatsCard() {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            const token = getToken();

            const res = await fetch(`${ADMIN_API_BASE}/cache/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.status === 401 || res.status === 403) {
                setError("Unauthorized admin access");
                return;
            }

            const json = await res.json();

            if (json.success) {
                setStats(json.data);
            } else {
                setError("Failed to load stats");
            }
        } catch {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();

        const interval = setInterval(fetchStats, 30000);

        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="animate-pulse rounded-xl border border-gray-100 bg-[#f9fafb] p-6">
                <div className="mb-4 h-4 w-40 rounded bg-[#e5e7eb]" />
                <div className="h-32 rounded bg-[#e5e7eb]" />
            </div>
        );
    }

    if (error) {
        return <div className="rounded-xl border p-6 text-red-500">⚠️ {error}</div>;
    }

    if (!stats) {
        return null;
    }

    const tierData = [
        { name: "Hot (24h)", value: stats.tierBreakdown.hot },
        { name: "Warm (6h)", value: stats.tierBreakdown.warm },
        { name: "Cold (1h)", value: stats.tierBreakdown.cold },
    ];

    return (
        <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">🗄️ Cache Performance</h2>
                <span className="text-xs text-gray-400">Refreshes every 30s</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-green-50 p-4">
                    <p className="text-2xl font-bold text-green-600">{stats.hitRate}%</p>
                    <p className="mt-1 text-xs text-gray-500">Hit Rate</p>
                </div>

                <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-2xl font-bold text-blue-600">
                        {stats.hits.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Cache Hits</p>
                </div>

                <div className="rounded-lg bg-red-50 p-4">
                    <p className="text-2xl font-bold text-red-500">
                        {stats.misses.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Cache Misses</p>
                </div>
            </div>

            <div>
                <p className="mb-2 text-sm font-medium text-gray-600">Hits by Cache Tier</p>

                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={tierData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div>
                <p className="mb-2 text-sm font-medium text-gray-600">Top 10 Cached Drugs</p>

                <div className="space-y-1">
                    {stats.topDrugs.map((drug, i) => (
                        <div
                            key={drug.name}
                            className="flex justify-between border-b py-1 text-sm last:border-0"
                        >
                            <span className="text-gray-700">
                                {i + 1}. {drug.name}
                            </span>

                            <span className="font-mono text-gray-500">{drug.count}</span>
                        </div>
                    ))}

                    {stats.topDrugs.length === 0 && (
                        <p className="text-xs text-gray-400">No data yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
