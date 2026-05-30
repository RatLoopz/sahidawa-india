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
            <PageHeader
                backHref="/"
                variant="light"
            />
            {/* Hero */}
            <section className="bg-(--color-surface-page) border-b border-(--color-border-muted) transition-colors duration-300">
                <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24 text-center space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badge")}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-(--color-text-primary) leading-[1.1]">
                        {t("title")} <span className="text-emerald-600 dark:text-emerald-400">{t("title_highlight")}</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-(--color-text-secondary) font-medium leading-relaxed">
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
                            className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-emerald-500/30 hover:-translate-y-0.5 active:scale-[0.998]"
                        >
                            <button
                                onClick={() => toggle(i)}
                                className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors duration-200 hover:bg-emerald-500/[0.01]"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        <HelpCircle size={16} strokeWidth={2.5} />
                                    </div>
                                    <span className="font-bold text-(--color-text-primary)">{t(`items.${key}.question`)}</span>
                                </div>
                                <div className="shrink-0 ml-4 text-(--color-text-muted)">
                                    {openIndex === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </button>
                            {openIndex === i && (
                                <div className="px-6 pb-5 text-(--color-text-secondary) text-sm leading-relaxed font-medium border-t border-(--color-border-muted) pt-4">
                                    {t(`items.${key}.answer`)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Still have questions CTA */}
            <section className="container mx-auto max-w-4xl px-4 pb-16">
                <div className="rounded-3xl bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-emerald-500 z-0" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                                <ShieldCheck size={28} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black">{t("cta.title")}</h2>
                        <p className="text-emerald-100 font-medium max-w-md mx-auto">
                            {t("cta.subtitle")}
                        </p>
                        <Link href="/contact">
                            <button className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-8 py-3.5 text-base font-bold text-emerald-600 dark:text-emerald-400 shadow-lg hover:scale-105 transition-all duration-200 mt-2">
                                {t("cta.button")}
                            </button>
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    );
}