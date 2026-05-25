"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, HelpCircle } from "lucide-react";
import { Link } from "@/i18n/routing";

const faqs = [
    {
        question: "What is SahiDawa?",
        answer: "SahiDawa is India's first open-source citizen medicine verification platform. It helps you verify if your medicine is real or fake, find safe pharmacies nearby, and get health guidance in your language.",
    },
    {
        question: "Is SahiDawa free to use?",
        answer: "Yes! SahiDawa is 100% free forever. No ads, no premium plan, no data sold. Ever. It is built for Bharat, by the community.",
    },
    {
        question: "How does medicine verification work?",
        answer: "You can scan the barcode or QR code on your medicine packaging. SahiDawa checks it against the official CDSCO database and tells you if the medicine is real, suspicious, or fake.",
    },
    {
        question: "Which languages does SahiDawa support?",
        answer: "SahiDawa supports 22 official Indian languages. You can speak your symptoms in your own language using our Voice Health Assistant powered by Whisper and Sarvam AI.",
    },
    {
        question: "How can I report a fake medicine?",
        answer: "You can use the 'Report Fake' feature on the homepage. Your report gets added to a community heatmap that helps alert others in your district about counterfeit medicines.",
    },
    {
        question: "Is my data safe with SahiDawa?",
        answer: "Absolutely. SahiDawa does not sell your data, show ads, or have any premium plan. Your privacy is our top priority.",
    },
    {
        question: "How can I contribute to SahiDawa?",
        answer: "SahiDawa is open source under MIT License. You can contribute on GitHub, report bugs, suggest features, or join as a GSSoC 2026 participant.",
    },
    {
        question: "What is CDSCO?",
        answer: "CDSCO stands for Central Drugs Standard Control Organisation. It is India's national regulatory body for cosmetics, pharmaceuticals and medical devices. SahiDawa verifies medicines against their official database.",
    },
];

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (i: number) => {
        setOpenIndex(openIndex === i ? null : i);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 transition-colors duration-300">

            {/* Hero */}
            <section className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
                <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24 text-center space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                        Frequently Asked <span className="text-emerald-600 dark:text-emerald-500">Questions</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Everything you need to know about SahiDawa — India's free, open-source medicine verification platform.
                    </p>
                </div>
            </section>

            {/* FAQ List */}
            <section className="container mx-auto max-w-4xl px-4 py-16">
                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md dark:hover:shadow-slate-800/50"
                        >
                            <button
                                onClick={() => toggle(i)}
                                className="w-full flex items-center justify-between px-6 py-5 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        <HelpCircle size={16} strokeWidth={2.5} />
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{faq.question}</span>
                                </div>
                                <div className="shrink-0 ml-4 text-slate-400 dark:text-slate-500">
                                    {openIndex === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </button>
                            {openIndex === i && (
                                <div className="px-6 pb-5 text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium border-t border-slate-100 dark:border-slate-800 pt-4">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Still have questions CTA - (Left this mostly alone since it's already a dark green box, but adjusted the button slightly for dark mode contrast) */}
            <section className="container mx-auto max-w-4xl px-4 pb-16">
                <div className="rounded-3xl bg-emerald-600 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-700 to-emerald-500 z-0" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                                <ShieldCheck size={28} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black">Still have questions?</h2>
                        <p className="text-emerald-100 font-medium max-w-md mx-auto">
                            Can't find the answer you're looking for? Reach out to our community.
                        </p>
                        <Link href="/contact">
                            <button className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-8 py-3.5 text-base font-bold text-emerald-600 dark:text-emerald-400 shadow-lg hover:scale-105 transition-all duration-200 mt-2">
                                Contact Us
                            </button>
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    );
}