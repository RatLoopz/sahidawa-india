import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Find Pharmacy — SahiDawa";
const description =
    "Locate verified Jan Aushadhi and trusted pharmacies near you on SahiDawa's live pharmacy map.";
const image = "/icons/sahidawa-logo.png";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://sahidawa.in/map",
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

export default function MapLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
