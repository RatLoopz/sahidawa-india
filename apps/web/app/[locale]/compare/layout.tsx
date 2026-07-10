import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Compare Medicine Prices - SahiDawa";
const description =
    "Print a clean medicine verification and price comparison report for patient handouts.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/compare",
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

export default function CompareLayout({ children }: { children: ReactNode }) {
    return children;
}
