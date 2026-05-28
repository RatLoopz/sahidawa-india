"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, HelpCircle } from "lucide-react";
import { Link } from "@/i18n/routing";

export default function FAQPage() {
    const t = useTranslations("faq");

    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs = [
        {
            question: t("q1Question"),
            answer: t("q1Answer"),
        },
        {
            question: t("q2Question"),
            answer: t("q2Answer"),
        },
        {
            question: t("q3Question"),
            answer: t("q3Answer"),
        },
        {
            question: t("q4Question"),
            answer: t("q4Answer"),
        },
        {
            question: t("q5Question"),
            answer: t("q5Answer"),
        },
        {
            question: t("q6Question"),
            answer: t("q6Answer"),
        },
        {
            question: t("q7Question"),
            answer: t("q7Answer"),
        },
        {
            question: t("q8Question"),
            answer: t("q8Answer"),
        },
    ];

    const toggle = (i: number) => {
        setOpenIndex(openIndex === i ? null : i);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

            {/* Hero */}
            <section className="bg-white border-b border-slate-200">
                <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24 text-center space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        {t("badgeText")}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
                        {t("heroTitle")}
                    </h1>

                    <p className="mx-auto max-w-2xl text-lg text-slate-500 font-medium leading-relaxed">
                        {t("heroSubtitle")}
                    </p>
                </div>
            </section>

            {/* FAQ List */}
            <section className="container mx-auto max-w-4xl px-4 py-16">
                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
                        >
                            <button
                                onClick={() => toggle(i)}
                                className="w-full flex items-center justify-between px-6 py-5 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <HelpCircle size={16} strokeWidth={2.5} />
                                    </div>

                                    <span className="font-bold text-slate-800">
                                        {faq.question}
                                    </span>
                                </div>

                                <div className="shrink-0 ml-4 text-slate-400">
                                    {openIndex === i ? (
                                        <ChevronUp size={20} />
                                    ) : (
                                        <ChevronDown size={20} />
                                    )}
                                </div>
                            </button>

                            {openIndex === i && (
                                <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed font-medium border-t border-slate-100 pt-4">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="container mx-auto max-w-4xl px-4 pb-16">
                <div className="rounded-3xl bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-emerald-500 z-0" />

                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                                <ShieldCheck size={28} strokeWidth={2} />
                            </div>
                        </div>

                        <h2 className="text-2xl md:text-3xl font-black">
                            {t("ctaTitle")}
                        </h2>

                        <p className="text-emerald-100 font-medium max-w-md mx-auto">
                            {t("ctaSubtitle")}
                        </p>

                        <Link href="/contact">
                            <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-emerald-600 shadow-lg hover:scale-105 transition-all duration-200 mt-2">
                                {t("contactButton")}
                            </button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}