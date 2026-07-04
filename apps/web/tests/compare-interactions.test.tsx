/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";

import ComparePage from "../app/[locale]/compare/page";
import type { Medicine } from "../src/components/ComparisonGrid";

const medicines: Record<string, Medicine> = {
    "First medicine": {
        id: "med-a",
        brand_name: "Crocin",
        generic_name: "Paracetamol",
        composition: "Paracetamol 500mg",
        manufacturer: "ABC Pharma",
        cdsco_approval_status: "approved",
    },
    "Second medicine": {
        id: "med-b",
        brand_name: "Warfarin",
        generic_name: "Warfarin",
        composition: "Warfarin 5mg",
        manufacturer: "Care Pharma",
        cdsco_approval_status: "approved",
    },
    "Search Medicine 3": {
        id: "med-c",
        brand_name: "Brufen",
        generic_name: "Ibuprofen",
        composition: "Ibuprofen 400mg",
        manufacturer: "Pain Relief Labs",
        cdsco_approval_status: "approved",
    },
};

const queryBuilder = {
    select: jest.fn(),
    or: jest.fn(),
    limit: jest.fn(),
    in: jest.fn(),
};

jest.mock("@/lib/supabase", () => ({
    supabase: {
        from: jest.fn(() => queryBuilder),
    },
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => {
        const messages: Record<string, string> = {
            addMedicine: "Add medicine",
            checkButton: "Check Interactions",
            checkingInteractions: "Checking interaction warnings...",
            emptyComparison: "Select two medicines above to see the comparison.",
            fieldHeader: "Field",
            findPharmacies: "Find pharmacies",
            firstMedicine: "First medicine",
            errorMessage: "Unable to check medicine interactions.",
            medicineA: "Medicine A",
            medicineB: "Medicine B",
            moderate: "Moderate",
            noInteractions: "No interactions found.",
            noSavings: "No savings",
            pageSubtitle: "Brand vs generic side by side",
            pageTitle: "Compare medicines",
            priceUnavailable: "Price unavailable",
            printExport: "Print / Export PDF",
            reportTitle: "SahiDawa Medicine Comparison Report",
            alerts_empty_title: "All clear!",
            secondMedicine: "Second medicine",
            searchPlaceholder: "Search brand or generic name",
            searchLabel: "Search Medicine",
            severityModerate: "Moderate Caution",
            severitySerious: "Serious Warning",
            subtitle: "Check potential harmful interactions between multiple medications",
            title: "Medicine Interaction Checker",
            "medicineTypes.brand": "Brand",
            "medicineTypes.generic": "Generic",
            "rows.brandName": "Brand name",
            "rows.cdscoStatus": "CDSCO status",
            "rows.composition": "Composition",
            "rows.expiryDate": "Expiry date",
            "rows.genericName": "Generic name",
            "rows.janAushadhiPrice": "Jan Aushadhi price",
            "rows.manufacturer": "Manufacturer",
            "rows.marketPrice": "Market price (MRP)",
            "rows.savings": "Savings vs MRP",
            "rows.type": "Type",
            "status.approved": "Approved",
            "status.banned": "Banned",
            "status.recalled": "Recalled",
        };

        return (key: string, values?: Record<string, unknown>) => {
            if (key === "generatedOn") return `Generated on ${String(values?.date)}`;
            if (key === "saveAmount") return `Save ₹${values?.amount} (${values?.percent}%)`;
            return messages[key] ?? key;
        };
    },
}));

jest.mock("../src/components/MedicineSearchSelect", () => ({
    __esModule: true,
    default: ({
        label,
        onChange,
    }: ComponentProps<typeof import("../src/components/MedicineSearchSelect").default>) => (
        <button type="button" onClick={() => onChange(medicines[label])}>
            Select {label}
        </button>
    ),
}));

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

describe("ComparePage interaction warnings", () => {
    beforeEach(() => {
        queryBuilder.select.mockReturnValue(queryBuilder);
        queryBuilder.or.mockReturnValue(queryBuilder);
        queryBuilder.limit.mockResolvedValue({ data: [], error: null });
        queryBuilder.in.mockResolvedValue({ data: [], error: null });

        Object.defineProperty(global, "fetch", {
            configurable: true,
            writable: true,
            value: jest.fn(async () =>
                jsonResponse({
                    interactions: [
                        {
                            medicineAId: "med-a",
                            medicineBId: "med-b",
                            drugA: "Crocin",
                            drugB: "Warfarin",
                            severity: "High Risk",
                            sideEffects: "May increase bleeding risk.",
                            precautions: "Monitor INR and bleeding symptoms.",
                        },
                        {
                            medicineAId: "med-a",
                            medicineBId: "med-c",
                            drugA: "Crocin",
                            drugB: "Brufen",
                            severity: "Safe",
                            sideEffects: "No known harmful interaction found.",
                            precautions: "Use as directed.",
                        },
                        {
                            medicineAId: "med-b",
                            medicineBId: "med-c",
                            drugA: "Warfarin",
                            drugB: "Brufen",
                            severity: "Moderate",
                            sideEffects: "May increase stomach bleeding risk.",
                            precautions: "Use only with clinician guidance.",
                        },
                    ],
                })
            ),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("checks interactions for more than two selected medicines and renders severity tags", async () => {
        render(<ComparePage />);

        fireEvent.click(screen.getByRole("button", { name: "Select First medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Second medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Add medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Search Medicine 3" }));

        let requestedUrl: URL | null = null;
        await waitFor(() => {
            const requestUrl = String((global.fetch as jest.Mock).mock.calls.at(-1)?.[0]);
            expect(requestUrl).toContain("/api/v1/interactions");
            requestedUrl = new URL(requestUrl, "http://localhost:3000");
            expect(requestedUrl.searchParams.get("ids")).toBe("med-a,med-b,med-c");
        });

        expect(requestedUrl?.searchParams.get("ids")).toBe("med-a,med-b,med-c");

        expect(await screen.findByText("Medicine Interaction Checker")).toBeInTheDocument();
        expect(screen.getByText("Serious Warning")).toBeInTheDocument();
        expect(screen.getByText("Moderate Caution")).toBeInTheDocument();
        expect(screen.getByText("All clear!")).toBeInTheDocument();
        expect(screen.getByText("Crocin + Warfarin")).toBeInTheDocument();
        expect(screen.getByText("Monitor INR and bleeding symptoms.")).toBeInTheDocument();
    });
});
