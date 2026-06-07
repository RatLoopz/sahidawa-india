import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
    const baseUrl = "https://sahidawa.in";

    return {
        title: "Scan Medicine — SahiDawa",
        description:
            "Scan a medicine barcode or upload a photo to instantly verify its authenticity using India's open-source CDSCO database.",
        openGraph: {
            title: "Scan Medicine — SahiDawa",
            description:
                "Scan a medicine barcode or upload a photo to instantly verify its authenticity using India's open-source CDSCO database.",
            url: `${baseUrl}/scan`,
            siteName: "SahiDawa",
        },
        twitter: {
            card: "summary_large_image",
            title: "Scan Medicine — SahiDawa",
            description:
                "Scan a medicine barcode or upload a photo to instantly verify its authenticity using India's open-source CDSCO database.",
        },
    };
}

export default function ScanLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
