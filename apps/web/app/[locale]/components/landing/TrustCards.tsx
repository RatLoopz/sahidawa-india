"use client";

import { ShieldCheck, Building2, Database, Zap } from "lucide-react";

const cards = [
    {
        icon: <ShieldCheck size={26} />,
        color: "#0d9488",
        bg: "linear-gradient(145deg, #f0fdfa, #ccfbf1)",
        border: "#99f6e4",
        iconBg: "linear-gradient(135deg, #0d9488, #06b6d4)",
        title: "Verified Medicines",
        desc: "Cross-referenced against CDSCO's official approved drug list in real time with every scan.",
        stat: "2M+",
        statLabel: "medicines verified",
        delay: "0ms",
    },
    {
        icon: <Building2 size={26} />,
        color: "#2563eb",
        bg: "linear-gradient(145deg, #eff6ff, #dbeafe)",
        border: "#93c5fd",
        iconBg: "linear-gradient(135deg, #2563eb, #4f46e5)",
        title: "Safe Pharmacies",
        desc: "Geo-mapped and regularly audited pharmacies with zero counterfeit history.",
        stat: "5,000+",
        statLabel: "pharmacies listed",
        delay: "80ms",
    },
    {
        icon: <Database size={26} />,
        color: "#7c3aed",
        bg: "linear-gradient(145deg, #f5f3ff, #ede9fe)",
        border: "#c4b5fd",
        iconBg: "linear-gradient(135deg, #7c3aed, #6d28d9)",
        title: "Trusted Data",
        desc: "Direct feeds from CDSCO, WHO, and manufacturers &mdash; no aggregator guesswork.",
        stat: "99.9%",
        statLabel: "data accuracy",
        delay: "160ms",
    },
    {
        icon: <Zap size={26} />,
        color: "#b45309",
        bg: "linear-gradient(145deg, #fffbeb, #fef3c7)",
        border: "#fcd34d",
        iconBg: "linear-gradient(135deg, #d97706, #f59e0b)",
        title: "Real-time Alerts",
        desc: "Instant push notifications for recalled, banned, or flagged drugs before they reach you.",
        stat: "<2s",
        statLabel: "alert response",
        delay: "240ms",
    },
];

export const TrustCards = () => (
    <section
        id="trust"
        className="bg-gradient-to-b from-white to-teal-50 py-24 lg:py-32 dark:from-slate-950 dark:to-slate-900"
    >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-16 max-w-2xl">
                <span
                    className="anim-fade-up mb-4 inline-block rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-teal-700 uppercase dark:text-teal-400"
                    style={{
                        background: "linear-gradient(135deg, #ccfbf1, #cffafe)",
                        border: "1px solid #99f6e4",
                    }}
                >
                    Built on Trust
                </span>
                <h2 className="anim-fade-up mb-4 text-[2.5rem] leading-tight font-extrabold text-slate-900 delay-100 lg:text-[3rem] dark:text-white">
                    Healthcare decisions
                    <br />
                    deserve absolute certainty.
                </h2>
                <p className="anim-fade-up text-[16px] leading-relaxed font-medium text-slate-500 delay-200 dark:text-slate-400">
                    Every feature is engineered with one goal: zero tolerance for counterfeits, zero
                    compromise on your safety.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(
                    ({ icon, color, bg, border, iconBg, title, desc, stat, statLabel, delay }) => (
                        <div
                            key={title}
                            className="card-lift group noise relative overflow-hidden rounded-3xl p-7"
                            style={{
                                background: bg,
                                border: `1px solid ${border}`,
                                animationDelay: delay,
                            }}
                        >
                            <div
                                className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
                                style={{
                                    background: iconBg,
                                    boxShadow: `0 8px 24px ${color}33`,
                                    color: "white",
                                }}
                            >
                                {icon}
                            </div>
                            <h3 className="mb-2.5 text-[17px] font-bold text-slate-900">{title}</h3>
                            <p className="mb-6 text-[13.5px] leading-relaxed text-slate-600">
                                {desc}
                            </p>
                            <div
                                className="flex items-end gap-2 pt-5"
                                style={{ borderTop: `1px solid ${border}` }}
                            >
                                <p
                                    className="text-[2rem] leading-none font-extrabold"
                                    style={{ color }}
                                >
                                    {stat}
                                </p>
                                <p className="mb-0.5 text-[12px] font-semibold text-slate-400">
                                    {statLabel}
                                </p>
                            </div>
                            <div
                                className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full opacity-20 transition-opacity duration-300 group-hover:opacity-40"
                                style={{ background: iconBg }}
                            />
                        </div>
                    )
                )}
            </div>
        </div>
    </section>
);
