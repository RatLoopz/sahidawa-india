"use client";

import { Lock, ScanLine, ArrowRight, CheckCircle2 } from "lucide-react";

export const CTABanner = () => (
    <section className="bg-gradient-to-b from-white to-teal-50 py-16 lg:py-20 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div
                className="noise relative overflow-hidden rounded-[2.5rem] p-12 lg:p-20"
                style={{
                    background: "linear-gradient(135deg, #0a0f1e 0%, #0d2137 60%, #0a1a2e 100%)",
                }}
            >
                <div
                    className="absolute -top-20 -right-20 h-80 w-80 rounded-full blur-3xl"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(13,148,136,0.2), transparent 70%)",
                    }}
                />
                <div
                    className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full blur-3xl"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(37,99,235,0.15), transparent 70%)",
                    }}
                />
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(99,255,230,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,255,230,0.5) 1px, transparent 1px)",
                        backgroundSize: "50px 50px",
                    }}
                />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div
                        className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold text-teal-300"
                        style={{
                            background: "rgba(13,148,136,0.15)",
                            border: "1px solid rgba(20,184,166,0.3)",
                        }}
                    >
                        <Lock size={13} strokeWidth={2.5} />
                        Your data is encrypted. Always.
                    </div>

                    <h2 className="mb-5 max-w-3xl text-[2.5rem] leading-tight font-extrabold text-white lg:text-[3.5rem]">
                        Don&apos;t take chances
                        <br />
                        with your health.
                    </h2>
                    <p className="mb-10 max-w-lg text-[16px] leading-relaxed font-medium text-slate-400">
                        Join 10,000+ patients and healthcare professionals who scan before they
                        consume.
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <a
                            href="/scan"
                            className="btn-primary group flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-[15px] font-bold text-slate-900 transition-all duration-300 hover:-translate-y-0.5"
                            style={{
                                background: "linear-gradient(135deg, #f0fdfa, #ffffff)",
                                boxShadow: "0 8px 40px rgba(255,255,255,0.15)",
                            }}
                        >
                            <ScanLine size={19} className="text-teal-600" />
                            Scan Your Medicine Now
                            <ArrowRight
                                size={17}
                                className="text-teal-600 opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                            />
                        </a>
                        <a
                            href="#how-it-works"
                            className="flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-[15px] font-semibold text-slate-300 transition-all duration-300 hover:text-white"
                            style={{
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "rgba(255,255,255,0.05)",
                            }}
                        >
                            See How It Works
                        </a>
                    </div>

                    <div className="mt-10 flex flex-wrap justify-center gap-6">
                        {[
                            "CDSCO Verified",
                            "256-bit Encryption",
                            "No Credit Card",
                            "Free Forever",
                        ].map((label) => (
                            <div
                                key={label}
                                className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-400"
                            >
                                <CheckCircle2
                                    size={14}
                                    className="text-teal-400"
                                    strokeWidth={2.5}
                                />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </section>
);
