import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import SahiDawaHome from "../app/[locale]/page";
import { getVisibleAlertBatchNumber } from "../lib/alertFormatting";

const queryBuilder = {
    select: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
};

jest.mock("next/navigation", () => ({
    useParams: () => ({ locale: "en" }),
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("next-themes", () => ({
    useTheme: () => ({
        theme: "light",
        setTheme: jest.fn(),
    }),
}));

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: jest.fn(() => queryBuilder),
    },
}));

jest.mock("../app/[locale]/components/SearchBar", () => ({
    __esModule: true,
    default: () => <div data-testid="search-bar" />,
}));

describe("homepage i18n", () => {
    beforeEach(() => {
        queryBuilder.select.mockReturnValue(queryBuilder);
        queryBuilder.or.mockReturnValue(queryBuilder);
        queryBuilder.order.mockReturnValue(queryBuilder);
        queryBuilder.limit.mockResolvedValue({ data: [], error: null });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders homepage navigation, AI banner, alerts, and mobile labels from translation hooks", () => {
        const markup = renderToStaticMarkup(<SahiDawaHome />);

        expect(markup).toContain("Home.ai_health_assistant");
        expect(markup).toContain("Home.ai_chat");
        expect(markup).toContain("Home.ai_health_assistant_description");
        expect(markup).toContain("Home.chat_now");
        expect(markup).toContain("Home.live_cdsco_alerts");
        expect(markup).toContain("Home.india_region");
        expect(markup).toContain("Home.view_full_alert_log");
    });

    it("only exposes alert batch text when a new batch number should be appended", () => {
        expect(getVisibleAlertBatchNumber("Paracetamol recall reported", "B-42")).toBe("B-42");
        expect(getVisibleAlertBatchNumber("Paracetamol recall reported", null)).toBeNull();
        expect(getVisibleAlertBatchNumber("Paracetamol recall reported", "   ")).toBeNull();
        expect(
            getVisibleAlertBatchNumber("Paracetamol batch B-42 already listed", "b-42")
        ).toBeNull();
        expect(getVisibleAlertBatchNumber("Paracetamol 500mg recall reported", "500")).toBe("500");
        expect(
            getVisibleAlertBatchNumber("Paracetamol batch: 500 already listed", "500")
        ).toBeNull();
        expect(getVisibleAlertBatchNumber(null, 1024)).toBe("1024");
    });

    it("does not keep issue-listed homepage strings hardcoded in the page component", () => {
        const pageSource = readFileSync(join(process.cwd(), "app/[locale]/page.tsx"), "utf8");
        const hardcodedStrings = [
            "My Reports",
            "Open AI Health Assistant",
            "AI Health Assistant",
            "AI Chat",
            "Chat Now",
            "Get instant health advice",
            "Live CDSCO Alerts",
            "India Region",
            "All clear!",
            "No active regulatory alerts",
            "View Full Alert Log",
        ];

        for (const hardcodedString of hardcodedStrings) {
            expect(pageSource).not.toContain(`"${hardcodedString}`);
            expect(pageSource).not.toContain(`>${hardcodedString}`);
        }

        expect(pageSource).toContain('title={tHome("alerts_empty_title")}');
        expect(pageSource).toContain('description={tHome("alerts_empty_description")}');
        expect(pageSource).not.toMatch(/aria-label="(?:Home|Scans|Map|Alerts|Profile)"/);
        expect(pageSource).not.toMatch(/>\s*(?:Home|Scans|Map|Alerts|Profile)\s*</);
    });

    it("defines the homepage and navigation translation keys for every locale", () => {
        const messagesDir = join(process.cwd(), "messages");
        const requiredHomeKeys = [
            "open_ai_health_assistant",
            "ai_health_assistant",
            "ai_chat",
            "ai_health_assistant_description",
            "chat_now",
            "live_cdsco_alerts",
            "india_region",
            "alerts_empty_title",
            "alerts_empty_description",
            "view_full_alert_log",
        ];
        const requiredNavigationKeys = ["my_reports", "home", "scans", "map", "profile"];

        for (const fileName of readdirSync(messagesDir).filter((file) => file.endsWith(".json"))) {
            const messages = JSON.parse(readFileSync(join(messagesDir, fileName), "utf8"));

            for (const key of requiredHomeKeys) {
                expect(messages.Home?.[key]).toEqual(expect.any(String));
                expect(messages.Home[key].length).toBeGreaterThan(0);
            }

            for (const key of requiredNavigationKeys) {
                expect(messages.Navigation?.[key]).toEqual(expect.any(String));
                expect(messages.Navigation[key].length).toBeGreaterThan(0);
            }
        }
    });
});
