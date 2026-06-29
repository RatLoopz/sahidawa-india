"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "@/i18n/routing";
import {
    Ban,
    RotateCcw,
    Shield,
    FileWarning,
    Calendar,
    ShieldCheck,
    TrendingDown,
} from "lucide-react";

interface StatConfig {
    type: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentBar: string;
    iconGradient: string;
    iconColor: string;
    numberColor: string;
    glowColor: string;
    badgeBg: string;
    badgeText: string;
}

const STAT_CONFIG: StatConfig[] = [
    {
        type: "banned",
        label: "Banned",
        description: "Drugs prohibited from sale",
        icon: Ban,
        accentBar: "bg-gradient-to-r from-rose-500 to-red-400",
        iconGradient: "bg-gradient-to-br from-rose-500 to-red-600",
        iconColor: "text-white",
        numberColor: "text-rose-600 dark:text-rose-400",
        glowColor:
            "group-hover:shadow-[0_16px_48px_-8px_rgba(244,63,94,0.22)] dark:group-hover:shadow-[0_16px_48px_-8px_rgba(244,63,94,0.30)]",
        badgeBg: "bg-rose-50 dark:bg-rose-950/40",
        badgeText: "text-rose-600 dark:text-rose-400",
    },
    {
        type: "recalled",
        label: "Recalled",
        description: "Withdrawn from circulation",
        icon: RotateCcw,
        accentBar: "bg-gradient-to-r from-amber-500 to-orange-400",
        iconGradient: "bg-gradient-to-br from-amber-500 to-orange-500",
        iconColor: "text-white",
        numberColor: "text-amber-600 dark:text-amber-400",
        glowColor:
            "group-hover:shadow-[0_16px_48px_-8px_rgba(245,158,11,0.22)] dark:group-hover:shadow-[0_16px_48px_-8px_rgba(245,158,11,0.30)]",
        badgeBg: "bg-amber-50 dark:bg-amber-950/40",
        badgeText: "text-amber-600 dark:text-amber-400",
    },
    {
        type: "counterfeit",
        label: "Counterfeit",
        description: "Fake medicines detected",
        icon: Shield,
        accentBar: "bg-gradient-to-r from-violet-500 to-purple-500",
        iconGradient: "bg-gradient-to-br from-violet-500 to-purple-600",
        iconColor: "text-white",
        numberColor: "text-violet-600 dark:text-violet-400",
        glowColor:
            "group-hover:shadow-[0_16px_48px_-8px_rgba(139,92,246,0.22)] dark:group-hover:shadow-[0_16px_48px_-8px_rgba(139,92,246,0.30)]",
        badgeBg: "bg-violet-50 dark:bg-violet-950/40",
        badgeText: "text-violet-600 dark:text-violet-400",
    },
    {
        type: "nsq",
        label: "NSQ",
        description: "Not of standard quality",
        icon: FileWarning,
        accentBar: "bg-gradient-to-r from-blue-500 to-sky-400",
        iconGradient: "bg-gradient-to-br from-blue-500 to-sky-500",
        iconColor: "text-white",
        numberColor: "text-blue-600 dark:text-blue-400",
        glowColor:
            "group-hover:shadow-[0_16px_48px_-8px_rgba(59,130,246,0.22)] dark:group-hover:shadow-[0_16px_48px_-8px_rgba(59,130,246,0.30)]",
        badgeBg: "bg-blue-50 dark:bg-blue-950/40",
        badgeText: "text-blue-600 dark:text-blue-400",
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-1 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 flex items-start gap-4">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="flex-1 space-y-2 pt-1">
                    <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                </div>
            </div>
            <div className="mt-4 h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
    );
}

function StatCard({ config, count }: { config: StatConfig; count: number }) {
    const displayed = useCountUp(count);
    const Icon = config.icon;

    return (
        <Link
            href="/alerts"
            className={`group relative block overflow-hidden rounded-2xl border border-slate-100/80 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-slate-200/80 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700/80 ${config.glowColor}`}
        >
            {/* Coloured accent top bar */}
            <div
                className={`h-1 w-full ${config.accentBar} transition-all duration-300 group-hover:h-1.5`}
            />

            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    {/* Gradient icon orb */}
                    <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg ${config.iconGradient}`}
                    >
                        <Icon className={`h-5.5 w-5.5 ${config.iconColor}`} />
                    </div>

                    {/* Trend badge */}
                    <div
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${config.badgeBg} ${config.badgeText}`}
                    >
                        <TrendingDown className="h-3 w-3" />
                        <span>All Time</span>
                    </div>
                </div>

                {/* Number */}
                <div
                    className={`mt-4 origin-left text-4xl leading-none font-black tracking-tight tabular-nums transition-transform duration-300 group-hover:scale-[1.03] ${config.numberColor}`}
                >
                    {displayed}
                </div>

                {/* Label */}
                <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {config.label}
                    </span>
                </div>

                {/* Description */}
                <p className="mt-1 text-xs leading-snug text-slate-400 dark:text-slate-500">
                    {config.description}
                </p>
            </div>

            {/* Subtle radial glow background on hover */}
            <div
                className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${config.iconGradient}`}
                style={{ opacity: 0 }}
            />
        </Link>
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
            const { data, error } = await supabase.from("drug_alerts").select("alert_type");

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

    // const now = new Date();
    // const monthName = now.toLocaleString("default", { month: "long" });

    const cardData = [
        { ...STAT_CONFIG[0], count: banned },
        { ...STAT_CONFIG[1], count: recalled },
        { ...STAT_CONFIG[2], count: counterfeit },
        { ...STAT_CONFIG[3], count: nsq },
    ];

    return (
        <div className="my-6 overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-50/80 shadow-xl shadow-slate-200/30 backdrop-blur-sm transition-colors duration-300 dark:border-slate-800/50 dark:bg-slate-950/60 dark:shadow-slate-950/20">
            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-white/60 px-6 py-4 transition-colors duration-300 dark:border-slate-800/50 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                    {/* Pulsing LIVE badge */}
                    <span className="relative inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold tracking-widest text-white uppercase shadow-md shadow-emerald-500/30">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        Live
                    </span>
                    <div>
                        <h3 className="text-[15px] leading-tight font-extrabold text-slate-900 dark:text-slate-100">
                            Medicine Safety Alerts
                        </h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Real-time alerts from CDSCO registry
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    <Calendar size={12} className="text-slate-400" />
                    <span>All Time · India</span>
                </div>
            </div>

            {/* Cards grid */}
            <div className="p-5">
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
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-slate-200/60 bg-white/40 px-6 py-3 transition-colors duration-300 dark:border-slate-800/50 dark:bg-slate-900/40">
                <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Data sourced from CDSCO official registry. Updated in real-time.
                </span>
            </div>
        </div>
    );
}
