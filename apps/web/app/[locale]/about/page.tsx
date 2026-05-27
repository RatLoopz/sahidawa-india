"use client";

import {
    ShieldCheck,
    Heart,
    Globe,
    MapPin,
    Mic,
    ChevronRight,
    Star,
    Zap,
    Lock,
    AlertTriangle,
    Users,
    Unlock,
    BadgeCheck,
} from "lucide-react";
import { Link } from "@/i18n/routing";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) bg-(--color-surface-page)">
                <div className="container mx-auto max-w-6xl space-y-6 px-4 py-16 text-center md:py-24">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h1 className="text-4xl leading-[1.1] font-black tracking-tight text-(--color-text-primary) md:text-6xl">
                        About <span className="text-emerald-600 dark:text-emerald-400">SahiDawa</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-(--color-text-secondary) md:text-xl">
                        India's first open-source citizen medicine verifier & rural health bridge.
                        Built for Bharat. Not just India.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-(--color-surface-muted) px-3 py-1.5 text-sm font-semibold text-(--color-text-secondary)">
                            <Lock size={14} /> 100% Free. Forever.
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-(--color-surface-muted) px-3 py-1.5 text-sm font-semibold text-(--color-text-secondary)">
                            <Globe size={14} /> 22 Indian Languages
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            <Star size={14} /> Open Source MIT License
                        </span>
                    </div>
                </div>
            </section>

            {/* Problem */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="mb-12 text-center">
                    <h2 className="mb-4 flex items-center justify-center gap-2 text-3xl font-black text-(--color-text-primary) md:text-4xl">
                        <AlertTriangle className="h-8 w-8 text-red-500" /> The Problem We're Solving
                    </h2>
                    <p className="mx-auto max-w-2xl font-medium text-(--color-text-secondary)">
                        India has a three-layer healthcare crisis that no existing platform solves
                        simultaneously.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {[
                        {
                            icon: <AlertTriangle size={28} strokeWidth={2.5} />,
                            color: "red",
                            title: "Fake Medicines",
                            desc: "12–25% of medicines in India are fake or substandard — putting 1.4 billion people at risk with zero citizen-facing verification tool.",
                        },
                        {
                            icon: <MapPin size={28} strokeWidth={2.5} />,
                            color: "amber",
                            title: "Rural Healthcare Gap",
                            desc: "65% of India's population lives in rural areas with almost no qualified doctors — over 900 million people without accessible healthcare.",
                        },
                        {
                            icon: <Mic size={28} strokeWidth={2.5} />,
                            color: "blue",
                            title: "Language Barrier",
                            desc: "22 official languages — but health information is mostly in English or Hindi, leaving 500M+ non-Hindi speakers behind.",
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="group rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg active:scale-[0.99]"
                        >
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-surface-muted) text-(--color-text-secondary) transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white">
                                {item.icon}
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-(--color-text-primary)">{item.title}</h3>
                            <p className="text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Incident box */}
                <div className="mt-8 rounded-3xl border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 p-6 md:p-8">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400">
                            <AlertTriangle size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="mb-1 font-bold text-(--color-text-primary)">
                                Real Incident — July 2025
                            </h4>
                            <p className="text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                Delhi Police busted a counterfeit medicine ring supplying fake
                                Johnson & Johnson and GSK medicines — made of chalk powder and
                                starch — all the way into government hospitals. Patients had{" "}
                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                    zero way to verify
                                </span>{" "}
                                these medicines before consuming them.
                            </p>
                            <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                SahiDawa fixes this. For free. Forever. Open source.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="border-y border-(--color-border-muted) bg-(--color-surface-page)">
                <div className="container mx-auto max-w-6xl px-4 py-16">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 p-8">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                                <ShieldCheck size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="mb-3 text-2xl font-black text-(--color-text-primary)">Our Mission</h3>
                            <p className="leading-relaxed font-medium text-(--color-text-secondary)">
                                To empower every Indian citizen — regardless of language, location,
                                or literacy — with the ability to instantly verify medicines, access
                                qualified health guidance, and report counterfeit drugs in their
                                community.
                            </p>
                        </div>
                        <div className="rounded-3xl bg-slate-900 p-8">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                                <Zap size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="mb-3 text-2xl font-black text-white">Our Vision</h3>
                            <p className="leading-relaxed font-medium text-slate-300">
                                A Bharat where no child dies from a fake medicine, no farmer's
                                family is misdiagnosed for lack of a doctor, and no language is a
                                barrier to healthcare. Free. Open. Forever.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Values */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="mb-12 text-center">
                    <h2 className="mb-4 text-3xl font-black text-(--color-text-primary) md:text-4xl">
                        Our Core Values
                    </h2>
                </div>
                <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
                    {[
                        { icon: <Unlock className="h-10 w-10 text-emerald-500" />, title: "Open Source", desc: "MIT Licensed. Always." },
                        { icon: <BadgeCheck className="h-10 w-10 text-blue-500" />, title: "Free Forever", desc: "No hidden costs. Ever." },
                        { icon: <Globe className="h-10 w-10 text-purple-500" />, title: "Inclusive", desc: "22 languages. All of Bharat." },
                        { icon: <Lock className="h-10 w-10 text-slate-500" />, title: "Privacy First", desc: "No data sold. No ads." },
                    ].map((v, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6"
                        >
                            <div className="mb-3 flex justify-center">{v.icon}</div>
                            <h3 className="mb-1 font-bold text-(--color-text-primary)">{v.title}</h3>
                            <p className="text-sm font-medium text-(--color-text-secondary)">{v.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Contact CTA */}
            <section className="container mx-auto max-w-6xl px-4 pb-16">
                <div className="relative overflow-hidden rounded-3xl bg-emerald-600 p-8 text-center text-white md:p-12">
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-700 to-emerald-500" />
                    <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                                <Users size={32} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black md:text-4xl">Get In Touch</h2>
                        <p className="mx-auto max-w-xl font-medium text-emerald-100">
                            Have questions, ideas, or want to contribute? We'd love to hear from
                            you.
                        </p>
                        <div className="pt-2">
                            <Link href="/contact">
                                <button className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-8 py-3.5 text-base font-bold text-emerald-600 dark:text-emerald-400 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl">
                                    Contact Us <ChevronRight size={18} />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
