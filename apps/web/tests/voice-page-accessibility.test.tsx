/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import LocaleLayout from "../app/[locale]/layout";
import VoiceLayout from "../app/[locale]/voice/layout";
import VoiceTriagePage from "../app/[locale]/voice/page";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
    NextIntlClientProvider: ({ children }: any) => children,
}));

jest.mock("next-intl/server", () => ({
    getTranslations: async () => (key: string) => key,
    getMessages: async () => ({}),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
    useParams: () => ({
        locale: "en",
    }),
    notFound: () => {},
}));

jest.mock("sonner", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
    Toaster: () => null,
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
        <header>
            <a href="/">Back</a>
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </header>
    ),
}));

// Mock layout sub-components to prevent rendering complex/nested structures
jest.mock("../app/[locale]/components/ThemeProvider", () => ({
    ThemeProvider: ({ children }: any) => children,
}));
jest.mock("@/components/OfflineBanner", () => ({
    OfflineBanner: () => null,
}));
jest.mock("@/components/OfflineErrorBoundary", () => ({
    OfflineErrorBoundary: ({ children }: any) => children,
}));
jest.mock("@/components/ServiceWorkerProvider", () => ({
    ServiceWorkerProvider: ({ children }: any) => children,
}));
jest.mock("../app/[locale]/components/BackToTopButton", () => () => null);
jest.mock("../app/[locale]/components/Chatbot", () => () => null);
jest.mock("../app/[locale]/components/Navbar", () => () => null);
jest.mock("../app/[locale]/components/Footer", () => () => null);
jest.mock("@/src/components/AuthProvider", () => ({
    AuthProvider: ({ children }: any) => children,
}));
jest.mock("../app/[locale]/components/CommandPalette", () => () => null);
jest.mock("@/components/TracingInitializer", () => ({
    TracingInitializer: () => null,
}));

describe("VoiceTriagePage accessibility shell", () => {
    it("renders a skip link before a focusable main landmark target in the page shell", async () => {
        const layoutMarkup = renderToStaticMarkup(
            await LocaleLayout({
                children: (
                    <VoiceLayout>
                        <VoiceTriagePage />
                    </VoiceLayout>
                ),
                params: Promise.resolve({ locale: "en" }),
            })
        );
        const skipLinkIndex = layoutMarkup.indexOf('href="#main-content"');
        const mainIndex = layoutMarkup.indexOf("<main");

        expect(skipLinkIndex).toBeGreaterThan(-1);
        expect(mainIndex).toBeGreaterThan(-1);
        expect(skipLinkIndex).toBeLessThan(mainIndex);
        expect(layoutMarkup).toContain('id="main-content"');
        expect(layoutMarkup).toContain('tabindex="-1"');
    });
});
