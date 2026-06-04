"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, HelpCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { useTranslations } from "next-intl";

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const t = useTranslations("Faq");

    const toggle = (i: number) => {
        setOpenIndex(openIndex === i ? null : i);
    };

    return (
        <div className="min-h-screen bg-(--color-surface-muted) font-sans text-(--color-text-primary) transition-colors duration-300">
            <PageHeader backHref="/" variant="light" />
            {/* Hero */}
            <section className="border-b border-(--color-border-muted) bg-(--color-surface-page) transition-colors duration-300">
                <div className="container mx-auto max-w-4xl space-y-6 px-4 py-16 text-center md:py-24">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badge")}
                    </div>
                    <h1 className="text-4xl leading-[1.1] font-black tracking-tight text-(--color-text-primary) md:text-6xl">
                        {t("title")}{" "}
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {t("title_highlight")}
                        </span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-(--color-text-secondary)">
                        {t("subtitle")}
                    </p>
                </div>
            </section>

            {/* FAQ List */}
            <section className="container mx-auto max-w-4xl px-4 py-16">
                <div className="space-y-4">
                    {["0", "1", "2", "3", "4", "5", "6", "7"].map((key, i) => (
                        <div
                            key={i}
                            className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md active:scale-[0.998]"
                        >
                            <button
                                onClick={() => toggle(i)}
                                id={`faq-question-${i}`}
                                aria-expanded={openIndex === i}
                                aria-controls={`faq-answer-${i}`}
                                className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors duration-200 hover:bg-emerald-500/[0.01]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <HelpCircle size={16} strokeWidth={2.5} />
                                    </div>
                                    <span className="font-bold text-(--color-text-primary)">
                                        {t(`items.${key}.question`)}
                                    </span>
                                </div>
                                <div className="ml-4 shrink-0 text-(--color-text-muted)">
                                    {openIndex === i ? (
                                        <ChevronUp size={20} />
                                    ) : (
                                        <ChevronDown size={20} />
                                    )}
                                </div>
                            </button>
                            {openIndex === i && (
                                <div
                                    id={`faq-answer-${i}`}
                                    role="region"
                                    aria-labelledby={`faq-question-${i}`}
                                    className="border-t border-(--color-border-muted) px-6 pt-4 pb-5 text-sm leading-relaxed font-medium text-(--color-text-secondary)"
                                >
                                    {t(`items.${key}.answer`)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Still have questions CTA */}
            <section className="container mx-auto max-w-4xl px-4 pb-16">
                <div className="relative overflow-hidden rounded-3xl bg-emerald-600 p-8 text-center text-white">
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-700 to-emerald-500" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                                <ShieldCheck size={28} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black md:text-3xl">{t("cta.title")}</h2>
                        <p className="mx-auto max-w-md font-medium text-emerald-100">
                            {t("cta.subtitle")}
                        </p>
                        <Link href="/contact">
                            <button className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 dark:bg-slate-900 dark:text-emerald-400">
                                {t("cta.button")}
                            </button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
