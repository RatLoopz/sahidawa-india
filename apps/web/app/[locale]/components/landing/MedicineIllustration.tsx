"use client";

import { Pill, CheckCircle2, ShieldCheck, BadgeCheck } from "lucide-react";

export const MedicineIllustration = () => (
    <div className="anim-float relative mx-auto w-full max-w-[460px] select-none">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="anim-spin-slow absolute h-[300px] w-[300px] rounded-full border border-teal-200/40 md:h-[420px] md:w-[420px]" />
            <div className="anim-spin-rev absolute h-[240px] w-[240px] rounded-full border border-cyan-200/30 md:h-[340px] md:w-[340px]" />
            <div className="absolute flex h-[300px] w-[300px] items-center justify-center md:h-[420px] md:w-[420px]">
                <div className="anim-orbit absolute">
                    <div className="relative h-4 w-4 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shadow-teal-300/50 md:h-5 md:w-5">
                        <div className="absolute inset-0 animate-ping rounded-full bg-teal-400 opacity-60" />
                    </div>
                </div>
            </div>
            <div className="absolute flex h-[240px] w-[240px] items-center justify-center md:h-[340px] md:w-[340px]">
                <div className="anim-c-orbit absolute">
                    <div className="h-2 w-2 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 shadow-md shadow-blue-300/50 md:h-3 md:w-3" />
                </div>
            </div>
        </div>

        <div
            className="noise relative z-10 overflow-hidden rounded-[2rem] shadow-2xl shadow-teal-900/10"
            style={{
                background: "linear-gradient(145deg, #ffffff 0%, #f0fdfa 100%)",
                border: "1px solid rgba(204,251,241,0.8)",
            }}
        >
            <div
                className="h-1.5 w-full"
                style={{
                    background:
                        "linear-gradient(90deg, #0d9488, #06b6d4, #3b82f6, #06b6d4, #0d9488)",
                    backgroundSize: "200% auto",
                    animation: "shimmer 3s linear infinite",
                }}
            />

            <div className="p-7">
                <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="relative flex h-13 w-13 items-center justify-center rounded-2xl"
                            style={{
                                background: "linear-gradient(135deg, #ccfbf1 0%, #cffafe 100%)",
                                border: "1px solid rgba(94,234,212,0.4)",
                            }}
                        >
                            <Pill size={22} className="text-teal-600" />
                        </div>
                        <div>
                            <p className="mb-0.5 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
                                Verified Drug
                            </p>
                            <p className="text-[15px] leading-tight font-bold text-slate-800 dark:text-slate-200">
                                Paracetamol 500mg
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">
                                Tab. &middot; Batch #PM4892
                            </p>
                        </div>
                    </div>
                    <span
                        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"
                        style={{
                            background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                            border: "1px solid #6ee7b7",
                        }}
                    >
                        <CheckCircle2 size={11} strokeWidth={3} /> Authentic
                    </span>
                </div>

                <div
                    className="relative mb-5 overflow-hidden rounded-2xl p-4"
                    style={{
                        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                        border: "1px solid #e2e8f0",
                    }}
                >
                    <p className="mb-3 text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                        Batch Barcode
                    </p>
                    <div
                        className="mb-2.5 flex h-14 items-end gap-[2.5px]"
                        style={{
                            transformOrigin: "bottom",
                            animation: "bar-grow 0.8s cubic-bezier(.22,1,.36,1) 0.3s both",
                        }}
                    >
                        {[
                            3, 1, 4, 1, 5, 2, 3, 1, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 4, 5, 1, 2, 3,
                            4, 1, 2,
                        ].map((h, i) => (
                            <div
                                key={i}
                                className="rounded-sm"
                                style={{
                                    height: `${h * 19}%`,
                                    background: "#1e293b",
                                    width: h === 1 ? "2px" : h === 5 ? "4px" : "3px",
                                    minWidth: "2px",
                                    opacity: 0.75 + (i % 3) * 0.08,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-center font-mono text-[9px] tracking-[0.35em] text-slate-500">
                        4 8 0 9 2 &middot; 1 7 3 6
                    </p>
                </div>

                <div
                    className="relative mb-5 overflow-hidden rounded-2xl"
                    style={{
                        height: "56px",
                        background: "linear-gradient(135deg, #f0fdfa, #ecfeff)",
                        border: "1px solid #99f6e4",
                    }}
                >
                    <div className="scan-laser" />
                    <div className="relative z-10 flex h-full items-center justify-center gap-2">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
                        <p className="text-[13px] font-semibold text-teal-700">
                            Verifying authenticity&hellip;
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            label: "CDSCO",
                            val: "Approved",
                            color: "#065f46",
                            bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
                            border: "#6ee7b7",
                        },
                        {
                            label: "Batch",
                            val: "Valid",
                            color: "#1e40af",
                            bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
                            border: "#93c5fd",
                        },
                        {
                            label: "Trust",
                            val: "100%",
                            color: "#115e59",
                            bg: "linear-gradient(135deg,#ccfbf1,#cffafe)",
                            border: "#5eead4",
                        },
                    ].map(({ label, val, color, bg, border }) => (
                        <div
                            key={label}
                            className="rounded-xl p-3 text-center"
                            style={{ background: bg, border: `1px solid ${border}` }}
                        >
                            <p
                                className="mb-1 text-[9px] font-bold tracking-[0.15em] uppercase"
                                style={{ color: `${color}99` }}
                            >
                                {label}
                            </p>
                            <p className="text-[13px] font-extrabold" style={{ color }}>
                                {val}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div
            className="glass anim-float-med absolute top-1/3 -right-10 z-20 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{ animationDelay: "1s" }}
        >
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #0d9488, #06b6d4)" }}
            >
                <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
                <p className="mb-0.5 text-[10px] font-semibold text-slate-400">Safety Score</p>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    Excellent &#10003;
                </p>
            </div>
        </div>

        <div
            className="glass anim-float-med absolute bottom-1/4 -left-10 z-20 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{ animationDelay: "2.5s" }}
        >
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
            >
                <BadgeCheck size={18} className="text-white" />
            </div>
            <div>
                <p className="mb-0.5 text-[10px] font-semibold text-slate-400">Manufacturer</p>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    Verified
                </p>
            </div>
        </div>

        <div
            className="absolute inset-0 -z-10 scale-90 rounded-3xl blur-3xl"
            style={{
                background:
                    "radial-gradient(ellipse at 50% 50%, rgba(45,212,191,0.25), rgba(96,165,250,0.12), transparent 70%)",
            }}
        />
    </div>
);
