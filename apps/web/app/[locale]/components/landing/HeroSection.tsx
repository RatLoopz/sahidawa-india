"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
    ShieldCheck,
    ScanLine,
    ArrowRight,
    ChevronDown,
    User,
    Star,
    BadgeCheck,
    Activity,
} from "lucide-react";
import { MedicineIllustration } from "./MedicineIllustration";

export const HeroSection = () => {
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === "dark";

    return (
        <section className="relative flex min-h-[100svh] flex-col overflow-hidden pt-[68px]">
            <div
                className="absolute inset-0 -z-10"
                style={{
                    background: isDark
                        ? "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(13,148,136,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 70%, rgba(37,99,235,0.1) 0%, transparent 55%)"
                        : "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(204,251,241,0.55) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 70%, rgba(186,230,253,0.35) 0%, transparent 55%), radial-gradient(ellipse 40% 40% at 50% 10%, rgba(240,253,250,0.9) 0%, white 70%)",
                }}
            />

            <div
                className="absolute inset-0 -z-10 opacity-[0.4] dark:opacity-[0.08]"
                style={{
                    backgroundImage: "radial-gradient(circle, #99f6e4 1px, transparent 1px)",
                    backgroundSize: "36px 36px",
                }}
            />

            <div className="relative mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center px-5 sm:px-8 lg:px-10">
                <div className="grid grid-cols-1 items-center gap-16 py-20 lg:grid-cols-2 lg:gap-8 lg:py-24">
                    <div className="flex flex-col items-start">
                        <div
                            className="anim-fade-up mb-7 flex items-center gap-2.5 rounded-full py-2 pr-5 pl-2 text-[12px] font-bold text-teal-800 dark:text-teal-200"
                            style={{
                                background: isDark
                                    ? "linear-gradient(135deg, rgba(13,148,136,0.2), rgba(8,145,178,0.2))"
                                    : "linear-gradient(135deg, rgba(204,251,241,0.9), rgba(207,250,254,0.9))",
                                border: isDark
                                    ? "1px solid rgba(13,148,136,0.3)"
                                    : "1px solid rgba(94,234,212,0.6)",
                                backdropFilter: "blur(10px)",
                            }}
                        >
                            <span
                                className="flex h-6 w-6 items-center justify-center rounded-full"
                                style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
                            >
                                <ShieldCheck size={12} className="text-white" strokeWidth={3} />
                            </span>
                            Trusted Medical Verification Platform
                            <span className="ml-1 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                LIVE
                            </span>
                        </div>

                        <h1 className="anim-fade-up mb-6 text-[2.5rem] leading-[1.05] font-extrabold text-slate-900 delay-100 md:text-[3.25rem] lg:text-[4.25rem] dark:text-white">
                            Your Health, <br className="hidden sm:block" />
                            <span className="shimmer-text">Verified</span>{" "}
                            <span className="relative">
                                &amp; Protected
                                <svg
                                    className="absolute -bottom-2 left-0 w-full"
                                    viewBox="0 0 320 10"
                                    preserveAspectRatio="none"
                                >
                                    <path
                                        d="M4 7 Q80 2 160 6 Q240 10 316 5"
                                        stroke="url(#wg)"
                                        strokeWidth="3"
                                        fill="none"
                                        strokeLinecap="round"
                                    />
                                    <defs>
                                        <linearGradient id="wg" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#0d9488" />
                                            <stop offset="100%" stopColor="#38bdf8" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </span>
                        </h1>

                        <p className="anim-fade-up mb-9 max-w-[480px] text-[17px] leading-[1.7] font-medium text-slate-500 delay-200 dark:text-slate-400">
                            Instantly verify any medicine using AI-powered scanning. Detect
                            counterfeits, check CDSCO approvals, and locate safe pharmacies &mdash;
                            all in under 2 seconds.
                        </p>

                        <div className="anim-fade-up mb-10 flex w-full flex-wrap gap-3.5 delay-300">
                            <a
                                href="/scan"
                                className="btn-primary group flex items-center gap-2.5 rounded-2xl px-7 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                                style={{
                                    background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)",
                                    boxShadow:
                                        "0 8px 30px rgba(13,148,136,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                                }}
                            >
                                <ScanLine size={19} strokeWidth={2.5} />
                                Scan Your Medicine Now
                                <ArrowRight
                                    size={17}
                                    className="opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                                />
                            </a>
                            <a
                                href="#how-it-works"
                                className="flex items-center gap-2 rounded-2xl border-2 bg-white/70 px-7 py-4 text-[15px] font-bold text-slate-700 backdrop-blur-sm transition-all duration-300 hover:border-teal-300 hover:bg-white hover:shadow-lg hover:shadow-teal-100/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-teal-600 dark:hover:bg-slate-800"
                                style={{ borderColor: "#e2e8f0" }}
                            >
                                Learn More
                                <ChevronDown size={17} className="text-slate-400" />
                            </a>
                        </div>

                        <div className="anim-fade-up flex flex-wrap items-center gap-6 delay-400">
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2.5">
                                    {["#ccfbf1", "#cffafe", "#dbeafe", "#ede9fe"].map((bg, i) => (
                                        <div
                                            key={i}
                                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-sm dark:border-slate-900"
                                            style={{ background: bg }}
                                        >
                                            <User size={13} className="text-slate-500" />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="mb-0.5 flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Star
                                                key={i}
                                                size={11}
                                                className="fill-amber-400 text-amber-400"
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                                        <span className="font-extrabold text-slate-900 dark:text-white">
                                            10,000+
                                        </span>{" "}
                                        verified users
                                    </p>
                                </div>
                            </div>
                            <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-700" />
                            <div className="flex items-center gap-2">
                                <BadgeCheck size={18} className="text-teal-500" />
                                <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="font-extrabold text-slate-900 dark:text-white">
                                        CDSCO
                                    </span>{" "}
                                    Synced Daily
                                </p>
                            </div>
                            <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-700" />
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-rose-500" />
                                <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="font-extrabold text-slate-900 dark:text-white">
                                        99.9%
                                    </span>{" "}
                                    Accuracy
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="anim-fade-in relative flex justify-center delay-300 lg:justify-end lg:pr-4">
                        <MedicineIllustration />
                    </div>
                </div>
            </div>

            <div className="anim-fade-up absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 delay-700">
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                    Scroll
                </p>
                <div className="h-8 w-px overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                        className="h-full w-full bg-gradient-to-b from-teal-500 to-transparent"
                        style={{ animation: "slide-right 1.8s ease-in-out infinite" }}
                    />
                </div>
            </div>
        </section>
    );
};
