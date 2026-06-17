import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

function deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach((key) => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item: any) {
    return item && typeof item === "object" && !Array.isArray(item);
}

export default getRequestConfig(async ({ requestLocale }) => {
    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as any)) {
        locale = routing.defaultLocale;
    }

    const localMessages = (await import(`../messages/${locale}.json`)).default;

    if (locale !== routing.defaultLocale) {
        const defaultMessages = (await import(`../messages/${routing.defaultLocale}.json`)).default;
        const mergedMessages = deepMerge(defaultMessages, localMessages);
        return {
            locale,
            messages: mergedMessages,
        };
    }

    return {
        locale,
        messages: localMessages,
    };
});
