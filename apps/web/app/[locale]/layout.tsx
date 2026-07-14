import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { routing } from "../../i18n/routing";
import { getSiteUrl } from "@/lib/env";

import { ThemeProvider } from "./components/ThemeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineErrorBoundary } from "@/components/OfflineErrorBoundary";
import { ServiceWorkerProvider } from "@/components/ServiceWorkerProvider";
import Navbar from "./components/Navbar";
import "./globals.css";
import "../../src/styles/print.css";
import { Toaster } from "sonner";
import Footer from "./components/Footer";
import { AuthProvider } from "@/src/components/AuthProvider";
import { TracingInitializer } from "@/components/TracingInitializer";

import { InteractiveOverlays } from "./components/InteractiveOverlays";
import { ReactQueryProvider } from "./components/ReactQueryProvider";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    await params;
    const baseUrl = getSiteUrl();

    // Generate alternates for all locales
    const alternates = {
        languages: Object.fromEntries(routing.locales.map((lang) => [lang, `${baseUrl}/${lang}`])),
    };

    // Add x-default for default locale
    (alternates.languages as Record<string, string>)["x-default"] = baseUrl;

    return {
        title: "SahiDawa Open Health — Safety Infrastructure",
        description: "Open-source medicine safety infrastructure. Scan, verify, and report.",
        manifest: "/manifest.json",
        icons: {
            icon: "/icons/icon-192.png",
            apple: "/icons/icon-192.png",
        },
        openGraph: {
            title: "SahiDawa Open Health — Safety Infrastructure",
            description: "Open-source medicine safety infrastructure. Scan, verify, and report.",
            url: baseUrl, // now uses the variable
            siteName: "SahiDawa",
        },
        twitter: {
            card: "summary_large_image",
            title: "SahiDawa Open Health — Safety Infrastructure",
            description: "Open-source medicine safety infrastructure. Scan, verify, and report.",
        },
        alternates,
    };
}

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
    const t = await getTranslations("VoicePage");
    const isRtl = ["ur", "ks"].includes(locale);

    return (
        <html lang={locale} dir={isRtl ? "rtl" : "ltr"} suppressHydrationWarning>
            <head></head>
            <body className="flex min-h-screen flex-col bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
                <ServiceWorkerProvider>
                    <ThemeProvider>
                        <ReactQueryProvider>
                            <NextIntlClientProvider messages={messages}>
                                <NuqsAdapter>
                                    <AuthProvider>
                                        <a
                                            href="#main-content"
                                            className="sr-only absolute top-4 left-4 z-60 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg focus:not-sr-only focus-visible:ring-[3px] focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                        >
                                            {t("skip_to_main_content")}
                                        </a>
                                        <OfflineBanner />
                                        <Navbar />
                                        <main id="main-content" className="flex grow flex-col">
                                            <OfflineErrorBoundary>{children}</OfflineErrorBoundary>
                                        </main>
                                        <Footer />
                                        <InteractiveOverlays />
                                    </AuthProvider>
                                </NuqsAdapter>
                            </NextIntlClientProvider>
                        </ReactQueryProvider>
                        <div className="no-print">
                            <Toaster richColors position="top-center" />
                        </div>
                        <TracingInitializer />
                    </ThemeProvider>
                </ServiceWorkerProvider>
            </body>
        </html>
    );
}
