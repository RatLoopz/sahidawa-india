/** @jest-environment jsdom */

/**
 * Tests for ExpiryTracker component — issue #2249, #3612
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
 *  9. [#3612] Disables the submit button while the tracking request is in-flight.
 * 10. [#3612] Re-enables the submit button after the request completes successfully.
 * 11. [#3612] Shows an error message (and re-enables the button) when the network throws.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExpiryTracker } from "../components/ExpiryTracker";
import { API_BASE, getCsrfToken } from "@/lib/api";
import { fetchWithRetry } from "@/lib/apiWithRetry";
import { useSession } from "@/src/components/AuthProvider";

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

jest.mock("@/lib/api", () => ({
    API_BASE: "http://localhost:4000",
    getCsrfToken: jest.fn(),
}));

jest.mock("@/lib/apiWithRetry", () => ({
    fetchWithRetry: jest.fn(),
}));

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: jest.fn(),
}));

const mockAlert = jest.fn();
global.alert = mockAlert;
const mockGetCsrfToken = jest.mocked(getCsrfToken);
const mockFetchWithRetry = jest.mocked(fetchWithRetry);
const mockUseSession = jest.mocked(useSession);

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
        jest.clearAllMocks();
        mockAlert.mockClear();
        Object.defineProperty(global, "fetch", {
            configurable: true,
            writable: true,
            value: jest.fn(async () => makeJsonResponse({ tracked: true })),
        });
        mockUseSession.mockReturnValue({
            token: "access-token-123",
            session: null,
            isLoading: false,
        });
        mockGetCsrfToken.mockResolvedValue("csrf-token-123");
        mockFetchWithRetry.mockResolvedValue(makeJsonResponse({ tracked: true }));
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
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });

    it("calls /api/v1/medicines/track with correct payload on button click", async () => {
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        const trackBtn = screen.getByRole("button", { name: /track expiry/i });

        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });
        await user.click(trackBtn);

        await waitFor(() => {
            expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
        });

        const [calledUrl, calledOptions] = mockFetchWithRetry.mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(calledUrl).toBe(`${API_BASE}/api/v1/medicines/track`);
        expect(calledOptions.method).toBe("POST");
        expect(mockGetCsrfToken).toHaveBeenCalledTimes(1);
        expect(calledOptions.credentials).toBe("include");
        expect(calledOptions.headers).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer access-token-123",
            "x-csrf-token": "csrf-token-123",
        });

        const body = JSON.parse(calledOptions.body as string);
        expect(body).toMatchObject({
            medicine_id: "med-001",
            medicine_name: "Paracetamol 500mg",
            batch_number: "B12345",
            expiry_date: "2099-12-31",
        });
    });

    it("sends the correct Content-Type header", async () => {
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledTimes(1));

        const [, calledOptions] = mockFetchWithRetry.mock.calls[0] as [string, RequestInit];
        expect((calledOptions.headers as Record<string, string>)["Content-Type"]).toBe(
            "application/json"
        );
    });

    it("shows the success alert when the API returns ok: true", async () => {
        mockFetchWithRetry.mockResolvedValueOnce(makeJsonResponse({ tracked: true }, true));
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        await waitFor(() => {
            expect(mockAlert).toHaveBeenCalledWith("Medicine tracked successfully!");
        });
    });

    it("does NOT show a success alert when the API returns ok: false", async () => {
        mockFetchWithRetry.mockResolvedValueOnce(
            makeJsonResponse({ error: "Bad request" }, false, 400)
        );
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });

        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        // Give enough time for async handling
        await waitFor(() => expect(mockFetchWithRetry).toHaveBeenCalledTimes(1));
        expect(mockAlert).not.toHaveBeenCalled();
    });

    it("does not submit when authentication is unavailable", async () => {
        mockUseSession.mockReturnValue({ token: null, session: null, isLoading: false });
        const { user } = setup();

        await user.type(screen.getByPlaceholderText("Batch Number"), "B12345");
        fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
            target: { value: "2099-12-31" },
        });
        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        expect(mockGetCsrfToken).not.toHaveBeenCalled();
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toHaveTextContent("error");
    });

    it("works correctly with different medicine props", () => {
        render(<ExpiryTracker medicineId="med-999" medicineName="Ibuprofen 400mg" />);
        expect(screen.getByRole("heading", { name: "Ibuprofen 400mg" })).toBeInTheDocument();
    });

    // -----------------------------------------------------------------------
    // #3612 — loading state / duplicate-submit prevention
    // -----------------------------------------------------------------------

    it("[#3612] disables the submit button while the tracking request is in-flight", async () => {
        let resolveRequest!: (value: Response) => void;
        mockFetchWithRetry.mockReturnValueOnce(
            new Promise<Response>((res) => {
                resolveRequest = res;
            })
        );

        const { user } = setup();
        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        const trackBtn = screen.getByRole("button", { name: /track expiry/i });

        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });

        // Click — the request is still pending
        await user.click(trackBtn);

        // Button should be disabled while in-flight
        await waitFor(() => {
            expect(screen.getByRole("button")).toBeDisabled();
        });

        // Resolve the pending request
        resolveRequest(makeJsonResponse({ tracked: true }, true));
    });

    it("[#3612] re-enables the submit button after the request completes successfully", async () => {
        mockFetchWithRetry.mockResolvedValueOnce(makeJsonResponse({ tracked: true }, true));
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;

        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });
        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        // After completion the button must be interactive again
        await waitFor(() => {
            expect(screen.getByRole("button")).not.toBeDisabled();
        });
    });

    it("[#3612] shows an error and re-enables the button when the network throws", async () => {
        mockFetchWithRetry.mockRejectedValueOnce(new Error("Network error"));
        const { user } = setup();

        const batchInput = screen.getByPlaceholderText("Batch Number");
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;

        await user.type(batchInput, "B12345");
        fireEvent.change(dateInput, { target: { value: "2099-12-31" } });
        await user.click(screen.getByRole("button", { name: /track expiry/i }));

        // Error message must be visible
        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });

        // Button must be re-enabled after the catch block runs
        expect(screen.getByRole("button")).not.toBeDisabled();

        // No success alert
        expect(mockAlert).not.toHaveBeenCalled();
    });
});
