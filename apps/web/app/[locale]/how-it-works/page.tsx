"use client";

import {
    ShieldCheck,
    Search,
    Bot,
    Store,
    BellRing,
    AlertTriangle,
    QrCode,
    MapPin,
    Shield,
    FileText,
    Lock,
    Globe,
    CheckCircle2
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import SafetyStatsBanner from "@/components/SafetyStatsBanner";

const processSteps = [
    {
        num: "01",
        title: "Scan",
        desc: "Scan a barcode, QR code, or medicine packaging.",
        icon: <QrCode size={20} />
    },
    {
        num: "02",
        title: "Check",
        desc: "SahiDawa checks available medicine and regulatory information.",
        icon: <Search size={20} />
    },
    {
        num: "03",
        title: "Alerts",
        desc: "See recalls, warnings, or safety alerts.",
        icon: <BellRing size={20} />
    },
    {
        num: "04",
        title: "Find Care",
        desc: "Locate trusted pharmacies and nearby healthcare resources.",
        icon: <MapPin size={20} />
    },
    {
        num: "05",
        title: "Stay Informed",
        desc: "Keep your verification history and safety information accessible.",
        icon: <Shield size={20} />
    }
];

const primaryFeatures = [
    {
        icon: <ShieldCheck size={24} />,
        title: "Verify Medicines",
        desc: "Cross-reference medicine details against available regulatory data.",
    },
    {
        icon: <Search size={24} />,
        title: "Scan or Search",
        desc: "Scan packaging or manually search medicines for trusted healthcare information.",
    },
    {
        icon: <Bot size={24} />,
        title: "AI Health Assistant",
        desc: "Get AI-powered guidance for symptoms, precautions, and medicine usage.",
    }
];

const secondaryFeatures = [
    {
        icon: <Store size={24} />,
        title: "Trusted Pharmacies",
        desc: "Find verified pharmacies nearby with reliable medicine availability.",
    },
    {
        icon: <BellRing size={24} />,
        title: "CDSCO Alerts",
        desc: "Stay updated with official medicine recalls, warnings, and health alerts.",
    },
    {
        icon: <AlertTriangle size={24} />,
        title: "Report Suspicious Medicines",
        desc: "Help the community by reporting counterfeit or suspicious medicines instantly.",
    }
];

const trustPrinciples = [
    {
        icon: <FaGithub size={24} />,
        title: "Open Source",
        desc: "Transparent development and community contributions."
    },
    {
        icon: <FileText size={24} />,
        title: "Regulatory Awareness",
        desc: "Medicine information and alerts are connected to available official/regulatory sources."
    },
    {
        icon: <Lock size={24} />,
        title: "Privacy First",
        desc: "We do not sell user health data or expose sensitive information."
    },
    {
        icon: <Globe size={24} />,
        title: "Designed for India",
        desc: "Lightweight, multilingual and accessibility-conscious."
    }
];

export default function HowItWorksPage() {
    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <PageHeader backHref="/" variant="light" />
            
            {/* Hero Section */}
            <section className="px-6 pt-16 pb-12 lg:pt-24 lg:pb-16 text-center">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        Safe Healthcare Platform
                    </div>

                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl dark:text-white">
                        How <span className="text-emerald-600 dark:text-emerald-400">SahiDawa</span> Works
                    </h1>

                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
                        Scan medicines, check available regulatory information, receive safety alerts, and find trusted pharmacies — all from one place.
                    </p>

                    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                            href="/scan"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                        >
                            <span>Scan a Medicine</span>
                            <QrCode size={18} />
                        </Link>
                        <Link
                            href="/map"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <span>Find a Pharmacy</span>
                            <MapPin size={18} />
                        </Link>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500 sm:gap-6 dark:text-slate-500">
                        <span className="flex items-center gap-1.5"><FaGithub size={14} /> Open Source</span>
                        <span className="flex items-center gap-1.5"><MapPin size={14} /> Built for India</span>
                        <span className="flex items-center gap-1.5"><Lock size={14} /> Privacy First</span>
                    </div>
                </div>
            </section>

            {/* Process Timeline Section */}
            <section className="border-t border-slate-200/60 bg-white px-6 py-16 dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="mx-auto max-w-6xl">
                    <h2 className="sr-only">How it Works Journey</h2>
                    
                    {/* Desktop Horizontal Timeline */}
                    <div className="hidden lg:flex items-start justify-between relative">
                        <div className="absolute top-6 left-6 right-6 h-[2px] bg-slate-100 dark:bg-slate-800" />
                        
                        {processSteps.map((step, idx) => (
                            <div key={idx} className="relative z-10 flex w-48 flex-col items-center text-center group">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-emerald-700 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 dark:border-slate-900 dark:bg-emerald-900/40 dark:text-emerald-400">
                                    {step.icon}
                                </div>
                                <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-1 dark:text-slate-500">
                                    {step.num}
                                </div>
                                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Mobile Vertical Timeline */}
                    <div className="lg:hidden flex flex-col gap-8 relative pl-6">
                        <div className="absolute top-2 bottom-2 left-[34px] w-[2px] bg-slate-100 dark:bg-slate-800" />
                        
                        {processSteps.map((step, idx) => (
                            <div key={idx} className="relative z-10 flex items-start gap-4 group">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-emerald-700 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 dark:border-slate-900 dark:bg-emerald-900/40 dark:text-emerald-400">
                                    {step.icon}
                                </div>
                                <div className="pt-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase dark:text-slate-500">{step.num}</span>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{step.title}</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Platform Features Section */}
            <section className="px-6 py-16 lg:py-24 bg-slate-50 dark:bg-slate-950">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-12 md:text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                            Platform Features
                        </h2>
                        <p className="mt-3 text-base text-slate-600 dark:text-slate-400 md:mx-auto md:max-w-2xl">
                            Everything you need to make safer healthcare decisions.
                        </p>
                    </div>

                    {/* Primary Features */}
                    <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                        {primaryFeatures.map((feature, idx) => (
                            <div
                                key={idx}
                                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
                            >
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:group-hover:bg-emerald-900/40">
                                    {feature.icon}
                                </div>
                                <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                                    {feature.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Secondary Features */}
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {secondaryFeatures.map((feature, idx) => (
                            <div
                                key={idx}
                                className="group flex flex-col rounded-2xl border border-slate-200/60 bg-white/50 p-6 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                            >
                                <div className="mb-4 inline-flex items-center gap-3">
                                    <div className="text-slate-500 dark:text-slate-400">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                        {feature.title}
                                    </h3>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Live Data Proof Section */}
            <section className="px-6 py-16 lg:py-24">
                <SafetyStatsBanner />
            </section>

            {/* Trust / Safety Section */}
            <section className="border-t border-slate-200/60 bg-white px-6 py-16 lg:py-24 dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-12 md:text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                            Built Around Safety, Transparency & Access
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {trustPrinciples.map((principle, idx) => (
                            <div key={idx} className="flex flex-col items-start md:items-center md:text-center">
                                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {principle.icon}
                                </div>
                                <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                                    {principle.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {principle.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="px-6 py-12 lg:py-16">
                <div className="mx-auto max-w-4xl rounded-2xl bg-emerald-800 p-8 text-center text-white shadow-lg sm:p-12 dark:bg-emerald-900">
                    <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Check Before You Trust.</h2>
                    <p className="mx-auto mb-8 max-w-xl text-sm text-emerald-100 sm:text-base">
                        Verify medicine information, check safety alerts, and find trusted healthcare resources with SahiDawa.
                    </p>

                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                            href="/scan"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                            <span>Scan Medicine</span>
                            <QrCode size={16} />
                        </Link>
                        <Link
                            href="/alerts"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-700/50 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                            <span>View Safety Alerts</span>
                            <BellRing size={16} />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
