import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SearchBar from "../app/[locale]/components/SearchBar";
import { fuzzyMatchBrand } from "@/lib/api";
import { supabase } from "@/lib/supabase";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock("lucide-react", () => ({
    Search: () => <span aria-hidden="true">search</span>,
    X: () => <span aria-hidden="true">close</span>,
    Clock: () => <span aria-hidden="true">clock</span>,
    Pin: () => <span aria-hidden="true">pin</span>,
}));

jest.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getTotalSize: () => count * 48,
        getVirtualItems: () =>
            Array.from({ length: count }, (_, index) => ({
                index,
                start: index * 48,
                measureElement: jest.fn(),
            })),
        scrollToIndex: jest.fn(),
        measureElement: jest.fn(),
    }),
}));

jest.mock("@/lib/api", () => ({
    fuzzyMatchBrand: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
    supabase: { from: jest.fn() },
}));

type MedicineRow = { brand_name: string | null; batch_number: string | null };
type QueryResponse = {
    data: MedicineRow[] | null;
    error: { message: string; code?: string } | null;
};

const mockedFuzzyMatchBrand = fuzzyMatchBrand as jest.MockedFunction<typeof fuzzyMatchBrand>;
const mockedFrom = supabase.from as jest.Mock;

function createQueryBuilder(responses: Array<Promise<QueryResponse>>) {
    const builder = {
        select: jest.fn(),
        or: jest.fn(),
        abortSignal: jest.fn(),
        limit: jest.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.or.mockReturnValue(builder);
    builder.abortSignal.mockReturnValue(builder);
    builder.limit.mockImplementation(() => {
        const response = responses.shift();
        if (!response) throw new Error("No mocked Supabase response remains");
        return response;
    });
    mockedFrom.mockReturnValue(builder);
    return builder;
}

async function enterQuery(value: string) {
    fireEvent.change(screen.getByRole("combobox"), { target: { value } });
    await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("SearchBar suggestion failures", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        localStorage.clear();
        Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
        mockedFuzzyMatchBrand.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("shows an unavailable state without fabricated suggestions on network failure", async () => {
        const onSearchChange = jest.fn();
        createQueryBuilder([Promise.reject(new TypeError("Failed to fetch"))]);
        render(<SearchBar onSearchChange={onSearchChange} />);

        await enterQuery("Crocin");

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Search is temporarily unavailable. Please try again."
        );
        expect(screen.queryByText("Crocin Advance")).not.toBeInTheDocument();
        expect(screen.queryByText("Dolo 650")).not.toBeInTheDocument();
        expect(screen.queryByText("BATCH-CR100")).not.toBeInTheDocument();
        expect(screen.queryByText("BATCH-DL650")).not.toBeInTheDocument();
        expect(screen.getByRole("combobox")).toHaveValue("Crocin");
        expect(onSearchChange).not.toHaveBeenCalledWith("Crocin");
    });

    it("renders genuine results and preserves selection behavior", async () => {
        const onSearchChange = jest.fn();
        createQueryBuilder([
            Promise.resolve({
                data: [{ brand_name: "Verified Medicine", batch_number: "REAL-2026" }],
                error: null,
            }),
        ]);
        render(<SearchBar onSearchChange={onSearchChange} />);

        await enterQuery("Verified");
        fireEvent.mouseDown(screen.getByRole("option", { name: "Verified Medicine" }));

        expect(onSearchChange).toHaveBeenCalledWith("Verified Medicine");
        expect(screen.getByRole("combobox")).toHaveValue("Verified Medicine");
    });

    it("distinguishes a successful empty response from request failure", async () => {
        createQueryBuilder([Promise.resolve({ data: [], error: null })]);
        render(<SearchBar />);

        await enterQuery("Unknown medicine");

        expect(await screen.findByRole("status")).toHaveTextContent("No medicines found");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows an offline state without querying or rendering fabricated suggestions", async () => {
        Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
        render(<SearchBar />);

        await enterQuery("Dolo");

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Search is unavailable while offline."
        );
        expect(mockedFrom).not.toHaveBeenCalled();
        expect(screen.queryByText("Dolo 650")).not.toBeInTheDocument();
        expect(screen.getByRole("combobox")).toHaveValue("Dolo");
    });

    it("clears suggestions from a previous successful search when a later request fails", async () => {
        createQueryBuilder([
            Promise.resolve({
                data: [{ brand_name: "First Genuine Result", batch_number: "REAL-1" }],
                error: null,
            }),
            Promise.resolve({ data: null, error: { message: "Failed to fetch" } }),
        ]);
        render(<SearchBar />);

        await enterQuery("First");
        expect(screen.getByRole("option", { name: "First Genuine Result" })).toBeInTheDocument();

        await enterQuery("Second");

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(
            screen.queryByRole("option", { name: "First Genuine Result" })
        ).not.toBeInTheDocument();
    });

    it("ignores an aborted older request and lets the newer request control the UI", async () => {
        let resolveOlder: ((response: QueryResponse) => void) | undefined;
        const olderResponse = new Promise<QueryResponse>((resolve) => {
            resolveOlder = resolve;
        });
        const builder = createQueryBuilder([
            olderResponse,
            Promise.resolve({
                data: [{ brand_name: "New Genuine Result", batch_number: "REAL-NEW" }],
                error: null,
            }),
        ]);
        render(<SearchBar />);

        await enterQuery("Old");
        await enterQuery("New");
        expect((builder.abortSignal.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
        expect(screen.getByRole("option", { name: "New Genuine Result" })).toBeInTheDocument();

        await act(async () => {
            resolveOlder?.({
                data: [{ brand_name: "Old Stale Result", batch_number: "REAL-OLD" }],
                error: null,
            });
            await olderResponse;
        });

        expect(screen.getByRole("option", { name: "New Genuine Result" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Old Stale Result" })).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
