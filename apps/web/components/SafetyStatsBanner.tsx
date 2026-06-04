"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface StatConfig {
    type: string;
    label: string;
    icon: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
}

const STAT_CONFIG: StatConfig[] = [
    {
        type: "banned",
        label: "Banned",
        icon: "🚫",
        colorClass: "text-red-600 dark:text-red-400",
        bgClass: "bg-red-50 dark:bg-red-950/30",
        borderClass: "border-red-200 dark:border-red-900/50",
    },
    {
        type: "recalled",
        label: "Recalled",
        icon: "⚠️",
        colorClass: "text-amber-600 dark:text-amber-400",
        bgClass: "bg-amber-50 dark:bg-amber-950/30",
        borderClass: "border-amber-200 dark:border-amber-900/50",
    },
    {
        type: "counterfeit",
        label: "Counterfeit",
        icon: "🔴",
        colorClass: "text-purple-600 dark:text-purple-400",
        bgClass: "bg-purple-50 dark:bg-purple-950/30",
        borderClass: "border-purple-200 dark:border-purple-900/50",
    },
    {
        type: "nsq",
        label: "NSQ",
        icon: "📋",
        colorClass: "text-sky-700 dark:text-sky-400",
        bgClass: "bg-sky-50 dark:bg-sky-950/30",
        borderClass: "border-sky-200 dark:border-sky-900/50",
    },
];

function useCountUp(target: number, duration = 1200) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (target === 0) {
            setCount(0);
            return;
        }

        let startTimestamp: number | null = null;
        let animationFrameId: number;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // easeOutQuart easing function for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(easeProgress * target));

            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            } else {
                setCount(target);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);

        return () => {
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [target, duration]);

    return count;
}

function StatCard({ config, count }: { config: StatConfig; count: number }) {
    const displayed = useCountUp(count);
    return (
        <div
            className={`flex min-w-[130px] flex-1 basis-[140px] items-center gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-md dark:hover:shadow-black/40 ${config.bgClass} ${config.borderClass}`}
        >
            <span className="text-2xl">{config.icon}</span>
            <div>
                <div className={`text-[26px] leading-none font-extrabold ${config.colorClass}`}>
                    {displayed}
                </div>
                <div className="mt-0.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {config.label}
                </div>
            </div>
        </div>
    );
}

export default function SafetyStatsBanner() {
    const [banned, setBanned] = useState(0);
    const [recalled, setRecalled] = useState(0);
    const [counterfeit, setCounterfeit] = useState(0);
    const [nsq, setNsq] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAlerts() {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

            const { data, error } = await supabase
                .from("drug_alerts")
                .select("alert_type")
                .gte("created_at", startOfMonth)
                .lte("created_at", endOfMonth);

            if (!error && data) {
                let b = 0,
                    r = 0,
                    c = 0,
                    n = 0;
                data.forEach((alert) => {
                    const type = alert.alert_type?.toLowerCase();
                    if (type === "banned") b++;
                    else if (type === "recalled") r++;
                    else if (type === "counterfeit") c++;
                    else if (type === "nsq") n++;
                });
                setBanned(b);
                setRecalled(r);
                setCounterfeit(c);
                setNsq(n);
            }
            setLoading(false);
        }
        fetchAlerts();
    }, []);

    const now = new Date();
    const monthName = now.toLocaleString("default", { month: "long" });

    const cardData = [
        { ...STAT_CONFIG[0], count: banned },
        { ...STAT_CONFIG[1], count: recalled },
        { ...STAT_CONFIG[2], count: counterfeit },
        { ...STAT_CONFIG[3], count: nsq },
    ];

    return (
        <div className="my-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-700 uppercase dark:bg-emerald-950/50 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        Live
                    </span>
                    <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                        Medicine Safety Alerts
                    </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    📅 {monthName} {now.getFullYear()} · India
                </span>
            </div>

            {/* Cards */}
            {loading ? (
                <div className="text-sm text-slate-400 dark:text-slate-500">Loading alerts...</div>
            ) : (
                <div className="flex flex-wrap gap-3">
                    {cardData.map((card) => (
                        <StatCard key={card.type} config={card} count={card.count} />
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="mt-3.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <span>🛡️</span>
                <span>Data sourced from CDSCO official registry. Updated in real-time.</span>
            </div>
        </div>
    );
}
