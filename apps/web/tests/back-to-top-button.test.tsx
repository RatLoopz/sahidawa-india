import { renderToStaticMarkup } from "react-dom/server";

import BackToTopButton from "../app/[locale]/components/BackToTopButton";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

describe("BackToTopButton", () => {
    it("keeps the mobile button high enough to stay visible above the chat launcher", () => {
        const markup = renderToStaticMarkup(<BackToTopButton />);

        // mobile: chatbot h-14(56px) at bottom-20(80px) + 16px gap = 152px → bottom-[152px]
        expect(markup).toContain("bottom-[152px]");
        // desktop: chatbot h-14(56px) at md:bottom-6(24px) + 16px gap = 96px → md:bottom-24
        expect(markup).toContain("md:bottom-24");
        // both buttons share the same right-6 column
        expect(markup).toContain("right-6");
    });
});
