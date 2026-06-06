/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ExpiryTrackerPage from "../app/[locale]/expiry-tracker/page";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
        <header>
            <a href="/">Back</a>
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </header>
    ),
}));

const STORAGE_KEY = "sahidawa_expiry_tracker";

describe("ExpiryTrackerPage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders the add-medicine form with name, expiry and batch inputs", () => {
        const { container } = render(<ExpiryTrackerPage />);

        expect(screen.getByPlaceholderText("namePlaceholder")).toBeInTheDocument();
        expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
        expect(screen.getByPlaceholderText("batchPlaceholder")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "addToTracker" })).toBeInTheDocument();
    });

    it("adds a submitted medicine to the tracked list and persists it to localStorage", async () => {
        const { container } = render(<ExpiryTrackerPage />);

        fireEvent.change(screen.getByPlaceholderText("namePlaceholder"), {
            target: { value: "Paracetamol" },
        });
        fireEvent.change(container.querySelector('input[type="date"]')!, {
            target: { value: "2027-01-15" },
        });
        fireEvent.change(screen.getByPlaceholderText("batchPlaceholder"), {
            target: { value: "BATCH-001" },
        });

        fireEvent.click(screen.getByRole("button", { name: "addToTracker" }));

        expect(await screen.findByRole("heading", { name: "Paracetamol" })).toBeInTheDocument();

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            name: "Paracetamol",
            expiryDate: "2027-01-15",
            batchNumber: "BATCH-001",
        });
    });

    it("removes a medicine from the list and localStorage when its delete button is clicked", async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { id: "1", name: "Amoxicillin", expiryDate: "2027-05-20", batchNumber: "AMX-9" },
            ])
        );

        render(<ExpiryTrackerPage />);

        const heading = await screen.findByRole("heading", { name: "Amoxicillin" });
        const card = heading.closest("div.rounded-2xl") as HTMLElement;
        fireEvent.click(within(card).getByRole("button"));

        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: "Amoxicillin" })).not.toBeInTheDocument();
        });
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual([]);
    });
});
