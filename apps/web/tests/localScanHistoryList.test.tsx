/** @jest-environment jsdom */

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
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocalScanHistoryList } from "@/components/history/LocalScanHistoryList";
import { getLocalScanHistoryPage, clearLocalScanHistory } from "@/lib/localScanHistory";

jest.mock("@/lib/localScanHistory", () => ({
    DEFAULT_LOCAL_SCAN_HISTORY_PAGE_SIZE: 20,
    clearLocalScanHistory: jest.fn(),
    getLocalScanHistoryPage: jest.fn(),
}));

const mockedGetLocalScanHistoryPage = getLocalScanHistoryPage as jest.MockedFunction<
    typeof getLocalScanHistoryPage
>;
const mockedClearLocalScanHistory = clearLocalScanHistory as jest.MockedFunction<
    typeof clearLocalScanHistory
>;

const makeEntry = (index: number) => ({
    id: `scan-${index}`,
    scannedAt: `2026-06-07T10:${String(index).padStart(2, "0")}:00.000Z`,
    query: `BATCH-${index}`,
    source: "manual" as const,
    status: "verified" as const,
    brandName: `Medicine ${index}`,
    genericName: "Generic",
    manufacturer: "Sahi Pharma",
    batchNumber: `BATCH-${index}`,
    expiryDate: null,
    cdscoApprovalStatus: "approved",
    isCounterfeitAlert: false,
});

describe("LocalScanHistoryList", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedClearLocalScanHistory.mockResolvedValue();
    });

    it("renders one page of scan history and requests the next page on demand", async () => {
        mockedGetLocalScanHistoryPage
            .mockResolvedValueOnce({
                entries: Array.from({ length: 20 }, (_, index) => makeEntry(index + 1)),
                page: 1,
                pageSize: 20,
                total: 45,
                totalPages: 3,
                hasPreviousPage: false,
                hasNextPage: true,
            })
            .mockResolvedValueOnce({
                entries: Array.from({ length: 20 }, (_, index) => makeEntry(index + 21)),
                page: 2,
                pageSize: 20,
                total: 45,
                totalPages: 3,
                hasPreviousPage: true,
                hasNextPage: true,
            });

        render(<LocalScanHistoryList />);

        expect(await screen.findByText("Medicine 1")).toBeInTheDocument();
        expect(screen.getByText("Showing 1-20 of 45 scans")).toBeInTheDocument();
        expect(screen.queryByText("Medicine 21")).not.toBeInTheDocument();
        expect(mockedGetLocalScanHistoryPage).toHaveBeenCalledWith(1, 20);

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));

        await waitFor(() => {
            expect(mockedGetLocalScanHistoryPage).toHaveBeenLastCalledWith(2, 20);
        });
        expect(await screen.findByText("Medicine 21")).toBeInTheDocument();
        expect(screen.getByText("Showing 21-40 of 45 scans")).toBeInTheDocument();
        expect(screen.queryByText("Medicine 1")).not.toBeInTheDocument();
    });
});
