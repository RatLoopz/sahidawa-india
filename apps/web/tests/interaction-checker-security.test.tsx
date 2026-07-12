/** @jest-environment jsdom */

import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import InteractionCheckerPage from "../app/[locale]/interaction-checker/page";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => {
        const messages: Record<string, string> = {
            addButton: "Add",
            checkButton: "Check Interactions",
            clearAll: "Clear all",
            myMedicines: "My medicines",
            noMedicines: "No medicines added yet.",
            searchLabel: "Search medicine",
            searchPlaceholder: "Search medicine name",
            subtitle: "Check potential harmful interactions between multiple medications.",
            title: "Medicine Interaction Checker",
        };

        return (key: string) => messages[key] ?? key;
    },
}));

jest.mock("@/lib/api", () => ({
    fuzzyMatchBrand: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/api/interactions", () => ({
    checkInteractions: jest.fn().mockResolvedValue({ interactions: [], verified: true }),
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: () => <div data-testid="page-header" />,
}));

describe("InteractionCheckerPage Security & Sanitization", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("filters out control characters, HTML tags and keeps only safe values from local storage", async () => {
        const malformedData = [
            "Crocin",
            "Warfarin<script>alert(1)</script>",
            "A".repeat(150), // too long
            "   ", // empty
            "Paracetamol\u0000Special", // control char
        ];
        localStorage.setItem("sahidawa-my-medicines", JSON.stringify(malformedData));

        render(<InteractionCheckerPage />);

        // Crocin is valid, should be rendered
        expect(screen.getByText("Crocin")).toBeInTheDocument();

        // Warfarin<script>alert(1)</script> should be sanitized to "Warfarinscriptalert(1)/script"
        expect(screen.getByText("Warfarinscriptalert(1)/script")).toBeInTheDocument();

        // The extremely long medicine string should be filtered out
        expect(screen.queryByText("A".repeat(150))).not.toBeInTheDocument();

        // The control character item "Paracetamol\u0000Special" should become "ParacetamolSpecial"
        expect(screen.getByText("ParacetamolSpecial")).toBeInTheDocument();
    });

    it("sanitizes typed input on add medicine action", async () => {
        render(<InteractionCheckerPage />);

        const input = screen.getByPlaceholderText("Search medicine name");

        // Type a name containing HTML characters
        fireEvent.change(input, { target: { value: "Aspirin<script>" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        // Sanitized Aspirinscript should be added
        expect(screen.getByText("Aspirinscript")).toBeInTheDocument();
        expect(screen.queryByText("Aspirin<script>")).not.toBeInTheDocument();
    });

    it("restricts adding more than 50 medicines", async () => {
        // Manually preset 50 items in local storage
        const fiftyItems = Array.from({ length: 50 }, (_, i) => `Med-${i}`);
        localStorage.setItem("sahidawa-my-medicines", JSON.stringify(fiftyItems));

        render(<InteractionCheckerPage />);

        const input = screen.getByPlaceholderText("Search medicine name");

        // Try adding one more
        fireEvent.change(input, { target: { value: "ExtraMedicine" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        // Error message should be visible and item not added
        expect(
            await screen.findByText("Maximum of 50 medicines can be selected.")
        ).toBeInTheDocument();
        expect(screen.queryByText("ExtraMedicine")).not.toBeInTheDocument();
    });
});
