/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpandableDetails } from "../components/ExpandableDetails";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
}));

describe("ExpandableDetails", () => {
    const medicine = {
        brand_name: "Crocin",
        generic_name: "Paracetamol",
        manufacturer: "GSK",
        batch_number: "BATCH-001",
        dosage_form: "Tablet",
        composition: "Paracetamol 500mg",
    } as any;

    it("shows a medicine info copy button when expanded", async () => {
        const user = userEvent.setup();
        render(<ExpandableDetails medicine={medicine} />);

        await user.click(screen.getByRole("button", { name: "showMoreDetails" }));

        expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeInTheDocument();
        expect(screen.getByText("Paracetamol")).toBeInTheDocument();
        expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
    });
});
