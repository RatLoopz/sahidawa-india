/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CalculatorPage from "../app/[locale]/calculator/page";

const mockFetchGenericAlternatives = jest.fn();

jest.mock("@/lib/api/alternatives", () => ({
    fetchGenericAlternatives: (...args: unknown[]) => mockFetchGenericAlternatives(...args),
}));

jest.mock("@/lib/supabase", () => {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        neq: jest.fn(),
        not: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.neq.mockReturnValue(query);
    query.not.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });

    return {
        supabase: {
            from: jest.fn().mockReturnValue(query),
        },
    };
});

jest.mock("next-intl", () => ({
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn() }),
    useParams: () => ({ locale: "en" }),
    useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

jest.mock("@/src/components/MedicineSearchSelect", () => ({
    __esModule: true,
    default: ({ onChange }: { onChange: (medicine: Record<string, unknown>) => void }) => (
        <button
            type="button"
            onClick={() =>
                onChange({
                    id: "medicine-1",
                    brand_name: "Brand Medicine",
                    generic_name: "Generic Medicine",
                    manufacturer: "Manufacturer",
                    mrp: 100,
                    jan_aushadhi_price: 40,
                    composition: "Test composition",
                    cdsco_approval_status: "approved",
                })
            }
        >
            Select medicine
        </button>
    ),
}));

jest.mock("@/components/GenericAlternativeCard", () => ({
    __esModule: true,
    default: () => <div>Generic alternative</div>,
}));

jest.mock("@/components/GenericAlternativeCardSkeleton", () => ({
    __esModule: true,
    default: () => <div>Loading alternative</div>,
}));

describe("CalculatorPage quantity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchGenericAlternatives.mockResolvedValue({
            brand_price: 100,
            jan_aushadhi_price: 40,
            nearest_store: null,
        });
    });

    async function renderCalculator() {
        render(<CalculatorPage />);
        fireEvent.click(screen.getByRole("button", { name: "Select medicine" }));
        return await screen.findByLabelText("Calculator.quantityLabel");
    }

    it.each([
        ["0", "1"],
        ["101", "100"],
        ["25", "25"],
    ])("clamps quantity %s to %s", async (enteredQuantity, expectedQuantity) => {
        const quantityInput = await renderCalculator();

        fireEvent.change(quantityInput, { target: { value: enteredQuantity } });

        expect(quantityInput).toHaveValue(Number(expectedQuantity));
    });

    it("uses the clamped quantity in savings calculations", async () => {
        const quantityInput = await renderCalculator();

        fireEvent.change(quantityInput, { target: { value: "150" } });

        expect(quantityInput).toHaveValue(100);
        await waitFor(() => {
            expect(screen.getByText("Calculator.monthlySavings").parentElement).toHaveTextContent(
                "₹6,000.00"
            );
            expect(screen.getByText("₹72,000.00")).toBeInTheDocument();
        });
    });
});
