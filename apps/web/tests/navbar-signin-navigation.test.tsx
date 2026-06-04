import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";

import Navbar from "../app/[locale]/components/Navbar";

jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt = "", ...props }: { alt?: string; [key: string]: unknown }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} {...props} />
    ),
}));

jest.mock("next-intl", () => ({
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("next-themes", () => ({
    useTheme: () => ({
        resolvedTheme: "light",
        setTheme: jest.fn(),
    }),
}));

jest.mock("../app/[locale]/LanguageSwitcher", () => ({
    __esModule: true,
    default: () => <div data-testid="language-switcher" />,
}));

describe("navbar sign-in navigation", () => {
    it("renders sign-in and health actions as locale-aware links", () => {
        const markup = renderToStaticMarkup(<Navbar />);

        expect(markup).toContain('href="/login"');
        expect(markup).toContain('href="/health"');
        expect(markup).toContain("Home.sign_in");
    });

    it("does not build sign-in paths from next/navigation params", () => {
        const source = readFileSync(
            join(process.cwd(), "app/[locale]/components/Navbar.tsx"),
            "utf8"
        );

        expect(source).not.toContain("useParams");
        expect(source).not.toContain("handleNavigation");
        expect(source).not.toContain("router.push(`/${locale}/${path}`)");
    });
});
