import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Voice Triage — SahiDawa";
const description =
    "Speak your symptoms in any Indian language and get AI-powered medicine triage guidance instantly.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/voice",
        siteName: "SahiDawa",
        images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
    },
};

export default function VoiceLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
