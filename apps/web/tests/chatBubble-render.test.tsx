import { renderToStaticMarkup } from "react-dom/server";
import { ChatBubble, type Message } from "../app/components/health/components/ChatBubble";

function message(overrides: Partial<Message>): Message {
    return {
        id: "msg",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-06-04T00:00:00.000Z"),
        ...overrides,
    };
}

describe("ChatBubble", () => {
    it("renders assistant messages as markdown", () => {
        const html = renderToStaticMarkup(
            <ChatBubble
                msg={message({ role: "assistant", content: "**Hydrate:** Drink water." })}
            />
        );

        expect(html).toContain("<strong");
        expect(html).not.toContain("**Hydrate:**");
    });

    it("keeps user messages as plain text", () => {
        const html = renderToStaticMarkup(
            <ChatBubble msg={message({ role: "user", content: "**not assistant markdown**" })} />
        );

        expect(html).not.toContain("<strong");
        expect(html).toContain("**not assistant markdown**");
    });
});
