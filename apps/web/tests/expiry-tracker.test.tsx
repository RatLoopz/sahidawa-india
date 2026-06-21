/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../lib/supabase", () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            order: jest.fn().mockReturnThis(),
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockResolvedValue({ data: null, error: null }),
            delete: jest.fn().mockReturnThis(),
        })),
        auth: {
            getSession: jest.fn().mockResolvedValue({
                data: { session: null },
                error: null,
            }),
            getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
    },
}));

import ExpiryTrackerPage from "../app/[locale]/expiry-tracker/page";
import { verifyMedicine } from "@/lib/api";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
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

jest.mock("@/components/scanner/BarcodeScanner", () => ({
    BarcodeScanner: ({
        onScan,
        apiError,
        onRetry,
    }: {
        onScan: (barcodeText: string) => void;
        apiError?: string | null;
        onRetry?: () => void;
    }) => (
        <div data-testid="barcode-scanner">
            <button type="button" onClick={() => onScan("SCAN-123")}>
                Emit scan
            </button>
            {apiError && (
                <button type="button" onClick={onRetry}>
                    Retry verification
                </button>
            )}
        </div>
    ),
}));

jest.mock("@/lib/api", () => ({
    verifyMedicine: jest.fn(),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    },
}));

const mockedVerifyMedicine = verifyMedicine as jest.MockedFunction<typeof verifyMedicine>;
const STORAGE_KEY = "sahidawa_expiry_tracker";
const waitForInitialLoad = async () => {
    await waitFor(() => {
        expect(screen.queryByText("loading")).not.toBeInTheDocument();
    });
};

describe("ExpiryTrackerPage", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    it("renders the add-medicine form with name, expiry and batch inputs", async () => {
        const { container } = render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        expect(screen.getByPlaceholderText("namePlaceholder")).toBeInTheDocument();
        expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
        expect(screen.getByPlaceholderText("batchPlaceholder")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "addToTracker" })).toBeInTheDocument();
    });

    it("opens the barcode scanner from the add-medicine form", async () => {
        render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        fireEvent.click(screen.getByRole("button", { name: /scan barcode/i }));

        expect(screen.getByRole("dialog", { name: /scan medicine barcode/i })).toBeInTheDocument();
        expect(screen.getByTestId("barcode-scanner")).toBeInTheDocument();
    });

    it("auto-fills medicine fields after a verified barcode scan", async () => {
        mockedVerifyMedicine.mockResolvedValueOnce({
            verified: true,
            medicine: {
                brand_name: "Calpol",
                generic_name: "Paracetamol",
                manufacturer: "Acme Pharma",
                batch_number: "BATCH-42",
                expiry_date: "2027-04-30T00:00:00+05:30",
                cdsco_approval_status: "approved",
                is_counterfeit_alert: false,
            },
        });

        const { container } = render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        fireEvent.click(screen.getByRole("button", { name: /scan barcode/i }));
        fireEvent.click(screen.getByRole("button", { name: "Emit scan" }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText("namePlaceholder")).toHaveValue("Calpol");
        });

        expect(mockedVerifyMedicine).toHaveBeenCalledWith("SCAN-123");
        expect(screen.getByPlaceholderText("batchPlaceholder")).toHaveValue("BATCH-42");
        expect(container.querySelector('input[type="date"]')).toHaveValue("2027-04-30");
        expect(
            (screen.getByPlaceholderText("notesPlaceholder") as HTMLTextAreaElement).value
        ).toContain("Generic: Paracetamol");
        expect(
            screen.queryByRole("dialog", { name: /scan medicine barcode/i })
        ).not.toBeInTheDocument();
    });

    it.each(["04/2027", "04/27", "2027-04"])(
        "uses the last day of the month for scanned %s expiry",
        async (expiryDate) => {
            mockedVerifyMedicine.mockResolvedValueOnce({
                verified: true,
                medicine: {
                    brand_name: "",
                    generic_name: "Cetirizine",
                    manufacturer: "Acme Pharma",
                    batch_number: "CET-7",
                    expiry_date: expiryDate,
                    cdsco_approval_status: "approved",
                    is_counterfeit_alert: false,
                },
            });

            const { container } = render(<ExpiryTrackerPage />);
            await waitForInitialLoad();

            fireEvent.click(screen.getByRole("button", { name: /scan barcode/i }));
            fireEvent.click(screen.getByRole("button", { name: "Emit scan" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("namePlaceholder")).toHaveValue("Cetirizine");
            });

            expect(screen.getByPlaceholderText("batchPlaceholder")).toHaveValue("CET-7");
            expect(container.querySelector('input[type="date"]')).toHaveValue("2027-04-30");
        }
    );

    it("keeps an existing expiry date when verified scan has no expiry", async () => {
        mockedVerifyMedicine.mockResolvedValueOnce({
            verified: true,
            medicine: {
                brand_name: "Crocin",
                generic_name: "Paracetamol",
                manufacturer: "Acme Pharma",
                batch_number: "CRO-9",
                expiry_date: null,
                cdsco_approval_status: "approved",
                is_counterfeit_alert: false,
            },
        });

        const { container } = render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        fireEvent.change(container.querySelector('input[type="date"]')!, {
            target: { value: "2027-01-15" },
        });
        fireEvent.click(screen.getByRole("button", { name: /scan barcode/i }));
        fireEvent.click(screen.getByRole("button", { name: "Emit scan" }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText("namePlaceholder")).toHaveValue("Crocin");
        });

        expect(screen.getByPlaceholderText("batchPlaceholder")).toHaveValue("CRO-9");
        expect(container.querySelector('input[type="date"]')).toHaveValue("2027-01-15");
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
        fireEvent.click(within(card).getAllByRole("button")[1]);

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

        const user = userEvent.setup();
        await user.upload(fileInput, file);

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

        const user = userEvent.setup();
        await user.upload(fileInput, createFile(backup));

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

        const user = userEvent.setup();
        await user.upload(fileInput, createFile(backup));

        await waitFor(() => {
            expect(screen.getByText("importDateError")).toBeInTheDocument();
        });
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
    });
});
describe("Date Handling and Sorting", () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-06-08T00:00:00Z"));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        localStorage.clear();
    });

    it("loads initial data from localStorage, handles date boundaries, and sorts correctly", async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([
                { id: "1", name: "Future Med", expiryDate: "2028-01-01", batchNumber: "F-1" },
                { id: "2", name: "Expired Med", expiryDate: "2025-01-01", batchNumber: "E-1" },
                { id: "3", name: "Expiring Today", expiryDate: "2026-06-08", batchNumber: "T-1" },
            ])
        );

        render(<ExpiryTrackerPage />);

        expect(await screen.findByRole("heading", { name: "Future Med" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Expired Med" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Expiring Today" })).toBeInTheDocument();
    });
});
