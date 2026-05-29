"use client";

import { Fingerprint, Mic, MapPin, AlertTriangle, Layers, ArrowRight } from "lucide-react";

export const FeaturesBento = () => (
    <section
        id="features"
        className="bg-gradient-to-b from-slate-50 to-white py-24 lg:py-32 dark:from-slate-900 dark:to-slate-950"
    >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-5 flex justify-center">
                <span
                    className="rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-blue-700 uppercase dark:text-blue-400"
                    style={{
                        background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
                        border: "1px solid #bfdbfe",
                    }}
                >
                    Core Features
                </span>
            </div>
            <h2 className="mb-4 text-center text-[2.5rem] leading-tight font-extrabold text-slate-900 lg:text-[3rem] dark:text-white">
                Everything you need.
                <br />
                Nothing you don&apos;t.
            </h2>
            <p className="mx-auto mb-16 max-w-xl text-center text-[15px] leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                A complete platform for safe medicine access &mdash; scan, verify, locate, and stay
                informed.
            </p>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                <a
                    href="/scan"
                    className="card-lift group noise relative overflow-hidden rounded-3xl p-9 md:col-span-7"
                    style={{
                        background:
                            "linear-gradient(145deg, #0d9488 0%, #0891b2 50%, #0369a1 100%)",
                        minHeight: "320px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        className="absolute -top-16 -right-16 h-60 w-60 rounded-full opacity-20"
                        style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
                    />
                    <div
                        className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-10"
                        style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
                    />
                    <div className="relative z-10">
                        <div
                            className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{
                                background: "rgba(255,255,255,0.2)",
                                border: "1px solid rgba(255,255,255,0.3)",
                                backdropFilter: "blur(10px)",
                            }}
                        >
                            <Fingerprint size={28} className="text-white" />
                        </div>
                        <span
                            className="mb-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold tracking-widest text-teal-200 uppercase"
                            style={{
                                background: "rgba(255,255,255,0.15)",
                                border: "1px solid rgba(255,255,255,0.2)",
                            }}
                        >
                            Flagship Feature
                        </span>
                        <h3 className="mb-3 text-[1.75rem] leading-tight font-extrabold text-white">
                            AI-Powered Counterfeit Detection
                        </h3>
                        <p className="max-w-md text-[14px] leading-relaxed text-teal-100">
                            Advanced computer vision analyzes packaging, barcodes, holograms, and
                            pill morphology &mdash; catching even the most sophisticated fakes in
                            under 2 seconds.
                        </p>
                    </div>
                    <div className="relative z-10 mt-6 flex items-center gap-2 text-sm font-bold text-white/80 transition-colors group-hover:text-white">
                        Start Scanning
                        <ArrowRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-1.5"
                        />
                    </div>
                </a>

                <a
                    href="/health"
                    className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-5"
                    style={{
                        background: "linear-gradient(145deg, #f5f3ff, #ede9fe)",
                        border: "1px solid #c4b5fd",
                        minHeight: "320px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div className="mb-5 flex items-start justify-between">
                            <div
                                className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                                style={{
                                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                    boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
                                }}
                            >
                                <Mic size={26} className="text-white" />
                            </div>
                            <span
                                className="rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wider text-violet-700 uppercase"
                                style={{
                                    background: "rgba(124,58,237,0.1)",
                                    border: "1px solid rgba(124,58,237,0.2)",
                                }}
                            >
                                Beta
                            </span>
                        </div>
                        <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                            AI Voice Triage
                        </h3>
                        <p className="text-[13.5px] leading-relaxed text-slate-600">
                            Speak your symptoms in any Indian language. Our AI maps them to clinical
                            urgency and recommends your next step.
                        </p>
                    </div>
                    <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-violet-600 transition-all group-hover:gap-2.5">
                        Try Voice Triage{" "}
                        <ArrowRight
                            size={15}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </div>
                </a>

                <a
                    href="/map"
                    className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                    style={{
                        background: "linear-gradient(145deg, #f0fdf4, #dcfce7)",
                        border: "1px solid #86efac",
                    }}
                >
                    <div
                        className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                            background: "linear-gradient(135deg, #16a34a, #059669)",
                            boxShadow: "0 8px 24px rgba(22,163,74,0.3)",
                        }}
                    >
                        <MapPin size={26} className="text-white" />
                    </div>
                    <span
                        className="mb-3 inline-block rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-700 uppercase"
                        style={{
                            background: "rgba(22,163,74,0.1)",
                            border: "1px solid rgba(22,163,74,0.2)",
                        }}
                    >
                        Live
                    </span>
                    <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                        Safe Pharmacy Map
                    </h3>
                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                        GPS-guided map of verified pharmacies with zero counterfeit history. Updated
                        in real time.
                    </p>
                    <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-emerald-600 transition-all group-hover:gap-2.5">
                        Find Pharmacies{" "}
                        <ArrowRight
                            size={15}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </div>
                </a>

                <a
                    href="/alerts"
                    className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                    style={{
                        background: "linear-gradient(145deg, #fff1f2, #ffe4e6)",
                        border: "1px solid #fca5a5",
                    }}
                >
                    <div className="mb-5 flex items-start justify-between">
                        <div
                            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{
                                background: "linear-gradient(135deg, #dc2626, #e11d48)",
                                boxShadow: "0 8px 24px rgba(220,38,38,0.3)",
                            }}
                        >
                            <AlertTriangle size={26} className="text-white" />
                        </div>
                        <div className="relative mt-1 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                        </div>
                    </div>
                    <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                        National Alert Feed
                    </h3>
                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                        CDSCO recalls and bans pushed directly to you. Community-reported suspicious
                        batches flagged instantly.
                    </p>
                    <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-rose-600 transition-all group-hover:gap-2.5">
                        View Active Alerts{" "}
                        <ArrowRight
                            size={15}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </div>
                </a>

                <a
                    href="/reports/me"
                    className="card-lift group relative overflow-hidden rounded-3xl p-8 md:col-span-4"
                    style={{
                        background: "linear-gradient(145deg, #eff6ff, #dbeafe)",
                        border: "1px solid #93c5fd",
                    }}
                >
                    <div
                        className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                            background: "linear-gradient(135deg, #2563eb, #4f46e5)",
                            boxShadow: "0 8px 24px rgba(37,99,235,0.3)",
                        }}
                    >
                        <Layers size={26} className="text-white" />
                    </div>
                    <h3 className="mb-2.5 text-[20px] font-extrabold text-slate-900">
                        Health Records
                    </h3>
                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                        All your scans, alerts, and prescriptions in one encrypted, private profile.
                    </p>
                    <div className="mt-5 flex items-center gap-1.5 text-[13px] font-bold text-blue-600 transition-all group-hover:gap-2.5">
                        My Records{" "}
                        <ArrowRight
                            size={15}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </div>
                </a>
            </div>
        </div>
    </section>
);
