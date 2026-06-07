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

describe("ExpiryTrackerPage import", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const createFile = (data: unknown): File => {
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        return new File([blob], "backup.json", { type: "application/json" });
    };

    it("imports valid JSON backup with correct YYYY-MM-DD dates", async () => {
        render(<ExpiryTrackerPage />);

        const backup = [
            { id: "1", name: "Ibuprofen", expiryDate: "2027-06-15" },
            { id: "2", name: "Aspirin", expiryDate: "2028-01-20" },
        ];
        const file = createFile(backup);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Ibuprofen" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Aspirin" })).toBeInTheDocument();
        });

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        expect(stored).toHaveLength(2);
    });

    it("rejects import if a date is malformed and shows error message", async () => {
        render(<ExpiryTrackerPage />);

        const backup = [
            { id: "1", name: "Bad Date", expiryDate: "2025-13-45" },
            { id: "2", name: "Good Date", expiryDate: "2027-06-15" },
        ];
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        fireEvent.change(fileInput, { target: { files: [createFile(backup)] } });

        await waitFor(() => {
            expect(screen.getByText("importDateError")).toBeInTheDocument();
        });

        expect(screen.queryByRole("heading", { name: "Bad Date" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Good Date" })).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
    });

    it("rejects import when expiryDate is not in YYYY-MM-DD format", async () => {
        render(<ExpiryTrackerPage />);

        const backup = [{ id: "1", name: "Wrong Format", expiryDate: "00/00/0000" }];
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        fireEvent.change(fileInput, { target: { files: [createFile(backup)] } });

        await waitFor(() => {
            expect(screen.getByText("importDateError")).toBeInTheDocument();
        });
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
    });
});
