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
    },
    {
        icon: <ShieldCheck size={24} />,
        titleKey: "steps.verify.title",
        descriptionKey: "steps.verify.description",
    },
    {
        icon: <BellRing size={24} />,
        titleKey: "steps.alerts.title",
        descriptionKey: "steps.alerts.description",
    },
    {
        icon: <MapPin size={24} />,
        titleKey: "steps.pharmacies.title",
        descriptionKey: "steps.pharmacies.description",
    },
    {
        icon: <Shield size={24} />,
        titleKey: "steps.protect.title",
        descriptionKey: "steps.protect.description",
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
        <main className="min-h-screen overflow-x-hidden bg-slate-50 text-(--color-text-primary) dark:bg-slate-950">
            <PageHeader backHref="/" variant="light" />

            {/* Hero Section */}
            <section className="relative px-6 pt-24 pb-12 lg:pt-32 lg:pb-16">
                <div className="mx-auto max-w-4xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                            {t("badge")}
                        </div>

                        <h1 className="text-4xl font-extrabold tracking-tight text-(--color-text-primary) sm:text-5xl md:text-6xl">
                            {t.rich("heroTitle", {
                                highlight: (chunks) => (
                                    <span className="text-emerald-600 dark:text-emerald-400">
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
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                            >
                                <span>{t("ctaButtons.scan")}</span>
                                <QrCode size={18} />
                            </Link>

                            <Link
                                href="/map"
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span>{t("ctaButtons.map")}</span>
                                <MapPin size={18} className="transition-transform duration-300 group-hover:scale-110" />
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Timeline Section */}
            <section className="px-6 py-8">
                <h2 className="sr-only">How It Works Steps</h2>
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        className="no-scrollbar flex snap-x snap-mandatory flex-row gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:gap-5 md:overflow-x-visible md:pb-0 lg:grid-cols-5"
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
                                    className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900"
                                >
                                    <div className="relative z-10">
                                        <div
                                            className="relative mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800/50"
                                        >
                                            {step.icon}
                                            <span
                                                className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow-sm dark:bg-slate-700"
                                            >
                                                {index + 1}
                                            </span>
                                        </div>

                                        <h3 className="mb-1.5 text-sm font-bold text-(--color-text-primary)">
                                            {t(step.titleKey)}
                                        </h3>

                                        <p className="text-xs text-(--color-text-secondary)">
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
                        <h2 className="text-2xl font-bold text-(--color-text-primary) sm:text-3xl">
                            {t("features.title")}
                        </h2>

                        <p className="mx-auto mt-3 max-w-2xl text-sm text-(--color-text-secondary)">
                            {t("features.subtitle")}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {step.icon}
                                </div>

                                <h3 className="mb-2 text-base font-bold text-(--color-text-primary)">
                                    {t(step.titleKey)}
                                </h3>

                                <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                                    {t(step.descriptionKey)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="px-6 pb-16 lg:pb-20">
                <div className="mx-auto max-w-4xl rounded-2xl bg-emerald-900 p-8 text-center text-white sm:p-12">
                    <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t("ctaBanner.title")}</h2>
                    <p className="mx-auto mb-8 max-w-xl text-sm text-emerald-100 sm:text-base">
                        {t("ctaBanner.subtitle")}
                    </p>

                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                            href="/scan"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
                        >
                            <span>{t("ctaBanner.buttons.scan")}</span>
                            <QrCode size={16} />
                        </Link>

                        <Link
                            href="/alerts"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-800/50 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                        >
                            <span>{t("ctaBanner.buttons.alerts")}</span>
                            <BellRing size={16} />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
