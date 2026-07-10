import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Medicine Scan History - SahiDawa";
const description =
    "Review your medicine verification history, past scan results, and saved safety checks in SahiDawa.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/history",
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

export default function HistoryLayout({ children }: { children: ReactNode }) {
    return children;
}
