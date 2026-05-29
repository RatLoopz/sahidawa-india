"use client";

import { ShieldCheck, Search, Bot, Store, BellRing, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const steps = [
    {
        icon: <ShieldCheck size={34} />,
        title: "Verify Medicines",
        description:
            "Instantly verify medicine authenticity using barcode, batch number, or medicine details.",
    },
    {
        icon: <Search size={34} />,
        title: "Scan or Search",
        description:
            "Scan packaging or manually search medicines for trusted healthcare information.",
    },
    {
        icon: <Bot size={34} />,
        title: "AI Health Assistant",
        description:
            "Get AI-powered guidance for symptoms, side effects, precautions, and medicine usage.",
    },
    {
        icon: <Store size={34} />,
        title: "Trusted Pharmacies",
        description:
            "Find verified pharmacies nearby with reliable medicine availability and ratings.",
    },
    {
        icon: <BellRing size={34} />,
        title: "CDSCO Alerts",
        description:
            "Stay updated with official CDSCO medicine recalls, warnings, and health alerts.",
    },
    {
        icon: <AlertTriangle size={34} />,
        title: "Report Suspicious Medicines",
        description:
            "Help the community by reporting counterfeit or suspicious medicines instantly.",
    },
];

export default function HowItWorksPage() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-(--color-surface-page) via-emerald-500/[0.03] to-(--color-surface-page) text-(--color-text-primary)">
            {/* Hero Section */}
            <section className="relative px-6 pt-24 pb-20">
                {/* Glow Effects */}
                <div className="absolute top-10 left-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

                <div className="relative mx-auto max-w-6xl text-center">
                    <Link
                        href="/"
                        aria-label="Back to Home"
                        className="absolute top-6 left-6 flex h-12 w-12 items-center justify-center rounded-full border border-(--color-border-muted) bg-(--color-surface-muted) shadow-sm transition-all duration-300 hover:scale-105 hover:bg-(--color-border-muted)"
                    >
                        <ArrowLeft size={22} className="text-(--color-text-secondary)" />
                    </Link>
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Safe Healthcare • AI Powered
                    </div>

                    <h1 className="text-4xl leading-tight font-black tracking-tight text-(--color-text-primary) sm:text-5xl md:text-7xl">
                        How <span className="text-emerald-600">SahiDawa</span> Works
                    </h1>

                    <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-(--color-text-secondary) md:text-xl">
                        Learn how SahiDawa helps users verify medicines, discover trusted
                        pharmacies, receive official alerts, and stay protected from counterfeit
                        drugs using AI-powered healthcare tools.
                    </p>

                    {/* CTA Buttons */}
                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <Link
                            href="/en/scan"
                            className="rounded-2xl bg-emerald-600 px-7 py-4 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-700"
                        >
                            Start Scanning
                        </Link>

                        <Link
                            href="/en/map"
                            className="rounded-2xl border border-(--color-border-muted) px-7 py-4 font-semibold text-(--color-text-secondary) transition-all duration-300 hover:border-emerald-500 hover:text-emerald-600"
                        >
                            Explore Pharmacy Map
                        </Link>
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="px-6 py-10">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-10">
                        {[
                            "Scan Medicine",
                            "Verify Instantly",
                            "Check Alerts",
                            "Find Pharmacies",
                            "Stay Protected",
                        ].map((item, index) => (
                            <div key={index} className="relative flex-1">
                                <div className="h-full rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-emerald-300 hover:shadow-xl">
                                    <div className="dark:text-emerald-450 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-600 dark:bg-emerald-950/30">
                                        {index + 1}
                                    </div>

                                    <h3 className="text-lg font-bold text-(--color-text-primary)">
                                        {item}
                                    </h3>
                                </div>

                                {index !== 4 && (
                                    <div className="absolute top-[52%] left-full ml-2 hidden -translate-y-1/2 text-emerald-400 md:block">
                                        <ArrowRight size={24} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="px-6 py-20">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-16 text-center">
                        <h2 className="text-4xl font-bold text-(--color-text-primary)">
                            Platform Features
                        </h2>

                        <p className="mt-4 text-lg text-(--color-text-secondary)">
                            Everything you need for safer healthcare decisions.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="group rounded-[32px] border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm transition-all duration-500 hover:-translate-y-3 hover:border-emerald-300/40 hover:shadow-2xl active:scale-[0.99]"
                            >
                                <div className="dark:text-emerald-450 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110 dark:from-emerald-950/20 dark:to-blue-950/20">
                                    {step.icon}
                                </div>

                                <h3 className="mb-4 text-2xl font-bold text-(--color-text-primary)">
                                    {step.title}
                                </h3>

                                <p className="text-base leading-relaxed text-(--color-text-secondary)">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="px-6 pb-24">
                <div className="mx-auto max-w-5xl rounded-[40px] bg-gradient-to-r from-emerald-600 to-teal-500 p-12 text-center text-white shadow-2xl">
                    <h2 className="mb-6 text-4xl font-black md:text-5xl">
                        Safer Healthcare Starts Here
                    </h2>

                    <p className="mx-auto max-w-3xl text-lg leading-relaxed text-white/90 md:text-xl">
                        Verify medicines, access trusted healthcare information, and stay protected
                        from counterfeit drugs with AI-powered assistance.
                    </p>

                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <Link
                            href="/en/scan"
                            className="rounded-2xl bg-white px-8 py-4 font-bold text-emerald-700 transition-transform duration-300 hover:scale-105"
                        >
                            Scan Medicine
                        </Link>

                        <Link
                            href="/en/alerts"
                            className="rounded-2xl border border-white/40 px-8 py-4 font-bold transition-all duration-300 hover:bg-white/10"
                        >
                            View Alerts
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
