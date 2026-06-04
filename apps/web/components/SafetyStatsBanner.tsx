"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Ban, RotateCcw, ShieldAlert, FileWarning, Calendar, ShieldCheck } from "lucide-react";

interface StatConfig {
    type: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    leftBorderClass: string;
}

const STAT_CONFIG: StatConfig[] = [
    {
        type: "banned",
        label: "Banned",
        icon: Ban,
        colorClass: "text-red-600 dark:text-red-400",
        bgClass: "bg-red-50/60 dark:bg-red-950/20",
        borderClass: "border-red-200/60 dark:border-red-900/40",
        leftBorderClass: "border-l-red-500 dark:border-l-red-500",
    },
    {
        type: "recalled",
        label: "Recalled",
        icon: RotateCcw,
        colorClass: "text-amber-600 dark:text-amber-400",
        bgClass: "bg-amber-50/60 dark:bg-amber-950/20",
        borderClass: "border-amber-200/60 dark:border-amber-900/40",
        leftBorderClass: "border-l-amber-500 dark:border-l-amber-500",
    },
    {
        type: "counterfeit",
        label: "Counterfeit",
        icon: ShieldAlert,
        colorClass: "text-purple-600 dark:text-purple-400",
        bgClass: "bg-purple-50/60 dark:bg-purple-950/20",
        borderClass: "border-purple-200/60 dark:border-purple-900/40",
        leftBorderClass: "border-l-purple-500 dark:border-l-purple-500",
    },
    {
        type: "nsq",
        label: "NSQ",
        icon: FileWarning,
        colorClass: "text-sky-700 dark:text-sky-400",
        bgClass: "bg-sky-50/60 dark:bg-sky-950/20",
        borderClass: "border-sky-200/60 dark:border-sky-900/40",
        leftBorderClass: "border-l-sky-500 dark:border-l-sky-500",
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
    const Icon = config.icon;
    return (
        <div
            className={`flex min-w-[130px] flex-1 basis-[140px] items-center gap-4 rounded-xl border border-l-4 p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md dark:hover:shadow-black/20 ${config.bgClass} ${config.borderClass} ${config.leftBorderClass}`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-slate-900 ${config.colorClass}`}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <div
                    className={`text-2xl leading-none font-extrabold tracking-tight ${config.colorClass}`}
                >
                    {displayed}
                </div>
                <div className="mt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
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
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                    <span>
                        {monthName} {now.getFullYear()} · India
                    </span>
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
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
                <span>Data sourced from CDSCO official registry. Updated in real-time.</span>
            </div>
        </div>
    );
}
