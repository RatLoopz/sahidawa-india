import type { Metadata } from "next";
import type { ReactNode } from "react";

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

export default function VoiceLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
