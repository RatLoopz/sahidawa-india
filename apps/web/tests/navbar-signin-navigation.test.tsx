import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";

import Navbar from "../app/[locale]/components/Navbar";

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: () => ({
        session: null,
        isLoading: false,
    }),
}));

jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        alt = "",
        src,
        ...props
    }: {
        alt?: string;
        src: string;
        [key: string]: unknown;
    }) => {
        const rest = { ...props } as any;
        delete rest.priority;
        return <img src={src} alt={alt} {...rest} />;
    },
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
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

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: () => ({ session: null, isLoading: false }),
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
