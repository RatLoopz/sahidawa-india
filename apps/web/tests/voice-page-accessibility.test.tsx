import { renderToStaticMarkup } from "react-dom/server";

import VoiceLayout from "../app/[locale]/voice/layout";
import VoiceTriagePage from "../app/[locale]/voice/page";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock("next-intl/server", () => ({
    getTranslations: async () => (key: string) => key,
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
    useParams: () => ({
        locale: "en",
    }),
}));

jest.mock("sonner", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
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

describe("VoiceTriagePage accessibility shell", () => {
    it("renders a skip link before a focusable main landmark target", async () => {
        const layoutMarkup = renderToStaticMarkup(
            await VoiceLayout({
                children: <VoiceTriagePage />,
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
