import { renderToStaticMarkup } from "react-dom/server";

import LanguageSwitcher from "../app/[locale]/LanguageSwitcher";
import { routing } from "../i18n/routing";

let activeLocale = "en";

jest.mock("next-intl/middleware", () => jest.fn(() => () => undefined));

jest.mock("next-intl", () => ({
    useLocale: () => activeLocale,
    useTranslations: () => (key: string) => key,
}));

describe("i18n locale availability", () => {
    it.each(["kn", "te", "pa"])("enables %s in the routing config", (locale) => {
        expect(routing.locales).toContain(locale);
    });

    it.each([
        ["kn", "ಕನ್ನಡ"],
        ["te", "తెలుగు"],
        ["pa", "ਪੰਜਾਬੀ"],
    ])("shows the native language label for %s", (locale, nativeLabel) => {
        activeLocale = locale;

        const markup = renderToStaticMarkup(<LanguageSwitcher />);

        expect(markup).toContain(nativeLabel);
    });
});
