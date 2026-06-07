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
});
