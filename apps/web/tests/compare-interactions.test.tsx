import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

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
    "Search Medicine 4": {
        id: "med-d",
        brand_name: "Allegra",
        generic_name: "Fexofenadine",
        composition: "Fexofenadine 120mg",
        manufacturer: "Allergy Care",
        cdsco_approval_status: "approved",
    },
    "Search Medicine 5": {
        id: "med-e",
        brand_name: "Augmentin",
        generic_name: "Amoxicillin",
        composition: "Amoxicillin 625mg",
        manufacturer: "Antibiotic Labs",
        cdsco_approval_status: "approved",
    },
    "Search Medicine 6": {
        id: "med-f",
        brand_name: "Cetrizine",
        generic_name: "Cetirizine",
        composition: "Cetirizine 10mg",
        manufacturer: "Allergy Relief",
        cdsco_approval_status: "approved",
    },
};

function setMedicineIds(first: string, second: string, third: string) {
    medicines["First medicine"].id = first;
    medicines["Second medicine"].id = second;
    medicines["Search Medicine 3"].id = third;
    medicines["Search Medicine 4"].id = "med-d";
    medicines["Search Medicine 5"].id = "med-e";
    medicines["Search Medicine 6"].id = "med-f";
}

function medicineRowsForIds(ids: readonly string[]) {
    const medicinesById = new Map(
        Object.values(medicines).map((medicine) => [medicine.id, medicine])
    );
    return ids
        .map((id) => medicinesById.get(id))
        .filter((medicine): medicine is Medicine => Boolean(medicine));
}

function createDeferredResponse(body: unknown) {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((promiseResolve) => {
        resolve = promiseResolve;
    });

    return {
        promise,
        resolve: () => resolve(jsonResponse(body)),
    };
}

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
        value,
        onChange,
    }: ComponentProps<typeof import("../src/components/MedicineSearchSelect").default>) => (
        <>
            {value ? (
                <button type="button" onClick={() => onChange(null)}>
                    Clear {label}
                </button>
            ) : (
                <button type="button" onClick={() => onChange(medicines[label])}>
                    Select {label}
                </button>
            )}
        </>
    ),
}));

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

function renderComparePage({
    searchParams = "",
    onUrlUpdate,
}: {
    searchParams?: string;
    onUrlUpdate?: (event: UrlUpdateEvent) => void;
} = {}) {
    return render(
        <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
            <ComparePage />
        </NuqsTestingAdapter>
    );
}

describe("ComparePage interaction warnings", () => {
    beforeEach(() => {
        setMedicineIds("med-a", "med-b", "med-c");

        queryBuilder.select.mockReturnValue(queryBuilder);
        queryBuilder.or.mockReturnValue(queryBuilder);
        queryBuilder.limit.mockResolvedValue({ data: [], error: null });
        queryBuilder.in.mockImplementation((_: string, ids: string[]) =>
            Promise.resolve({ data: medicineRowsForIds(ids), error: null })
        );

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
        renderComparePage();

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

    it("keeps stale interaction responses from replacing the latest selection", async () => {
        setMedicineIds("stale-a", "stale-b", "stale-c");

        const firstResponse = createDeferredResponse({
            interactions: [
                {
                    medicineAId: "stale-a",
                    medicineBId: "stale-b",
                    drugA: "Crocin",
                    drugB: "Warfarin",
                    severity: "High Risk",
                    sideEffects: "Outdated warning.",
                },
            ],
        });
        const latestResponse = createDeferredResponse({
            interactions: [
                {
                    medicineAId: "stale-b",
                    medicineBId: "stale-c",
                    drugA: "Warfarin",
                    drugB: "Brufen",
                    severity: "Moderate",
                    sideEffects: "Latest warning.",
                },
            ],
        });

        (global.fetch as jest.Mock)
            .mockReturnValueOnce(firstResponse.promise)
            .mockReturnValueOnce(latestResponse.promise);

        renderComparePage();

        fireEvent.click(screen.getByRole("button", { name: "Select First medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Second medicine" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByRole("button", { name: "Add medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Search Medicine 3" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

        latestResponse.resolve();
        expect(await screen.findByText("Latest warning.")).toBeInTheDocument();

        firstResponse.resolve();
        await waitFor(() =>
            expect(screen.queryByText("Outdated warning.")).not.toBeInTheDocument()
        );
        expect(screen.getByText("Latest warning.")).toBeInTheDocument();
    });

    it("uses the short-lived cache for identical selection keys", async () => {
        setMedicineIds("cache-a", "cache-b", "cache-c");

        const response = createDeferredResponse({
            interactions: [
                {
                    medicineAId: "cache-a",
                    medicineBId: "cache-b",
                    drugA: "Crocin",
                    drugB: "Warfarin",
                    severity: "High Risk",
                    sideEffects: "Cached warning.",
                },
            ],
        });

        (global.fetch as jest.Mock).mockReturnValueOnce(response.promise);

        const { unmount } = renderComparePage();

        fireEvent.click(screen.getByRole("button", { name: "Select First medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Second medicine" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        response.resolve();
        expect(await screen.findByText("Cached warning.")).toBeInTheDocument();

        unmount();
        renderComparePage();

        fireEvent.click(screen.getByRole("button", { name: "Select First medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Second medicine" }));

        expect(await screen.findByText("Cached warning.")).toBeInTheDocument();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("restores selected medicines from m1 through m6 query parameters", async () => {
        renderComparePage({
            searchParams: "?m1=med-a&m2=med-b&m3=med-c&m4=med-d&m5=med-e&m6=med-f&unrelated=keep",
        });

        expect((await screen.findAllByText("Crocin")).length).toBeGreaterThan(0);
        expect(screen.getAllByText("Warfarin").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Brufen").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Allegra").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Augmentin").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Cetrizine").length).toBeGreaterThan(0);
        expect(queryBuilder.in).toHaveBeenCalledWith("id", [
            "med-a",
            "med-b",
            "med-c",
            "med-d",
            "med-e",
            "med-f",
        ]);
    });

    it("updates the nuqs URL state when medicines are added", async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();

        renderComparePage({
            searchParams: "?m1=med-a&m2=med-b&unrelated=keep",
            onUrlUpdate,
        });

        expect((await screen.findAllByText("Crocin")).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole("button", { name: "Add medicine" }));
        fireEvent.click(screen.getByRole("button", { name: "Select Search Medicine 3" }));

        await waitFor(() => {
            const update = onUrlUpdate.mock.calls.at(-1)?.[0];
            expect(update?.searchParams.get("m1")).toBe("med-a");
            expect(update?.searchParams.get("m2")).toBe("med-b");
            expect(update?.searchParams.get("m3")).toBe("med-c");
            expect(update?.searchParams.get("unrelated")).toBe("keep");
            expect(update?.options.history).toBe("replace");
        });
    });

    it("compacts query params and clears unused medicine keys when a middle slot is removed", async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();

        renderComparePage({
            searchParams: "?m1=med-a&m2=med-b&m3=med-c&m4=med-d&unrelated=keep",
            onUrlUpdate,
        });

        expect((await screen.findAllByText("Brufen")).length).toBeGreaterThan(0);
        expect(screen.getAllByText("Allegra").length).toBeGreaterThan(0);

        fireEvent.click(screen.getByLabelText("clearAll: Search Medicine 3"));

        await waitFor(() => {
            const update = onUrlUpdate.mock.calls.at(-1)?.[0];
            expect(update?.searchParams.get("m1")).toBe("med-a");
            expect(update?.searchParams.get("m2")).toBe("med-b");
            expect(update?.searchParams.get("m3")).toBe("med-d");
            expect(update?.searchParams.get("m4")).toBeNull();
            expect(update?.searchParams.get("m5")).toBeNull();
            expect(update?.searchParams.get("m6")).toBeNull();
            expect(update?.searchParams.get("unrelated")).toBe("keep");
            expect(update?.options.history).toBe("replace");
        });
    });

    it("clears all medicine query params when the final selected medicine is cleared", async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();

        renderComparePage({
            searchParams: "?m1=med-a&unrelated=keep",
            onUrlUpdate,
        });

        expect((await screen.findAllByText("Crocin")).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole("button", { name: "Clear First medicine" }));

        await waitFor(() => {
            const update = onUrlUpdate.mock.calls.at(-1)?.[0];
            expect(update?.searchParams.get("m1")).toBeNull();
            expect(update?.searchParams.get("m2")).toBeNull();
            expect(update?.searchParams.get("m3")).toBeNull();
            expect(update?.searchParams.get("m4")).toBeNull();
            expect(update?.searchParams.get("m5")).toBeNull();
            expect(update?.searchParams.get("m6")).toBeNull();
            expect(update?.searchParams.get("unrelated")).toBe("keep");
            expect(update?.options.history).toBe("replace");
        });
    });
});
