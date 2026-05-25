import { renderToStaticMarkup } from "react-dom/server";

import { LiveMessage } from "../components/ui/LiveMessage";

describe("LiveMessage", () => {
    it("renders critical updates as assertive alerts", () => {
        const markup = renderToStaticMarkup(
            <LiveMessage tone="critical" id="scan-error" className="notice">
                Camera access was denied.
            </LiveMessage>
        );

        expect(markup).toContain('role="alert"');
        expect(markup).toContain('aria-live="assertive"');
        expect(markup).toContain('aria-atomic="true"');
        expect(markup).toContain('id="scan-error"');
        expect(markup).toContain("Camera access was denied.");
    });

    it("renders non-critical updates as polite status messages", () => {
        const markup = renderToStaticMarkup(
            <LiveMessage tone="polite">Recall notifications are active.</LiveMessage>
        );

        expect(markup).toContain('role="status"');
        expect(markup).toContain('aria-live="polite"');
        expect(markup).toContain('aria-atomic="true"');
        expect(markup).toContain("Recall notifications are active.");
    });
});
