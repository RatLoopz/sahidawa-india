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
            className="bg-background animate-in fade-in slide-in-from-bottom-5 fixed right-0 bottom-0 left-0 z-50 border-t p-4 shadow-lg transition-transform duration-300 md:p-6"
            role="dialog"
            aria-labelledby="consent-title"
            aria-describedby="consent-desc"
        >
            <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                    <h2
                        id="consent-title"
                        className="text-foreground text-lg font-semibold tracking-tight"
                    >
                        {t("title")}
                    </h2>
                    <p id="consent-desc" className="text-muted-foreground mt-1 text-sm">
                        {t("description")} {t("locationPurpose")} {t("scanHistoryPurpose")}
                    </p>
                </div>
                <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                    <button
                        onClick={denyAll}
                        className="hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        {t("denyAll")}
                    </button>
                    <button
                        onClick={acceptAll}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    >
                        {t("acceptAll")}
                    </button>
                </div>
            </div>
        </div>
    );
}
