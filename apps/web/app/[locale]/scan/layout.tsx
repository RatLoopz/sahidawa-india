import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
    const baseUrl = "https://sahidawa.in";
    const title = "Scan Medicine — SahiDawa";
    const description =
        "Scan a medicine barcode or upload a photo to instantly verify its authenticity using India's open-source CDSCO database.";
    const image = "/icons/sahidawa-logo.png";

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `${baseUrl}/scan`,
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
}

export default function ScanLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
