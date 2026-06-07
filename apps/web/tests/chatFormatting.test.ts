import { normalizeChatMarkdown } from "../lib/chatFormatting";

describe("normalizeChatMarkdown", () => {
    it("keeps regular markdown blocks intact for the renderer", () => {
        const content = [
            "## Fever care",
            "",
            "- **Hydrate:** Drink water.",
            "- Rest in a cool room.",
            "",
            "Use `paracetamol` only as directed.",
            "",
            "[Read more](https://example.com)",
        ].join("\n");

        expect(normalizeChatMarkdown(content)).toBe(content);
    });

    it("turns inline numbered Gemini output into markdown ordered-list lines", () => {
        expect(
            normalizeChatMarkdown(
                "Here are tips: 1. **Hydrate:** Drink water. 2. **Rest:** Sleep well."
            )
        ).toBe("Here are tips:\n\n1. **Hydrate:** Drink water.\n2. **Rest:** Sleep well.");
    });

    it("does not rewrite ordered-list markers inside fenced code blocks", () => {
        expect(
            normalizeChatMarkdown("Try this:\n```txt\n1. Keep this code line. 2. Same line.\n```")
        ).toBe("Try this:\n```txt\n1. Keep this code line. 2. Same line.\n```");
    });
});
