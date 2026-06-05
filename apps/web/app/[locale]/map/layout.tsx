import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Find Pharmacy — SahiDawa",
    description:
        "Locate verified Jan Aushadhi and trusted pharmacies near you on SahiDawa's live pharmacy map.",
    openGraph: {
        title: "Find Pharmacy — SahiDawa",
        description:
            "Locate verified Jan Aushadhi and trusted pharmacies near you on SahiDawa's live pharmacy map.",
        url: "https://sahidawa.in/map",
        siteName: "SahiDawa",
    },
    twitter: {
        card: "summary_large_image",
        title: "Find Pharmacy — SahiDawa",
        description:
            "Locate verified Jan Aushadhi and trusted pharmacies near you on SahiDawa's live pharmacy map.",
    },
};

export default function MapLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
