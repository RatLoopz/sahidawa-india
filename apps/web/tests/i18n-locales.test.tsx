import { renderToStaticMarkup } from "react-dom/server";

import LanguageSwitcher from "../app/[locale]/LanguageSwitcher";
import { routing } from "../i18n/routing";
import { config as proxyConfig } from "../proxy";

let activeLocale = "en";

jest.mock("next-intl/middleware", () => jest.fn(() => () => undefined));

jest.mock("next-intl", () => ({
    useLocale: () => activeLocale,
    useTranslations: () => (key: string) => key,
}));

describe("i18n locale availability", () => {
    it.each(["kn", "pa"])("enables %s in the routing config", (locale) => {
        expect(routing.locales).toContain(locale);
    });

    it("matches every routing locale in the proxy config", () => {
        const localeMatcher = proxyConfig.matcher.find((matcher) => matcher.endsWith("/:path*"));
        const matchedLocales = localeMatcher?.match(/\(([^)]+)\)/)?.[1].split("|");

        expect(matchedLocales).toEqual(expect.arrayContaining(routing.locales));
    });

    it.each([
        ["kn", "ಕನ್ನಡ"],
        ["pa", "ਪੰਜਾਬੀ"],
    ])("shows the native language label for %s", (locale, nativeLabel) => {
        activeLocale = locale;

        const markup = renderToStaticMarkup(<LanguageSwitcher />);

        expect(markup).toContain(nativeLabel);
    });
});
