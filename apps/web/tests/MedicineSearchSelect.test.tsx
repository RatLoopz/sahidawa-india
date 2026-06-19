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

        jest.advanceTimersByTime(300);

        await waitFor(() => {
            expect(onSearch).toHaveBeenCalled();
        });

        expect(screen.getByText(/no results/i)).toBeInTheDocument();
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
