import {
    getChatbotPanelClasses,
    getChatbotPositionClasses,
    isLocalizedMapRoute,
} from "../app/[locale]/components/chatbotPosition";

describe("isLocalizedMapRoute", () => {
    it("matches localized map routes", () => {
        expect(isLocalizedMapRoute("/en/map")).toBe(true);
        expect(isLocalizedMapRoute("/ta/map/details")).toBe(true);
        expect(isLocalizedMapRoute("/zh-Hant/map")).toBe(true);
    });

    it("does not match non-map routes", () => {
        expect(isLocalizedMapRoute("/en/health")).toBe(false);
        expect(isLocalizedMapRoute("/map")).toBe(false);
        expect(isLocalizedMapRoute(null)).toBe(false);
    });
});

describe("getChatbotPositionClasses", () => {
    it("keeps the launcher on the right for non-map routes", () => {
        const classes = getChatbotPositionClasses({
            pathname: "/en/health",
            isOpen: false,
        });

        expect(classes).toContain("right-6");
        expect(classes).not.toContain("left-4");
        expect(classes).not.toContain("md:left-6");
    });

    it("moves the launcher to the left for map routes", () => {
        const classes = getChatbotPositionClasses({
            pathname: "/zh-Hant/map",
            isOpen: false,
        });

        expect(classes).toContain("left-4");
        expect(classes).toContain("md:left-[calc(clamp(22rem,26vw,30rem)+2.75rem)]");
        expect(classes).not.toContain("md:left-6");
        expect(classes).not.toContain("right-6");
    });

    it("uses an elevated mobile offset when the map-route chatbot is open", () => {
        const classes = getChatbotPositionClasses({
            pathname: "/en/map",
            isOpen: true,
        });

        expect(classes).toContain("bottom-24");
        expect(classes).toContain("md:bottom-6");
        expect(classes).toContain("md:left-[calc(clamp(22rem,26vw,30rem)+2.75rem)]");
    });
});

describe("getChatbotPanelClasses", () => {
    it("keeps the panel right-anchored for non-map routes", () => {
        const classes = getChatbotPanelClasses({
            pathname: "/en/health",
        });
        const classTokens = classes.split(" ");

        expect(classes).toContain("right-0");
        expect(classes).not.toContain("left-0");
        expect(classes).toContain("w-[min(22rem,calc(100vw-1.5rem))]");
        expect(classes).toContain("h-[min(28rem,calc(100dvh-8rem))]");
        expect(classes).toContain("md:w-[350px]");
        expect(classes).toContain("md:h-[450px]");
        expect(classTokens).not.toContain("h-[450px]");
    });

    it("uses a left-anchored responsive panel on map routes", () => {
        const classes = getChatbotPanelClasses({
            pathname: "/zh-Hant/map/details",
        });
        const classTokens = classes.split(" ");

        expect(classes).toContain("left-0");
        expect(classes).not.toContain("right-0");
        expect(classes).toContain("max-w-[calc(100vw-2rem)]");
        expect(classes).toContain("h-[min(28rem,calc(100dvh-8rem))]");
        expect(classes).toContain("md:h-[450px]");
        expect(classTokens).not.toContain("h-[450px]");
    });
});
