import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown } from "../app/components/ChatMarkdown";

describe("ChatMarkdown", () => {
    it("renders common Gemini markdown as structured HTML", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown
                content={[
                    "### Fever care",
                    "",
                    "- **Hydrate:** Drink water.",
                    "- Rest in a cool room.",
                    "",
                    "Use `paracetamol` only as directed.",
                    "",
                    "[Read more](https://example.com)",
                ].join("\n")}
            />
        );

        expect(html).toContain("<h3");
        expect(html).toContain("<ul");
        expect(html).toContain("<strong");
        expect(html).toContain("<code");
        expect(html).toContain('href="https://example.com"');
        expect(html).not.toContain("**Hydrate:**");
    });

    it("renders inline numbered Gemini output as an ordered list", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown content="Here are tips: 1. **Hydrate:** Drink water. 2. **Rest:** Sleep well." />
        );

        expect(html).toContain("<ol");
        expect(html).toContain("<li");
        expect(html).toContain("<strong");
        expect(html).not.toContain("1. **Hydrate:**");
    });

    it("does not render raw HTML, images, or unsafe link protocols", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown
                content={
                    '<script>alert("x")</script>\n\n![x](https://example.com/x.png)\n\n[bad](javascript:alert("x"))'
                }
            />
        );

        expect(html).not.toContain("<script");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("javascript:");
        expect(html).toContain("&lt;script&gt;");
    });

    it("indents a deeply nested unordered list without the indentation growing unbounded", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown
                content={[
                    "- Level 1 item",
                    "  - Level 2 item",
                    "    - Level 3 item",
                    "      - Level 4 item",
                ].join("\n")}
            />
        );

        // Each nesting level should still produce a real <ul>, so depth is preserved.
        expect(html.match(/<ul/g)?.length).toBe(4);

        // Top-level list gets the largest indent; indentation should taper
        // off rather than keep growing once a list nests past a few levels.
        expect(html).toContain('class="list-disc space-y-1.5 pl-4"');
        expect(html).toContain('class="list-disc space-y-1.5 pl-3"');
        expect(html).toContain('class="list-disc space-y-1.5 pl-2"');
        // The old uncapped behavior (pl-5 at every level) should not appear.
        expect(html).not.toContain("pl-5");
    });

    it("caps indentation for an ordered list nested several levels deep", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown
                content={[
                    "1. Step one",
                    "   1. Sub-step A",
                    "      1. Sub-sub-step",
                    "         1. Even deeper step",
                ].join("\n")}
            />
        );

        expect(html.match(/<ol/g)?.length).toBe(4);
        expect(html).toContain('class="list-decimal space-y-1.5 pl-4"');
        expect(html).toContain('class="list-decimal space-y-1.5 pl-2"');
    });

    it("keeps a shallow (single-level) list at the default top-level indent", () => {
        const html = renderToStaticMarkup(
            <ChatMarkdown content={["- Item one", "- Item two"].join("\n")} />
        );

        expect(html).toContain('class="list-disc space-y-1.5 pl-4"');
        expect(html.match(/<ul/g)?.length).toBe(1);
    });
});
