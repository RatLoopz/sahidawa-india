import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Medicine Safety Alerts - SahiDawa";
const description =
    "Track counterfeit, banned, and recalled medicine alerts across India with SahiDawa's public safety feed.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/alerts",
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

export default function AlertsLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
