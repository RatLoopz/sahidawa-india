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
} from "lucide-react";
// Locale-aware Link (not next/link) so CTAs preserve the active locale.
// Hardcoded "/en/" hrefs were removed and this import was fixed in
// commit 8359882 / PR #918 ("fix(web): use i18n routing link and remove
// hardcoded locale in how-it-works"). Hrefs below are intentionally relative.
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

const steps = [
    {
        icon: <ShieldCheck size={34} />,
        titleKey: "features.cards.verifyMedicines.title",
        descriptionKey: "features.cards.verifyMedicines.description",
    },
    {
        icon: <Search size={34} />,
        titleKey: "features.cards.scanOrSearch.title",
        descriptionKey: "features.cards.scanOrSearch.description",
    },
    {
        icon: <Bot size={34} />,
        titleKey: "features.cards.aiAssistant.title",
        descriptionKey: "features.cards.aiAssistant.description",
    },
    {
        icon: <Store size={34} />,
        titleKey: "features.cards.trustedPharmacies.title",
        descriptionKey: "features.cards.trustedPharmacies.description",
    },
    {
        icon: <BellRing size={34} />,
        titleKey: "features.cards.cdscoAlerts.title",
        descriptionKey: "features.cards.cdscoAlerts.description",
    },
    {
        icon: <AlertTriangle size={34} />,
        titleKey: "features.cards.reportMedicines.title",
        descriptionKey: "features.cards.reportMedicines.description",
    },
];

const timelineSteps = [
    {
        icon: <QrCode size={24} />,
        titleKey: "steps.scan.title",
        descriptionKey: "steps.scan.description",
        bgClass: "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50",
        badgeClass: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20",
    },
    {
        icon: <ShieldCheck size={24} />,
        titleKey: "steps.verify.title",
        descriptionKey: "steps.verify.description",
        bgClass: "bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50",
        badgeClass: "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/20",
    },
    {
        icon: <BellRing size={24} />,
        titleKey: "steps.alerts.title",
        descriptionKey: "steps.alerts.description",
        bgClass: "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50",
        badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20",
    },
    {
        icon: <MapPin size={24} />,
        titleKey: "steps.pharmacies.title",
        descriptionKey: "steps.pharmacies.description",
        bgClass: "bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/20 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/50",
        badgeClass: "bg-gradient-to-r from-purple-500 to-fuchsia-500 shadow-purple-500/20",
    },
    {
        icon: <Shield size={24} />,
        titleKey: "steps.protect.title",
        descriptionKey: "steps.protect.description",
        bgClass: "bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-800/20 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/50",
        badgeClass: "bg-gradient-to-r from-rose-500 to-red-500 shadow-rose-500/20",
    },
];

const timelineContainerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.15,
        },
    },
};

const timelineCardVariants = {
    hidden: {
        opacity: 0,
        y: 20,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
        },
    },
};

export default function HowItWorksPage() {
    const t = useTranslations("howItWorks");
    return (
        <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-emerald-500/[0.02] to-slate-50 text-(--color-text-primary) dark:from-slate-950 dark:via-emerald-500/[0.02] dark:to-slate-950">
            <PageHeader backHref="/" variant="light" />
            
            {/* Background ambient mesh */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-[100%] bg-emerald-500/10 blur-[120px] dark:bg-emerald-500/10" />
                <div className="absolute top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-500/10" />
                <div className="absolute top-20 -right-40 h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[120px] dark:bg-teal-500/10" />
            </div>

            {/* Hero Section */}
            <section className="relative px-6 pt-24 pb-12 lg:pt-32 lg:pb-16">
                <div className="relative mx-auto max-w-5xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-700 shadow-sm backdrop-blur-md dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            {t("badge")}
                        </div>

                        <h1 className="text-4xl leading-[1.1] font-black tracking-tight text-(--color-text-primary) sm:text-5xl md:text-6xl">
                            {t.rich("heroTitle", {
                                highlight: (chunks) => (
                                    <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
                                        {chunks}
                                    </span>
                                ),
                            })}
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-(--color-text-secondary) sm:text-lg">
                            {t("heroSubtitle")}
                        </p>

                        {/* CTA Buttons */}
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                href="/scan"
                                className="group relative flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98]"
                            >
                                <span>{t("ctaButtons.scan")}</span>
                                <QrCode size={18} className="transition-transform duration-300 group-hover:scale-110" />
                            </Link>

                            <Link
                                href="/map"
                                className="group flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/50 px-6 py-3 text-base font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-emerald-50/50 hover:text-emerald-700 hover:shadow-md active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                            >
                                <span>{t("ctaButtons.map")}</span>
                                <MapPin size={18} className="transition-transform duration-300 group-hover:scale-110" />
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="relative overflow-hidden px-6 py-6">
                <h2 className="sr-only">How It Works Steps</h2>
                <div className="relative mx-auto max-w-6xl">
                    {/* Desktop Connected Path */}
                    <motion.div
                        className="no-scrollbar relative z-10 flex snap-x snap-mandatory flex-row gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:gap-5 md:overflow-x-visible md:pb-0 lg:grid-cols-5"
                        variants={timelineContainerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        {timelineSteps.map((step, index) => (
                            <motion.div
                                key={index}
                                variants={timelineCardVariants}
                                className="w-[calc(100%-3rem)] max-w-xs flex-shrink-0 snap-center md:w-auto md:max-w-none"
                            >
                                <div
                                    className="group relative flex h-full flex-col rounded-3xl border border-slate-200/60 bg-white/60 p-5 text-left shadow-md shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10 active:scale-[0.99] dark:border-slate-800/60 dark:bg-slate-900/60 dark:shadow-none"
                                >
                                    {/* Subtle gradient overlay on hover */}
                                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/5" />
                                    
                                    <div className="relative z-10">
                                        {/* Icon Container with Floating Number Badge */}
                                        <div
                                            className={`relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border shadow-inner transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105 ${step.bgClass}`}
                                        >
                                            {step.icon}
                                            <span
                                                className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${step.badgeClass}`}
                                            >
                                                {index + 1}
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3 className="mb-1.5 text-base font-bold tracking-tight text-(--color-text-primary)">
                                            {t(step.titleKey)}
                                        </h3>

                                        {/* Description */}
                                        <p className="text-xs leading-relaxed text-(--color-text-secondary)">
                                            {t(step.descriptionKey)}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="px-6 py-12 lg:py-16">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-(--color-text-primary) sm:text-4xl">
                            {t("features.title")}
                        </h2>

                        <p className="mx-auto mt-4 max-w-2xl text-base text-(--color-text-secondary)">
                            {t("features.subtitle")}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10 active:scale-[0.99] dark:border-slate-800/60 dark:bg-slate-900/60"
                            >
                                {/* Subtle shimmer effect */}
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-1000 group-hover:translate-x-full group-hover:opacity-100 dark:via-white/10" />

                                <div className="relative z-10">
                                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600 shadow-inner ring-1 ring-emerald-200/50 transition-transform duration-300 group-hover:scale-110 dark:from-emerald-900/40 dark:to-teal-900/20 dark:text-emerald-400 dark:ring-emerald-800/50">
                                        {step.icon}
                                    </div>

                                    <h3 className="mb-2 text-xl font-bold tracking-tight text-(--color-text-primary)">
                                        {t(step.titleKey)}
                                    </h3>

                                    <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                                        {t(step.descriptionKey)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="px-6 pb-16 lg:pb-20">
                <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-8 text-center text-white shadow-xl sm:p-12">
                    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/20 inset-ring inset-ring-white/10" />

                    {/* Decorative Background Elements */}
                    <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full border border-white/10 bg-white/5 blur-xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full border border-white/10 bg-white/5 blur-xl" />
                    
                    <div className="relative z-10">
                        <h2 className="mb-4 text-3xl font-black tracking-tight sm:text-4xl">{t("ctaBanner.title")}</h2>

                        <p className="mx-auto max-w-xl text-base leading-relaxed text-emerald-50 sm:text-lg">
                            {t("ctaBanner.subtitle")}
                        </p>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                href="/scan"
                                className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-700 shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-900/20 active:scale-[0.98]"
                            >
                                <span>{t("ctaBanner.buttons.scan")}</span>
                                <QrCode size={16} />
                            </Link>

                            <Link
                                href="/alerts"
                                className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/50 hover:bg-white/20 active:scale-[0.98]"
                            >
                                <span>{t("ctaBanner.buttons.alerts")}</span>
                                <BellRing size={16} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
