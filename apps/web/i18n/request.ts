import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeMessages(
    fallbackMessages: Record<string, unknown>,
    localeMessages: Record<string, unknown>
): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...fallbackMessages };

    for (const [key, value] of Object.entries(localeMessages)) {
        if (value === undefined) {
            continue;
        }

        const fallbackValue = merged[key];

        if (isPlainObject(value) && isPlainObject(fallbackValue)) {
            merged[key] = mergeMessages(fallbackValue, value);
        } else {
            merged[key] = value;
        }
    }

    return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    const fallbackMessages = (await import("../messages/en.json")).default as Record<
        string,
        unknown
    >;
    const localeMessages = (await import(`../messages/${locale}.json`)).default as Record<
        string,
        unknown
    >;

    return {
        locale,
        messages: mergeMessages(fallbackMessages, localeMessages),
    };
});
