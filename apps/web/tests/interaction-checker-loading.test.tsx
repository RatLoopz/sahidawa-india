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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import InteractionCheckerPage from "../app/[locale]/interaction-checker/page";
import { checkInteractions } from "@/lib/api/interactions";

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
    fuzzyMatchBrand: jest.fn(),
}));

jest.mock("@/lib/api/interactions", () => ({
    checkInteractions: jest.fn(),
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: () => <div data-testid="page-header" />,
}));

describe("InteractionCheckerPage loading state", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("sahidawa-my-medicines", JSON.stringify(["Crocin", "Warfarin"]));

        (checkInteractions as jest.Mock).mockReturnValue(new Promise(() => {}));
    });

    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("renders result-shaped skeletons while interaction results are loading", async () => {
        render(<InteractionCheckerPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Check Interactions" }));

        await waitFor(() => expect(checkInteractions).toHaveBeenCalledWith(["Crocin", "Warfarin"]));
        expect(screen.getByTestId("interaction-results-skeleton")).toBeInTheDocument();
        expect(screen.getAllByTestId("interaction-result-card-skeleton")).toHaveLength(2);
    });
});
