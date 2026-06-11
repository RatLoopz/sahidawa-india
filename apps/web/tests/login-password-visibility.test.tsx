import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";

import LoginPage from "../app/[locale]/login/page";

const push = jest.fn();

jest.mock("@/i18n/routing", () => ({
    Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    useRouter: () => ({ push }),
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("@supabase/ssr", () => ({
    createBrowserClient: () => ({
        auth: {
            signInWithPassword: jest.fn(),
            signInWithOAuth: jest.fn(),
        },
    }),
}));

describe("login password visibility", () => {
    it("renders an accessible password visibility toggle", () => {
        const markup = renderToStaticMarkup(<LoginPage />);

        expect(markup).toContain('type="password"');
        expect(markup).toContain('type="button"');
        expect(markup).toContain('aria-label="Login.showPassword"');
        expect(markup).toContain('aria-pressed="false"');
    });

    it("keeps the toggle wired to component state and translations", () => {
        const source = readFileSync(join(process.cwd(), "app/[locale]/login/page.tsx"), "utf8");

        expect(source).toContain("const [showPassword, setShowPassword] = useState(false)");
        expect(source).toContain('type={showPassword ? "text" : "password"}');
        expect(source).toContain("setShowPassword((current) => !current)");
        expect(source).toContain('showPassword ? t("hidePassword") : t("showPassword")');
    });
});
