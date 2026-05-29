import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";

import { ThemeProvider } from "./components/ThemeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineErrorBoundary } from "@/components/OfflineErrorBoundary";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";
import BackToTopButton from "./components/BackToTopButton";
import Chatbot from "./components/Chatbot";
import "./globals.css";
import "../../src/styles/print.css";
import { Toaster } from "sonner";
import Footer from "./components/Footer";

const bricolageGrotesque = Bricolage_Grotesque({
    subsets: ["latin"],
    variable: "--font-bricolage",
    display: "swap",
});

const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    variable: "--font-instrument",
    display: "swap",
});

export const metadata: Metadata = {
    title: "SahiDawa \u2014 Verify Your Medicine",
    description:
        "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
    manifest: "/manifest.json",
    icons: {
        icon: "/icons/icon-192.png",
        apple: "/icons/icon-192.png",
    },
    openGraph: {
        title: "SahiDawa \u2014 Verify Your Medicine",
        description:
            "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
        url: "https://sahidawa.in",
        siteName: "SahiDawa",
    },
    twitter: {
        card: "summary_large_image",
        title: "SahiDawa \u2014 Verify Your Medicine",
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
            <body
                className={`${bricolageGrotesque.variable} ${instrumentSans.variable} bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300`}
            >
                <ServiceWorkerProvider>
                    <ThemeProvider>
                        <NextIntlClientProvider messages={messages}>
                            <OfflineErrorBoundary>
                                <OfflineBanner />
                                {children}
                                <Footer />
                                <div className="no-print">
                                    <BackToTopButton />
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
