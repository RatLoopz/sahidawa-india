"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface AftercareGuidanceProps {
    vaccine: VaccineProfile;
}

export function AftercareGuidance({ vaccine }: AftercareGuidanceProps) {
    const t = useTranslations("vaccineHub");
    return (
        <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-(--color-text-primary)">
                <span aria-hidden="true">🩹</span>
                Post-Vaccination Care
            </h3>

            {/* Main Aftercare Instructions */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 dark:border-sky-800 dark:bg-sky-900/20">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-sky-900 uppercase dark:text-sky-100">
                    <HelpCircle size={16} aria-hidden="true" />
                    {t("aftercareHeading")}
                </h4>
                <p className="text-sm leading-relaxed font-medium text-sky-900 dark:text-sky-100">
                    {vaccine.aftercare_text}
                </p>
            </div>

            {/* General Care Tips */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <h4 className="mb-3 text-sm font-bold tracking-wide text-(--color-text-primary) uppercase dark:text-white">
                    General Care Guidelines
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <span aria-hidden="true">✓</span>
                            Do
                        </h5>
                        <ul className="space-y-2 text-sm text-(--color-text-secondary)">
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Keep the injection site clean and dry</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Drink plenty of fluids to stay hydrated</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Get adequate rest and sleep</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Use cool compresses on the injection site</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Take over-the-counter pain relievers if needed</span>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h5 className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-200">
                            <span aria-hidden="true">✗</span>
                            Avoid
                        </h5>
                        <ul className="space-y-2 text-sm text-(--color-text-secondary)">
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Strenuous exercise or heavy lifting (24–48 hours)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Alcohol and smoking during recovery period</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Hot baths or saunas immediately after vaccination</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Rubbing or scratching the injection site</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>Stress and anxiety—stay calm</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* When to Seek Help */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/20">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-red-900 uppercase dark:text-red-100">
                    <span aria-hidden="true">🚨</span>
                    When to Seek Medical Help
                </h4>
                <p className="mb-3 text-sm font-medium text-red-900 dark:text-red-100">
                    Contact a healthcare provider immediately if you experience:
                </p>
                <ul className="space-y-2 text-sm text-red-900 dark:text-red-100">
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span>Difficulty breathing or chest pain</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span>Severe allergic reactions (swelling of face/throat)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span>High fever ({">"}103°F / 39.4°C) that persists</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span>Severe headache or stiff neck</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">⚠️</span>
                        <span>Unusual bleeding or bruising</span>
                    </li>
                </ul>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
                <h4 className="mb-3 text-sm font-bold tracking-wide text-emerald-900 uppercase dark:text-emerald-100">
                    Recovery Timeline
                </h4>
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <span className="min-w-16 shrink-0 font-bold text-emerald-700 dark:text-emerald-300">
                            0–24 hrs
                        </span>
                        <span className="text-sm text-emerald-900 dark:text-emerald-100">
                            Initial mild reactions may appear (fever, soreness)
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <span className="min-w-16 shrink-0 font-bold text-emerald-700 dark:text-emerald-300">
                            1–3 days
                        </span>
                        <span className="text-sm text-emerald-900 dark:text-emerald-100">
                            Peak of any side effects; most resolve by day 3
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <span className="min-w-16 shrink-0 font-bold text-emerald-700 dark:text-emerald-300">
                            3–7 days
                        </span>
                        <span className="text-sm text-emerald-900 dark:text-emerald-100">
                            Full recovery; you can resume normal activities
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
