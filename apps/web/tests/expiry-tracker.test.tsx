/** @jest-environment jsdom */

/**
 * Tests for ExpiryTracker component — issue #2249
 *
 * Covers:
 *  1. Renders the medicine name heading.
 *  2. Renders the batch number and expiry date inputs.
 *  3. Renders the "Track Expiry" button using the i18n key.
 *  4. Calls /api/v1/medicines/track with the correct payload on button click.
 *  5. Shows the success alert when the API returns ok: true.
 *  6. Does NOT call the API when the component first mounts (no accidental side effects).
 *  7. Sends the correct Content-Type header.
 *  8. Handles a non-ok API response without throwing (graceful failure).
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpiryTracker } from "../components/ExpiryTracker";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => {
        const map: Record<string, string> = {
            success: "Medicine tracked successfully!",
            trackButton: "Track Expiry",
        };
        return map[key] ?? key;
    },
}));

const mockAlert = jest.fn();
global.alert = mockAlert;

function makeJsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => body,
    } as Response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
    medicineId: "med-001",
    medicineName: "Paracetamol 500mg",
};

function setup(props = DEFAULT_PROPS) {
    const user = userEvent.setup();
    const utils = render(<ExpiryTracker {...props} />);
    return { user, ...utils };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExpiryTracker component", () => {
    beforeEach(() => {
        mockAlert.mockClear();
        Object.defineProperty(global, "fetch", {
            configurable: true,
            writable: true,
            value: jest.fn(async () => makeJsonResponse({ tracked: true })),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the medicine name as a heading", () => {
        setup();
        expect(screen.getByRole("heading", { name: "Paracetamol 500mg" })).toBeInTheDocument();
    });

    it("renders a batch number text input", () => {
        setup();
        expect(screen.getByPlaceholderText("Batch Number")).toBeInTheDocument();
    });

    it("renders a date input for expiry date", () => {
        const { container } = setup();
        const dateInputEl = container.querySelector('input[type="date"]') as HTMLInputElement;
        expect(dateInputEl).toBeInTheDocument();
        expect(dateInputEl.type).toBe("date");
    });

    it("renders the Track Expiry button using the i18n key", () => {
        setup();
        expect(screen.getByRole("button", { name: /track expiry/i })).toBeInTheDocument();
    });

    it("does NOT call fetch on initial mount", () => {
        const fetchMock = global.fetch as jest.Mock;
        setup();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("calls /api/v1/medicines/track with correct payload on button click", async () => {
        const fetchMock = global.fetch as jest.Mock;
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        const trackBtn = screen.getByRole("button", { name: /track expiry/i });

        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2025-12-31" } });
        await user.click(trackBtn);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        const [calledUrl, calledOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(calledUrl).toBe("/api/v1/medicines/track");
        expect(calledOptions.method).toBe("POST");

        const body = JSON.parse(calledOptions.body as string);
        expect(body).toMatchObject({
            medicine_id: "med-001",
            medicine_name: "Paracetamol 500mg",
            batch_number: "B12345",
            expiry_date: "2025-12-31",
        });
    });

    it("sends the correct Content-Type header", async () => {
        const fetchMock = global.fetch as jest.Mock;
        const { user } = setup();

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        const [, calledOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect((calledOptions.headers as Record<string, string>)["Content-Type"]).toBe(
            "application/json"
        );
    });

    it("shows the success alert when the API returns ok: true", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            makeJsonResponse({ tracked: true }, true)
        );
        const { user } = setup();

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        await waitFor(() => {
            expect(mockAlert).toHaveBeenCalledWith("Medicine tracked successfully!");
        });
    });

    it("does NOT show a success alert when the API returns ok: false", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
            makeJsonResponse({ error: "Bad request" }, false, 400)
        );
        const { user } = setup();

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        // Give enough time for async handling
        await waitFor(() => expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(1));
        expect(mockAlert).not.toHaveBeenCalled();
    });

    it("works correctly with different medicine props", () => {
        render(<ExpiryTracker medicineId="med-999" medicineName="Ibuprofen 400mg" />);
        expect(screen.getByRole("heading", { name: "Ibuprofen 400mg" })).toBeInTheDocument();
    });
});
