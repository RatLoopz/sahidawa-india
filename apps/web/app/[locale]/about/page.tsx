"use client";

import {
    ShieldCheck,
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
import { useTranslations } from "next-intl";
import { PageHeader } from "../components/PageHeader";

export default function AboutPage() {
    const t = useTranslations("about");
    return (
        <div className="min-h-screen bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            <PageHeader backHref="/" variant="light" hideBackButton />
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) bg-(--color-surface-page)">
                <div className="container mx-auto max-w-6xl space-y-6 px-4 py-16 text-center md:py-24">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badge")}
                    </div>
                    <h1 className="text-4xl leading-[1.1] font-black tracking-tight text-(--color-text-primary) md:text-6xl">
                        {t.rich("heroTitle", {
                            highlight: (chunks) => (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    {chunks}
                                </span>
                            ),
                        })}
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-(--color-text-secondary) md:text-xl">
                        {t("heroSubtitle")}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-(--color-surface-muted) px-3 py-1.5 text-sm font-semibold text-(--color-text-secondary)">
                            <Lock size={14} /> {t("features.free")}
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-(--color-surface-muted) px-3 py-1.5 text-sm font-semibold text-(--color-text-secondary)">
                            <Globe size={14} /> {t("features.languages")}
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <Star size={14} /> {t("features.license")}
                        </span>
                    </div>
                </div>
            </section>

            {/* Problem */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="mb-12 text-center">
                    <h2 className="mb-4 flex items-center justify-center gap-2 text-3xl font-black text-(--color-text-primary) md:text-4xl">
                        <AlertTriangle className="h-8 w-8 text-red-500" />{" "}
                        {t("problemSection.title")}
                    </h2>
                    <p className="mx-auto max-w-2xl font-medium text-(--color-text-secondary)">
                        {t("problemSection.description")}
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {[
                        {
                            icon: <AlertTriangle size={28} strokeWidth={2.5} />,
                            color: "red",
                            title: `${t("cards.fakeMedicines.title")}`,
                            desc: `${t("cards.fakeMedicines.description")}`,
                        },
                        {
                            icon: <MapPin size={28} strokeWidth={2.5} />,
                            color: "amber",
                            title: `${t("cards.ruralHealthcare.title")}`,
                            desc: `${t("cards.ruralHealthcare.description")}`,
                        },
                        {
                            icon: <Mic size={28} strokeWidth={2.5} />,
                            color: "blue",
                            title: `${t("cards.languageBarrier.title")}`,
                            desc: `${t("cards.languageBarrier.description")}`,
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="group rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg active:scale-[0.99]"
                        >
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-surface-muted) text-(--color-text-secondary) transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white">
                                {item.icon}
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-(--color-text-primary)">
                                {item.title}
                            </h3>
                            <p className="text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Incident box */}
                <div className="mt-8 rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-8 dark:border-orange-900/30 dark:bg-orange-950/20">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-950/40 dark:text-orange-400">
                            <AlertTriangle size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h4 className="mb-1 font-bold text-(--color-text-primary)">
                                {t("realIncident.title")}
                            </h4>
                            <p className="text-sm leading-relaxed font-medium text-(--color-text-secondary)">
                                {t.rich("realIncident.text", {
                                    highlight: (chunks) => (
                                        <span className="font-bold text-orange-600 dark:text-orange-400">
                                            {chunks}
                                        </span>
                                    ),
                                })}
                            </p>
                            <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {t("realIncident.highlight")}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="border-y border-(--color-border-muted) bg-(--color-surface-page)">
                <div className="container mx-auto max-w-6xl px-4 py-16">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-8 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                                <ShieldCheck size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="mb-3 text-2xl font-black text-(--color-text-primary)">
                                {t("mission.title")}
                            </h3>
                            <p className="leading-relaxed font-medium text-(--color-text-secondary)">
                                {t("mission.description")}
                            </p>
                        </div>
                        <div className="rounded-3xl bg-slate-900 p-8">
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                                <Zap size={28} strokeWidth={2.5} />
                            </div>
                            <h3 className="mb-3 text-2xl font-black text-white">
                                {t("vision.title")}
                            </h3>
                            <p className="leading-relaxed font-medium text-slate-300">
                                {t("vision.description")}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Values */}
            <section className="container mx-auto max-w-6xl px-4 py-16">
                <div className="mb-12 text-center">
                    <h2 className="mb-4 text-3xl font-black text-(--color-text-primary) md:text-4xl">
                        {t("coreValues.title")}
                    </h2>
                </div>
                <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
                    {[
                        {
                            icon: <Unlock className="h-10 w-10 text-emerald-500" />,
                            title: `${t("coreValues.cards.openSource.title")}`,
                            desc: `${t("coreValues.cards.openSource.description")}`,
                        },
                        {
                            icon: <BadgeCheck className="h-10 w-10 text-blue-500" />,
                            title: `${t("coreValues.cards.freeForever.title")}`,
                            desc: `${t("coreValues.cards.freeForever.description")}`,
                        },
                        {
                            icon: <Globe className="h-10 w-10 text-purple-500" />,
                            title: `${t("coreValues.cards.inclusive.title")}`,
                            desc: `${t("coreValues.cards.inclusive.description")}`,
                        },
                        {
                            icon: <Lock className="h-10 w-10 text-slate-500" />,
                            title: `${t("coreValues.cards.privacy.title")}`,
                            desc: `${t("coreValues.cards.privacy.description")}`,
                        },
                    ].map((v, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6"
                        >
                            <div className="mb-3 flex justify-center">{v.icon}</div>
                            <h3 className="mb-1 font-bold text-(--color-text-primary)">
                                {v.title}
                            </h3>
                            <p className="text-sm font-medium text-(--color-text-secondary)">
                                {v.desc}
                            </p>
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
                        <h2 className="text-3xl font-black md:text-4xl">{t("contactUs.title")}</h2>
                        <p className="mx-auto max-w-xl font-medium text-emerald-100">
                            {t("contactUs.subtitle")}
                        </p>
                        <div className="pt-2">
                            <Link href="/contact">
                                <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl dark:bg-slate-900 dark:text-emerald-400">
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
