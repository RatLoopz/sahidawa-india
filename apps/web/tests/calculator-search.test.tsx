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
/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CalculatorPage from "../app/[locale]/calculator/page";

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

    it("should encode double quotes in search query when calling API", async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }) as jest.Mock;

        try {
            render(<CalculatorPage />);

            // Find the medicine search select input
            const searchInput = screen.getByRole("combobox");

            // Type a query with double quotes: Crocin" OR "Paracetamol
            fireEvent.change(searchInput, { target: { value: 'Crocin" OR "Paracetamol' } });

            // Wait for debounced search to trigger the database query (MedicineSearchSelect has 300ms debounce)
            await waitFor(
                () => {
                    expect(global.fetch).toHaveBeenCalled();
                },
                { timeout: 1000 }
            );

            // Verify the argument passed to fetch
            const fetchMock = global.fetch as jest.Mock;
            const callArg = fetchMock.mock.calls[0][0];

            // It should be properly URI encoded
            expect(callArg).toBe("/api/medicines/search?q=Crocin%22%20OR%20%22Paracetamol");
        } finally {
            global.fetch = originalFetch;
        }
    });
});
