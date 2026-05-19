import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Compare Medicine Prices - SahiDawa",
    description:
        "Print a clean medicine verification and price comparison report for patient handouts.",
};

export default function CompareLayout({ children }: { children: ReactNode }) {
    return children;
}
