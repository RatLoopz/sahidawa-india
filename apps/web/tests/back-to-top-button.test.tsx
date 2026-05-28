import { renderToStaticMarkup } from "react-dom/server";

import BackToTopButton from "../app/[locale]/components/BackToTopButton";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

describe("BackToTopButton", () => {
    it("keeps the mobile button high enough to stay visible above the chat launcher", () => {
        const markup = renderToStaticMarkup(<BackToTopButton />);

        expect(markup).toContain("bottom-36");
        expect(markup).toContain("md:bottom-24");
        expect(markup).toContain("right-6");
    });
});
