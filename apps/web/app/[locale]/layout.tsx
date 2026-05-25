import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";

import { ThemeProvider } from "./components/ThemeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineErrorBoundary } from "@/components/OfflineErrorBoundary";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";
import Chatbot from "./components/Chatbot";
import "./globals.css";
import "../../src/styles/print.css";
import { Toaster } from "sonner";
import Footer from "./components/Footer";

export const metadata: Metadata = {
    title: "SahiDawa — Verify Your Medicine",
    description:
        "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
    manifest: "/manifest.json",
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
    openGraph: {
        title: "SahiDawa — Verify Your Medicine",
        description:
            "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
        url: "https://sahidawa.in",
        siteName: "SahiDawa",
    },
    twitter: {
        card: "summary_large_image",
        title: "SahiDawa — Verify Your Medicine",
        description:
            "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
    },
};

export const viewport: Viewport = {
    themeColor: "#10b981",
};

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            {/* REPLACE YOUR OLD BODY TAG WITH THIS ONE: */}
            <body className="bg-[var(--color-surface-page)] text-[var(--color-text-primary)] transition-colors duration-300">
                <ServiceWorkerProvider>
                    <ThemeProvider>
                        <NextIntlClientProvider messages={messages}>
                            <OfflineErrorBoundary>
                                <OfflineBanner />
                                {children}
                                <Footer />
                                <div className="no-print">
                                    <Chatbot />
                                </div>
                            </OfflineErrorBoundary>
                        </NextIntlClientProvider>
                        <div className="no-print">
                            <Toaster richColors position="top-center" />
                        </div>
                    </ThemeProvider>
                </ServiceWorkerProvider>
            </body>
        </html>
    );
}
