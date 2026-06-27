/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CalculatorPage from "../app/[locale]/calculator/page";
import { supabase } from "@/lib/supabase";

// Mock supabase client
jest.mock("@/lib/supabase", () => {
    const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockOr = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
    const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

    return {
        supabase: {
            from: mockFrom,
            _mockOr: mockOr, // expose mock for checking calls
        },
    };
});

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
    useParams: () => ({ locale: "en" }),
    useSearchParams: () => ({
        get: jest.fn(),
    }),
}));

describe("CalculatorPage search safety", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should escape double quotes in search query to prevent PostgREST injection", async () => {
        render(<CalculatorPage />);

        // Find the medicine search select input
        const searchInput = screen.getByRole("combobox");

        // Type a query with double quotes: Crocin" OR "Paracetamol
        fireEvent.change(searchInput, { target: { value: 'Crocin" OR "Paracetamol' } });

        // Wait for debounced search to trigger the database query (MedicineSearchSelect has 300ms debounce)
        await waitFor(
            () => {
                expect(supabase.from).toHaveBeenCalledWith("medicines");
            },
            { timeout: 1000 }
        );

        // Verify the argument passed to .or()
        const mockOr = (supabase as any)._mockOr;
        expect(mockOr).toHaveBeenCalled();
        const callArg = mockOr.mock.calls[0][0];

        // It should contain properly escaped double quotes '""' instead of '"'
        expect(callArg).toContain('brand_name.ilike."%Crocin"" OR ""Paracetamol%"');
        expect(callArg).toContain('generic_name.ilike."%Crocin"" OR ""Paracetamol%"');
    });
});
