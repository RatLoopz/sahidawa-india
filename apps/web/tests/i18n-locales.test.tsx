import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
let activeLocale = "en";

jest.mock("next-intl/middleware", () => jest.fn(() => () => undefined));

jest.mock("next-intl", () => ({
    useLocale: () => activeLocale,
    useTranslations: () => (key: string) => key,
}));

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";

import LanguageSwitcher from "../app/[locale]/LanguageSwitcher";
import { mergeMessages } from "../i18n/request";
import { routing } from "../i18n/routing";

type JsonObject = Record<string, unknown>;

function readMessages(fileName: string): JsonObject {
    const messagesPath = join(process.cwd(), "messages", fileName);
    return JSON.parse(readFileSync(messagesPath, "utf8"));
}

function collectStringLeaves(value: unknown, prefix = ""): string[] {
    if (typeof value === "string") {
        return [prefix];
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
    }

    return Object.entries(value as JsonObject).flatMap(([key, childValue]) =>
        collectStringLeaves(childValue, prefix ? `${prefix}.${key}` : key)
    );
}

function readNestedValue(value: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((currentValue, segment) => {
        if (!currentValue || typeof currentValue !== "object") {
            return undefined;
        }

        return (currentValue as JsonObject)[segment];
    }, value);
}

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

    it("merges every locale message bundle with the English baseline", () => {
        const messagesDir = join(process.cwd(), "messages");
        const englishMessages = readMessages("en.json");
        const englishKeys = collectStringLeaves(englishMessages).sort();

        for (const fileName of readdirSync(messagesDir).filter((file) => file.endsWith(".json"))) {
            if (fileName === "en.json") {
                continue;
            }

            const localeMessages = readMessages(fileName);
            const mergedMessages = mergeMessages(englishMessages, localeMessages) as JsonObject;
            const mergedKeys = collectStringLeaves(mergedMessages).sort();
            const localeKeys = collectStringLeaves(localeMessages).sort();

            expect(mergedKeys).toEqual(expect.arrayContaining(englishKeys));
            expect(mergedKeys.length).toBeGreaterThanOrEqual(englishKeys.length);

            for (const key of englishKeys) {
                const value = readNestedValue(mergedMessages, key);
                expect(value).toEqual(expect.any(String));
                expect((value as string).trim()).not.toHaveLength(0);
            }

            for (const key of localeKeys) {
                const value = readNestedValue(mergedMessages, key);
                expect(value).toEqual(expect.any(String));
                expect((value as string).trim()).not.toHaveLength(0);
            }
        }
    });
});
