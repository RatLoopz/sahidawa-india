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
import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import MedicineSearchSelect from "../src/components/MedicineSearchSelect";

jest.mock("lucide-react", () => ({
    Clock: () => <span>Clock</span>,
    Loader2: () => <span>Loader</span>,
    Search: () => <span>Search</span>,
    X: () => <span>X</span>,
}));

describe("MedicineSearchSelect", () => {
    const mockMedicine = {
        id: "1",
        generic_name: "Paracetamol",
        brand_name: "Crocin",
        manufacturer: "GSK",
    } as any;

    const defaultProps = {
        label: "Medicine",
        value: null,
        onChange: jest.fn(),
        onSearch: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test("renders search input", () => {
        render(<MedicineSearchSelect {...defaultProps} />);

        expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("renders placeholder text", () => {
        render(<MedicineSearchSelect {...defaultProps} />);

        expect(screen.getByPlaceholderText(/search brand or generic name/i)).toBeInTheDocument();
    });

    test("renders custom placeholder", () => {
        render(<MedicineSearchSelect {...defaultProps} placeholder="Search medicines..." />);

        expect(screen.getByPlaceholderText("Search medicines...")).toBeInTheDocument();
    });

    test("renders selected medicine information", () => {
        render(<MedicineSearchSelect {...defaultProps} value={mockMedicine} />);

        expect(screen.getByText(/crocin/i)).toBeInTheDocument();

        expect(screen.getByText(/gsk/i)).toBeInTheDocument();
        expect(screen.queryByText(/search failed/i)).not.toBeInTheDocument();
    });

    test("clear button calls onChange with null", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        const onChange = jest.fn();

        render(<MedicineSearchSelect {...defaultProps} value={mockMedicine} onChange={onChange} />);

        await user.click(
            screen.getByRole("button", {
                name: /clear medicine/i,
            })
        );

        expect(onChange).toHaveBeenCalledWith(null);
    });

    test("shows minimum character guidance", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(<MedicineSearchSelect {...defaultProps} />);

        const input = screen.getByRole("combobox");

        await user.click(input);

        expect(screen.getByText(/enter at least 2 characters/i)).toBeInTheDocument();
    });

    test("renders search results", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });

        const onSearch = jest.fn().mockResolvedValue([mockMedicine]);

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        const input = screen.getByRole("combobox");

        await user.type(input, "cro");

        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(onSearch).toHaveBeenCalled();
        });

        expect(screen.getByText(/crocin/i)).toBeInTheDocument();

        expect(screen.getByText(/gsk/i)).toBeInTheDocument();
    });

    test("shows no results state", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });

        const onSearch = jest.fn().mockResolvedValue([]);

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        const input = screen.getByRole("combobox");

        await user.type(input, "xyz");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        await waitFor(() => {
            expect(onSearch).toHaveBeenCalled();
        });

        expect(screen.getByText(/no results/i)).toBeInTheDocument();
        expect(screen.queryByText(/search failed/i)).not.toBeInTheDocument();
    });

    test("shows an error instead of no results when search rejects", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        const onSearch = jest.fn().mockRejectedValue(new Error("Supabase unavailable"));

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        await user.type(screen.getByRole("combobox"), "cro");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Search failed. Please try again."
        );
        expect(screen.queryByText(/no results/i)).not.toBeInTheDocument();
        expect(localStorage.getItem("sahidawa_search_history")).toBeNull();
    });

    test("retries the same query and clears the previous error after success", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        const onSearch = jest
            .fn()
            .mockRejectedValueOnce(new Error("Temporary failure"))
            .mockResolvedValueOnce([mockMedicine]);

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        await user.type(screen.getByRole("combobox"), "  cro  ");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(await screen.findByRole("alert")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /retry/i }));

        await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(2));
        expect(onSearch).toHaveBeenNthCalledWith(1, "cro");
        expect(onSearch).toHaveBeenNthCalledWith(2, "cro");
        expect(await screen.findByText(/crocin/i)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("clears a failed search error when a new query succeeds", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        const onSearch = jest
            .fn()
            .mockRejectedValueOnce(new Error("Temporary failure"))
            .mockResolvedValueOnce([mockMedicine]);

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        const input = screen.getByRole("combobox");
        await user.type(input, "old");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(await screen.findByRole("alert")).toBeInTheDocument();

        await user.clear(input);
        await user.type(input, "cro");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(await screen.findByText(/crocin/i)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("ignores an older search failure after a newer query succeeds", async () => {
        const user = userEvent.setup({
            advanceTimers: jest.advanceTimersByTime,
        });
        let rejectOlderSearch: ((reason?: unknown) => void) | undefined;
        const olderSearch = new Promise<never>((_resolve, reject) => {
            rejectOlderSearch = reject;
        });
        const onSearch = jest
            .fn()
            .mockReturnValueOnce(olderSearch)
            .mockResolvedValueOnce([mockMedicine]);

        render(<MedicineSearchSelect {...defaultProps} onSearch={onSearch} />);

        const input = screen.getByRole("combobox");
        await user.type(input, "old");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(onSearch).toHaveBeenCalledWith("old");

        await user.clear(input);
        await user.type(input, "cro");
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
        expect(await screen.findByText(/crocin/i)).toBeInTheDocument();

        await act(async () => {
            rejectOlderSearch?.(new Error("Late failure"));
            await olderSearch.catch(() => undefined);
        });

        expect(screen.getByText(/crocin/i)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("renders search history when history exists", async () => {
        localStorage.setItem(
            "sahidawa_search_history",
            JSON.stringify([
                {
                    query: "Paracetamol",
                    savedAt: Date.now(),
                },
            ])
        );

        render(<MedicineSearchSelect {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText(/recent:/i)).toBeInTheDocument();
        });

        expect(screen.getByText("Paracetamol")).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: /clear history/i,
            })
        ).toBeInTheDocument();
    });

    test("clear history removes history items", async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        localStorage.setItem(
            "sahidawa_search_history",
            JSON.stringify([
                {
                    query: "Paracetamol",
                    savedAt: Date.now(),
                },
            ])
        );

        render(<MedicineSearchSelect {...defaultProps} />);

        await user.click(
            screen.getByRole("button", {
                name: /clear history/i,
            })
        );

        expect(screen.queryByText("Paracetamol")).not.toBeInTheDocument();
    });
});
