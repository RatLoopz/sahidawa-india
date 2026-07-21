"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { usePrivacyConsent } from "@/components/PrivacyConsentProvider";

export default function PrivacyConsentBanner() {
    const t = useTranslations("PrivacyConsent");
    const { hasRespondedToConsent, acceptAll, denyAll } = usePrivacyConsent();

    if (hasRespondedToConsent) return null;

    return (
        <div
            className="animate-in fade-in slide-in-from-bottom-5 fixed right-0 bottom-0 left-0 z-50 border-t border-blue-200 bg-blue-50 p-4 shadow-xl transition-transform duration-300 md:p-6 dark:border-blue-800 dark:bg-slate-900"
            role="dialog"
            aria-labelledby="consent-title"
            aria-describedby="consent-desc"
        >
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                    <h2
                        id="consent-title"
                        className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
                    >
                        {t("title")}
                    </h2>
                    <p
                        id="consent-desc"
                        className="mt-1 text-sm text-slate-700 dark:text-slate-300"
                    >
                        {t("description")} {t("locationPurpose")} {t("scanHistoryPurpose")}
                    </p>
                </div>
                <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                    <button
                        onClick={denyAll}
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        {t("denyAll")}
                    </button>
                    <button
                        onClick={acceptAll}
                        className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                        {t("acceptAll")}
                    </button>
                </div>
            </div>
        </div>
    );
}
