import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
    title: "Voice Triage — SahiDawa",
    description:
        "Speak your symptoms in any Indian language and get AI-powered medicine triage guidance instantly.",
    openGraph: {
        title: "Voice Triage — SahiDawa",
        description:
            "Speak your symptoms in any Indian language and get AI-powered medicine triage guidance instantly.",
        url: "https://sahidawa.in/voice",
        siteName: "SahiDawa",
    },
    twitter: {
        card: "summary_large_image",
        title: "Voice Triage — SahiDawa",
        description:
            "Speak your symptoms in any Indian language and get AI-powered medicine triage guidance instantly.",
    },
};

export default async function VoiceLayout({ children }: { children: ReactNode }) {
    const t = await getTranslations("VoicePage");

    return (
        <>
            <a
                href="#main-content"
                className="sr-only absolute top-4 left-4 z-[60] rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg focus:not-sr-only focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
                {t("skip_to_main_content")}
            </a>
            {children}
        </>
    );
}
