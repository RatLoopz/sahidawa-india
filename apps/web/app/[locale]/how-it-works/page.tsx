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
        <main className="min-h-screen overflow-hidden bg-gradient-to-b from-white via-emerald-50/30 to-white">
            {/* Hero Section */}
            <section className="relative px-6 pt-24 pb-20">
                {/* Glow Effects */}
                <div className="absolute top-10 left-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />

                <div className="relative mx-auto max-w-6xl text-center">
                    <Link
                        href="/"
                        aria-label="Back to Home"
                        className="absolute left-6 top-6 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 shadow-sm transition-all duration-300 hover:bg-slate-200 hover:scale-105"
                    >
                        <ArrowLeft size={22} className="text-slate-600" />
                    </Link>
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Safe Healthcare • AI Powered
                    </div>

                    <h1 className="text-5xl leading-tight font-black tracking-tight text-slate-900 md:text-7xl">
                        How <span className="text-emerald-600">SahiDawa</span> Works
                    </h1>

                    <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 md:text-xl">
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
                            className="rounded-2xl border border-slate-300 px-7 py-4 font-semibold transition-all duration-300 hover:border-emerald-500 hover:text-emerald-600"
                        >
                            Explore Pharmacy Map
                        </Link>
                    </div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="px-6 py-10">
                <div className="mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                        {[
                            "Scan Medicine",
                            "Verify Instantly",
                            "Check Alerts",
                            "Find Pharmacies",
                            "Stay Protected",
                        ].map((item, index) => (
                            <div
                                key={index}
                                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                            >
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-600">
                                    {index + 1}
                                </div>

                                <h3 className="text-lg font-bold text-slate-900">{item}</h3>

                                {index !== 4 && (
                                    <ArrowRight
                                        className="absolute top-1/2 -right-5 hidden -translate-y-1/2 text-emerald-400 md:block"
                                        size={28}
                                    />
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
                        <h2 className="text-4xl font-bold text-slate-900">Platform Features</h2>

                        <p className="mt-4 text-lg text-slate-600">
                            Everything you need for safer healthcare decisions.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="group rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all duration-500 hover:-translate-y-3 hover:border-emerald-300 hover:shadow-2xl"
                            >
                                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                                    {step.icon}
                                </div>

                                <h3 className="mb-4 text-2xl font-bold text-slate-900">
                                    {step.title}
                                </h3>

                                <p className="text-base leading-relaxed text-slate-600">
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
