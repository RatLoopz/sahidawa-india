import { readdirSync, readFileSync } from "fs";
import { join } from "path";

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

describe("FAQ i18n messages", () => {
    it("defines every FAQ translation key for each locale", () => {
        const messagesDir = join(process.cwd(), "messages");
        const faqKeys = collectStringLeaves(readMessages("en.json").Faq).sort();

        for (const fileName of readdirSync(messagesDir).filter((file) => file.endsWith(".json"))) {
            const faqMessages = readMessages(fileName).Faq;
            const localeFaqKeys = collectStringLeaves(faqMessages).sort();

            expect(localeFaqKeys).toEqual(faqKeys);

            for (const key of faqKeys) {
                const value = readNestedValue(faqMessages, key);

                expect(value).toEqual(expect.any(String));
                expect((value as string).trim()).not.toHaveLength(0);
            }
        }
    });
});
