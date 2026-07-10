import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Report Fake Medicine — SahiDawa";
const description =
    "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/report",
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

export default function ReportLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
