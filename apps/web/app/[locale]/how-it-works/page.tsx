"use client";

import {
    ShieldCheck,
    Search,
    Bot,
    Store,
    BellRing,
    AlertTriangle,
    ArrowRight,
    ArrowLeft,
    QrCode,
    MapPin,
    Shield,
} from "lucide-react";
// Locale-aware Link (not next/link) so CTAs preserve the active locale.
// Hardcoded "/en/" hrefs were removed and this import was fixed in
// commit 8359882 / PR #918 ("fix(web): use i18n routing link and remove
// hardcoded locale in how-it-works"). Hrefs below are intentionally relative.
import { Link } from "@/i18n/routing";

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

const timelineSteps = [
    {
        icon: <QrCode size={24} />,
        title: "Scan Medicine",
        description:
            "Point your device camera at the barcode or QR code on any medicine packaging.",
        bgClass: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
        badgeClass: "bg-emerald-600 dark:bg-emerald-500",
        borderClass:
            "hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)]",
    },
    {
        icon: <ShieldCheck size={24} />,
        title: "Verify Instantly",
        description:
            "AI cross-references scanned details with CDSCO records to check authenticity.",
        bgClass: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
        badgeClass: "bg-blue-600 dark:bg-blue-500",
        borderClass:
            "hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.15)]",
    },
    {
        icon: <BellRing size={24} />,
        title: "Check Alerts",
        description:
            "Get real-time safety alerts if the batch is recalled, banned, or substandard.",
        bgClass: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
        badgeClass: "bg-amber-600 dark:bg-amber-500",
        borderClass:
            "hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)]",
    },
    {
        icon: <MapPin size={24} />,
        title: "Find Pharmacies",
        description:
            "Locate Jan Aushadhi stores and verified nearby pharmacies stocking real medicines.",
        bgClass: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
        badgeClass: "bg-purple-600 dark:bg-purple-500",
        borderClass:
            "hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.15)]",
    },
    {
        icon: <Shield size={24} />,
        title: "Stay Protected",
        description:
            "Keep records of your scans, report fakes, and safeguard your family's health.",
        bgClass: "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400",
        badgeClass: "bg-rose-600 dark:bg-rose-500",
        borderClass:
            "hover:border-rose-300 dark:hover:border-rose-800 hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.15)]",
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
                            href="/scan"
                            className="rounded-2xl bg-emerald-600 px-7 py-4 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-700"
                        >
                            Start Scanning
                        </Link>

                        <Link
                            href="/map"
                            className="rounded-2xl border border-(--color-border-muted) px-7 py-4 font-semibold text-(--color-text-secondary) transition-all duration-300 hover:border-emerald-500 hover:text-emerald-600"
                        >
                            Explore Pharmacy Map
                        </Link>
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="relative overflow-hidden px-6 py-10">
                <h2 className="sr-only">How It Works Steps</h2>
                <div className="relative mx-auto max-w-6xl">
                    {/* Desktop Connected Path */}
                    <div className="absolute top-[52px] right-[10%] left-[10%] z-0 hidden h-[2px] bg-gradient-to-r from-emerald-500/30 via-purple-500/30 to-rose-500/30 md:block" />

                    <div className="no-scrollbar relative z-10 flex snap-x snap-mandatory flex-row gap-6 overflow-x-auto pb-6 md:grid md:grid-cols-5 md:gap-6 md:overflow-x-visible md:pb-0">
                        {timelineSteps.map((step, index) => (
                            <div
                                key={index}
                                className="group relative min-w-[250px] flex-shrink-0 snap-start sm:min-w-[280px] md:min-w-0"
                            >
                                <div
                                    className={`flex h-full flex-col items-center rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 text-center shadow-xs transition-all duration-500 hover:-translate-y-2 hover:shadow-xl active:scale-[0.99] ${step.borderClass}`}
                                >
                                    {/* Icon Container with Floating Number Badge */}
                                    <div
                                        className={`relative mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${step.bgClass}`}
                                    >
                                        {step.icon}
                                        <span
                                            className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md ${step.badgeClass}`}
                                        >
                                            {index + 1}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="mb-2 text-base font-extrabold text-(--color-text-primary) md:text-lg">
                                        {step.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-xs leading-relaxed text-(--color-text-secondary) md:text-sm">
                                        {step.description}
                                    </p>
                                </div>
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
                            href="/scan"
                            className="rounded-2xl bg-white px-8 py-4 font-bold text-emerald-700 transition-transform duration-300 hover:scale-105"
                        >
                            Scan Medicine
                        </Link>

                        <Link
                            href="/alerts"
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
