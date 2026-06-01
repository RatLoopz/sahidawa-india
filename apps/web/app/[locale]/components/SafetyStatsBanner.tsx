"use client";

import React, { useEffect, useState, useRef } from "react";
import {
    Ban,
    RotateCcw,
    ShieldAlert,
    AlertCircle,
    TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
    bgColor: string;
    borderColor: string;
    darkBgColor: string;
    darkBorderColor: string;
}

function AnimatedCount({
    target,
    duration = 1200,
}: {
    target: number;
    duration?: number;
}) {
    const [count, setCount] = useState(0);
    const startTimeRef = useRef<number | null>(null);
    const frameRef = useRef<number>(0);

    useEffect(() => {
        if (target === 0) {
            setCount(0);
            return;
        }

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for satisfying deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            startTimeRef.current = null;
        };
    }, [target, duration]);

    return <>{count.toLocaleString()}</>;
}

function StatCard({
    icon,
    label,
    count,
    color,
    bgColor,
    borderColor,
    darkBgColor,
    darkBorderColor,
}: StatCardProps) {
    return (
        <div
            className={`group relative flex flex-col items-center gap-3 rounded-2xl border ${borderColor} ${bgColor} p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${darkBorderColor} ${darkBgColor}`}
        >
            {/* Live pulse indicator */}
            <span className="absolute top-3 right-3 flex h-2 w-2">
                <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75`}
                />
                <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${color}`}
                />
            </span>

            <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgColor} ${color} transition-transform duration-300 group-hover:scale-110 dark:${darkBgColor}`}
            >
                {icon}
            </div>

            <div>
                <p
                    className={`text-3xl font-black tracking-tight ${color} sm:text-4xl`}
                >
                    <AnimatedCount target={count} />
                </p>
                <p className="mt-1 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    {label}
                </p>
            </div>
        </div>
    );
}

export default function SafetyStatsBanner() {
    const t = useTranslations("Home");
    const [stats, setStats] = useState({
        banned: 0,
        recalled: 0,
        counterfeit: 0,
        nsq: 0,
    });
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState("");

    useEffect(() => {
        const now = new Date();
        const monthYear = now.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
        });
        setCurrentMonth(monthYear);

        async function fetchStats() {
            try {
                const startOfMonth = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                ).toISOString();

                // Fetch counts from medicines table for current month
                const [bannedRes, recalledRes, counterfeitRes, nsqRes] =
                    await Promise.all([
                        supabase
                            .from("medicines")
                            .select("id", {
                                count: "exact",
                                head: true,
                            })
                            .eq("cdsco_approval_status", "banned")
                            .gte("created_at", startOfMonth),

                        supabase
                            .from("medicines")
                            .select("id", {
                                count: "exact",
                                head: true,
                            })
                            .eq("cdsco_approval_status", "recalled")
                            .gte("created_at", startOfMonth),

                        supabase
                            .from("medicines")
                            .select("id", {
                                count: "exact",
                                head: true,
                            })
                            .eq("is_counterfeit_alert", true)
                            .gte("created_at", startOfMonth),

                        supabase
                            .from("drug_alerts")
                            .select("id", {
                                count: "exact",
                                head: true,
                            })
                            .eq("alert_type", "NSQ")
                            .gte("reported_at", startOfMonth),
                    ]);

                setStats({
                    banned: bannedRes.count ?? 0,
                    recalled: recalledRes.count ?? 0,
                    counterfeit: counterfeitRes.count ?? 0,
                    nsq: nsqRes.count ?? 0,
                });
            } catch (err) {
                console.error("Failed to fetch safety stats:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    if (loading) {
        return (
            <section className="mb-12">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="animate-pulse rounded-2xl border border-slate-200/50 bg-white/50 p-5 dark:border-slate-800/50 dark:bg-slate-900/50"
                        >
                            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
                            <div className="mt-3 mx-auto h-8 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                            <div className="mt-2 mx-auto h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    const totalAlerts =
        stats.banned + stats.recalled + stats.counterfeit + stats.nsq;

    return (
        <section className="mb-12">
            {/* Section header */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-amber-600 uppercase dark:border-amber-400/20 dark:text-amber-400">
                    <TrendingUp size={12} />
                    {t("stats_badge") || "This Month In India"}
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {t("stats_title") || "Medicine Safety Dashboard"}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {currentMonth} &middot;{" "}
                    {totalAlerts > 0
                        ? `${totalAlerts} ${t("stats_total_label") || "total alerts detected"}`
                        : t("stats_all_clear") || "All clear this month"}
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                    icon={<Ban size={24} strokeWidth={2.5} />}
                    label={t("stat_banned") || "Banned"}
                    count={stats.banned}
                    color="text-red-600 dark:text-red-400"
                    bgColor="bg-red-50"
                    borderColor="border-red-200/50"
                    darkBgColor="dark:bg-red-950/30"
                    darkBorderColor="dark:border-red-800/30"
                />
                <StatCard
                    icon={<RotateCcw size={24} strokeWidth={2.5} />}
                    label={t("stat_recalled") || "Recalled"}
                    count={stats.recalled}
                    color="text-orange-600 dark:text-orange-400"
                    bgColor="bg-orange-50"
                    borderColor="border-orange-200/50"
                    darkBgColor="dark:bg-orange-950/30"
                    darkBorderColor="dark:border-orange-800/30"
                />
                <StatCard
                    icon={<ShieldAlert size={24} strokeWidth={2.5} />}
                    label={t("stat_counterfeit") || "Counterfeit"}
                    count={stats.counterfeit}
                    color="text-purple-600 dark:text-purple-400"
                    bgColor="bg-purple-50"
                    borderColor="border-purple-200/50"
                    darkBgColor="dark:bg-purple-950/30"
                    darkBorderColor="dark:border-purple-800/30"
                />
                <StatCard
                    icon={<AlertCircle size={24} strokeWidth={2.5} />}
                    label={t("stat_nsq") || "NSQ"}
                    count={stats.nsq}
                    color="text-blue-600 dark:text-blue-400"
                    bgColor="bg-blue-50"
                    borderColor="border-blue-200/50"
                    darkBgColor="dark:bg-blue-950/30"
                    darkBorderColor="dark:border-blue-800/30"
                />
            </div>
        </section>
    );
}
