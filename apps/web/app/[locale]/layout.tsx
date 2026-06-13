import type { Metadata, Viewport } from "next";
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
import Navbar from "./components/Navbar";
import "./globals.css";
import "../../src/styles/print.css";
import { Toaster } from "sonner";
import Footer from "./components/Footer";
import { AuthSync } from "@/src/components/AuthSync";
import CommandPalette from "./components/CommandPalette";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    await params;
    const baseUrl = "https://sahidawa-india-web.vercel.app"; 

    // Generate alternates for all locales
    const alternates = {
        languages: Object.fromEntries(routing.locales.map((lang) => [lang, `${baseUrl}/${lang}`])),
    };

    // Add x-default for default locale
    (alternates.languages as Record<string, string>)["x-default"] = baseUrl;

    return {
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
    description: "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
    url: baseUrl,  // now uses the variable
    siteName: "SahiDawa",
},
        twitter: {
            card: "summary_large_image",
            title: "SahiDawa — Verify Your Medicine",
            description:
                "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
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
    const isRtl = ["ur", "ks"].includes(locale);

    return (
        <html lang={locale} dir={isRtl ? "rtl" : "ltr"} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            try {
                                if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                                    document.documentElement.classList.add('dark');
                                } else {
                                    document.documentElement.classList.remove('dark');
                                }
                            } catch (_) {}
                        `,
                    }}
                />
            </head>
            <body className="flex min-h-screen flex-col bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
                <ServiceWorkerProvider>
                    <ThemeProvider>
                        <NextIntlClientProvider messages={messages}>
                            <AuthSync />
                            <OfflineBanner />
                            <Navbar />
                            <main className="flex flex-grow flex-col">
                                <OfflineErrorBoundary>{children}</OfflineErrorBoundary>
                            </main>
                            <Footer />
                            <div className="no-print">
                                <BackToTopButton />
                                <Chatbot />
                                <CommandPalette />
                            </div>
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
