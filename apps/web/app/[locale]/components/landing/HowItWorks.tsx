"use client";

import { Camera, FlaskConical, CheckCircle2, ScanLine, ArrowRight } from "lucide-react";

const steps = [
    {
        num: "01",
        icon: <Camera size={26} />,
        color: "#2dd4bf",
        glow: "rgba(45,212,191,0.2)",
        title: "Scan Medicine",
        desc: "Point your camera at the barcode, QR code, or packaging. Our AI captures it instantly &mdash; no special hardware needed.",
        tag: "Step 1",
    },
    {
        num: "02",
        icon: <FlaskConical size={26} />,
        color: "#60a5fa",
        glow: "rgba(96,165,250,0.2)",
        title: "Verify Authenticity",
        desc: "Cross-matched against 2M+ records &mdash; CDSCO approvals, manufacturer data, batch numbers, and counterfeit alerts.",
        tag: "Step 2",
    },
    {
        num: "03",
        icon: <CheckCircle2 size={26} />,
        color: "#4ade80",
        glow: "rgba(74,222,128,0.2)",
        title: "Get Safe Results",
        desc: "Receive a clear Authentic, Flagged, or Recalled verdict with actionable next steps in under 2 seconds.",
        tag: "Step 3",
    },
];

export const HowItWorks = () => (
    <section
        id="how-it-works"
        className="noise relative overflow-hidden py-24 lg:py-32"
        style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d2137 50%, #0a1a2e 100%)" }}
    >
        <div className="pointer-events-none absolute inset-0">
            <div
                className="absolute top-0 left-1/4 h-80 w-80 rounded-full blur-3xl"
                style={{
                    background: "radial-gradient(circle, rgba(13,148,136,0.15), transparent 70%)",
                }}
            />
            <div
                className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full blur-3xl"
                style={{
                    background: "radial-gradient(circle, rgba(37,99,235,0.12), transparent 70%)",
                }}
            />
            <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(99,255,230,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,255,230,0.3) 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }}
            />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-5 flex justify-center">
                <span
                    className="rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-teal-400 uppercase"
                    style={{
                        background: "rgba(13,148,136,0.15)",
                        border: "1px solid rgba(20,184,166,0.3)",
                    }}
                >
                    Simple Process
                </span>
            </div>
            <h2 className="mb-4 text-center text-[2.5rem] leading-tight font-extrabold text-white lg:text-[3rem]">
                Verify any medicine
                <br />
                in just 3 steps
            </h2>
            <p className="mx-auto mb-20 max-w-xl text-center text-[15px] leading-relaxed font-medium text-slate-400">
                Designed for patients, pharmacists, and doctors &mdash; no technical knowledge
                required.
            </p>

            <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
                <div
                    className="step-connector hidden md:block"
                    style={{
                        background:
                            "linear-gradient(90deg, rgba(94,234,212,0.6), rgba(147,197,253,0.6))",
                        left: "calc(16.66% + 40px)",
                        width: "calc(66.66% - 80px)",
                    }}
                />

                {steps.map(({ num, icon, color, glow, title, desc, tag }) => (
                    <div
                        key={num}
                        className="glass-dark card-lift group relative cursor-default rounded-3xl p-8"
                    >
                        <span
                            className="absolute top-5 right-7 text-[4rem] leading-none font-black select-none"
                            style={{ color: "rgba(255,255,255,0.03)" }}
                        >
                            {num}
                        </span>
                        <div
                            className="relative mb-7 inline-flex h-[60px] w-[60px] items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                            style={{ background: glow, border: `1px solid ${color}40`, color }}
                        >
                            {icon}
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                style={{ background: glow }}
                            />
                        </div>
                        <div
                            className="mb-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.15em] uppercase"
                            style={{
                                background: `${color}18`,
                                color,
                                border: `1px solid ${color}30`,
                            }}
                        >
                            {tag}
                        </div>
                        <h3 className="mb-3 text-[20px] font-bold text-white">{title}</h3>
                        <p className="text-[14px] leading-relaxed text-slate-400">{desc}</p>
                    </div>
                ))}
            </div>

            <div className="mt-14 flex justify-center">
                <a
                    href="/scan"
                    className="btn-primary group flex items-center gap-3 rounded-2xl px-8 py-4.5 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                        background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                        boxShadow: "0 8px 40px rgba(13,148,136,0.4)",
                    }}
                >
                    <ScanLine size={19} />
                    Try It Free &mdash; No Account Needed
                    <ArrowRight
                        size={17}
                        className="opacity-70 transition-transform duration-300 group-hover:translate-x-1"
                    />
                </a>
            </div>
        </div>
    </section>
);
