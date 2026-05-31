import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Report Fake Medicine — MedWatch",
    description:
        "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.",
    openGraph: {
        title: "Report Fake Medicine — MedWatch",
        description:
            "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.",
        url: "https://sahidawa.in/report",
        siteName: "SahiDawa",
    },
    twitter: {
        card: "summary_large_image",
        title: "Report Fake Medicine — MedWatch",
        description:
            "Report suspicious or counterfeit medicines found at pharmacies. Help protect your community.",
    },
};

export default function ReportLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
