"use client";

import { VaccineProfile } from "@/lib/vaccineData";
import { AlertTriangle, Check } from "lucide-react";
import { useTranslations } from "next-intl";

interface SafetyInfoProps {
    vaccine: VaccineProfile;
}

export function SafetyInfo({ vaccine }: SafetyInfoProps) {
    const t = useTranslations("vaccineHub");
    return (
        <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-(--color-text-primary)">
                <span aria-hidden="true">⚠️</span>
                Safety & Side Effects
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Common Side Effects */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-900 uppercase dark:text-amber-100">
                        <Check size={18} aria-hidden="true" />
                        {t("commonEffects")}
                    </h4>
                    <ul className="mt-3 space-y-2">
                        {vaccine.side_effects.common.map((effect, index) => (
                            <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100"
                            >
                                <span
                                    className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                                    aria-hidden="true"
                                />
                                <span>{effect}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-200">
                        ℹ️ Usually resolve within a few days. Monitor for comfort.
                    </p>
                </div>

                {/* Severe Reactions */}
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
                    <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide text-rose-900 uppercase dark:text-rose-100">
                        <AlertTriangle size={18} aria-hidden="true" />
                        {t("severeReactions")}
                    </h4>
                    <ul className="mt-3 space-y-2">
                        {vaccine.side_effects.severe.map((effect, index) => (
                            <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-rose-900 dark:text-rose-100"
                            >
                                <span
                                    className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                                    aria-hidden="true"
                                />
                                <span>{effect}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-200">
                        🚨 Seek immediate medical attention if these occur.
                    </p>
                </div>
            </div>

            {/* Safety Tips */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
                <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide text-sky-900 uppercase dark:text-sky-100">
                    <span aria-hidden="true">💡</span>
                    Safety Recommendations
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-sky-900 dark:text-sky-100">
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">✓</span>
                        <span>Stay calm—side effects are normal and usually mild</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">✓</span>
                        <span>Have antihistamines and pain relievers available</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">✓</span>
                        <span>Rest well after vaccination; avoid strenuous activity</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span aria-hidden="true">✓</span>
                        <span>Contact healthcare provider if concerned about any symptom</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
