"use client";
import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import {
    Ban,
    RotateCcw,
    Shield,
    FileWarning,
    Calendar,
    ShieldCheck,
    TrendingDown,
    ArrowRight
} from "lucide-react";

interface StatConfig {
    type: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    numberColor: string;
}

const STAT_CONFIG: StatConfig[] = [
    {
        type: "banned",
        label: "Banned",
        description: "Prohibited from sale",
        icon: Ban,
        iconBg: "bg-rose-100 dark:bg-rose-500/20",
        iconColor: "text-rose-600 dark:text-rose-400",
        numberColor: "text-rose-700 dark:text-rose-400",
    },
    {
        type: "recalled",
        label: "Recalled",
        description: "Withdrawn from market",
        icon: RotateCcw,
        iconBg: "bg-amber-100 dark:bg-amber-500/20",
        iconColor: "text-amber-600 dark:text-amber-400",
        numberColor: "text-amber-700 dark:text-amber-400",
    },
    {
        type: "counterfeit",
        label: "Counterfeit",
        description: "Fake medicines detected",
        icon: Shield,
        iconBg: "bg-violet-100 dark:bg-violet-500/20",
        iconColor: "text-violet-600 dark:text-violet-400",
        numberColor: "text-violet-700 dark:text-violet-400",
    },
    {
        type: "nsq",
        label: "NSQ",
        description: "Not of standard quality",
        icon: FileWarning,
        iconBg: "bg-blue-100 dark:bg-blue-500/20",
        iconColor: "text-blue-600 dark:text-blue-400",
        numberColor: "text-blue-700 dark:text-blue-400",
    },
];

function useCountUp(target: number, duration = 1400) {
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
            if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
        };
    }, [target, duration]);

    return count;
}

function SkeletonCard() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
            <div className="flex items-start justify-between">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="mt-6 h-8 w-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-1 h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
    );
}

function StatCard({ config, count }: { config: StatConfig; count: number }) {
    const displayed = useCountUp(count);
    const Icon = config.icon;

    return (
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/50 dark:hover:border-slate-700">
            <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${config.iconBg}`}>
                    <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>
                <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <TrendingDown className="h-3 w-3" />
                    <span>ALL TIME</span>
                </div>
            </div>

            <div className="mt-6">
                <div className={`text-3xl font-bold tabular-nums tracking-tight ${config.numberColor}`}>
                    {displayed}
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {config.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {config.description}
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
        async function fetchStats() {
            try {
                const res = await fetch("/api/stats");
                if (res.ok) {
                    const data = await res.json();
                    setBanned(data.banned ?? 0);
                    setRecalled(data.recalled ?? 0);
                    setCounterfeit(data.counterfeit ?? 0);
                    setNsq(data.nsq ?? 0);
                }
            } catch (error) {
                console.error("Failed to fetch safety stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const cardData = [
        { ...STAT_CONFIG[0], count: banned },
        { ...STAT_CONFIG[1], count: recalled },
        { ...STAT_CONFIG[2], count: counterfeit },
        { ...STAT_CONFIG[3], count: nsq },
    ];

    return (
        <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                            Live Safety Alerts
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                            </span>
                            Live Updates
                        </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Real-time data aggregated from the CDSCO official registry across India.
                    </p>
                </div>
                
                <Link 
                    href="/alerts"
                    className="group inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                    View Alert Registry
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {cardData.map((card) => (
                        <StatCard key={card.type} config={card} count={card.count} />
                    ))}
                </div>
            )}
            
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} className="text-slate-400" />
                <span>Verified against official CDSCO publications</span>
            </div>
        </div>
    );
}
