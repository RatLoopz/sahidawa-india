/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecallPushSubscriber from "@/components/alerts/RecallPushSubscriber";
import { getCsrfToken } from "@/lib/api";
import { fetchWithRetry } from "@/lib/apiWithRetry";
import { useSession } from "@/src/components/AuthProvider";

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

const mockGetCsrfToken = jest.mocked(getCsrfToken);
const mockFetchWithRetry = jest.mocked(fetchWithRetry);
const mockUseSession = jest.mocked(useSession);
const mockFetch = jest.fn();
const mockGetRegistration = jest.fn();
const mockRegister = jest.fn();

function createSubscription() {
    return {
        endpoint: "https://push.example/subscription-1",
        unsubscribe: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
            endpoint: "https://push.example/subscription-1",
            keys: { p256dh: "key", auth: "auth" },
        }),
    };
}

function createRegistration(subscription: ReturnType<typeof createSubscription> | null) {
    return {
        pushManager: {
            getSubscription: jest.fn().mockResolvedValue(subscription),
            subscribe: jest.fn().mockResolvedValue(subscription),
        },
    };
}

describe("RecallPushSubscriber", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseSession.mockReturnValue({
            token: "access-token-123",
            session: null,
            isLoading: false,
        });
        mockGetCsrfToken.mockResolvedValue("csrf-token-123");
        Object.defineProperty(global, "fetch", { value: mockFetch, writable: true });
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ configured: true, publicKey: "AQ" }),
        });
        Object.defineProperty(global, "Notification", {
            configurable: true,
            value: { requestPermission: jest.fn().mockResolvedValue("granted") },
        });
        Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: {
                getRegistration: mockGetRegistration,
                register: mockRegister,
            },
        });
    });

    it("registers a push subscription with CSRF and Bearer credentials", async () => {
        const subscription = createSubscription();
        mockGetRegistration.mockResolvedValue(null);
        mockRegister.mockResolvedValue(createRegistration(subscription));
        mockFetchWithRetry.mockResolvedValue({ ok: true, status: 201 } as Response);

        render(<RecallPushSubscriber />);
        fireEvent.click(screen.getByRole("button", { name: "Enable alerts" }));

        await waitFor(() => expect(screen.getByText("Disable alerts")).toBeInTheDocument());
        expect(mockGetCsrfToken).toHaveBeenCalledTimes(1);
        expect(mockFetchWithRetry).toHaveBeenCalledWith(
            "http://localhost:4000/api/notifications/subscriptions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer access-token-123",
                    "x-csrf-token": "csrf-token-123",
                },
                credentials: "include",
                body: JSON.stringify(subscription),
            }
        );
        expect(subscription.unsubscribe).not.toHaveBeenCalled();
    });

    it("removes the server subscription before unsubscribing locally", async () => {
        const subscription = createSubscription();
        mockGetRegistration.mockResolvedValue(createRegistration(subscription));
        mockFetchWithRetry.mockResolvedValue({ ok: true, status: 204 } as Response);

        render(<RecallPushSubscriber />);
        await waitFor(() => expect(screen.getByText("Disable alerts")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Disable alerts" }));

        await waitFor(() => expect(screen.getByText("Enable alerts")).toBeInTheDocument());
        expect(mockGetCsrfToken).toHaveBeenCalledTimes(1);
        expect(mockFetchWithRetry).toHaveBeenCalledWith(
            "http://localhost:4000/api/notifications/subscriptions",
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer access-token-123",
                    "x-csrf-token": "csrf-token-123",
                },
                credentials: "include",
                body: JSON.stringify({ endpoint: subscription.endpoint }),
            }
        );
        expect(mockFetchWithRetry.mock.invocationCallOrder[0]).toBeLessThan(
            subscription.unsubscribe.mock.invocationCallOrder[0]
        );
    });

    it("cleans up a new local subscription when server registration fails", async () => {
        const subscription = createSubscription();
        mockGetRegistration.mockResolvedValue(null);
        mockRegister.mockResolvedValue(createRegistration(subscription));
        mockFetchWithRetry.mockResolvedValue({ ok: false, status: 500 } as Response);

        render(<RecallPushSubscriber />);
        fireEvent.click(screen.getByRole("button", { name: "Enable alerts" }));

        await waitFor(() =>
            expect(screen.getByText("Failed to save push subscription")).toBeInTheDocument()
        );
        expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("cleans up a new local subscription when registration throws", async () => {
        const subscription = createSubscription();
        mockGetRegistration.mockResolvedValue(null);
        mockRegister.mockResolvedValue(createRegistration(subscription));
        mockFetchWithRetry.mockRejectedValue(new Error("Network request failed"));

        render(<RecallPushSubscriber />);
        fireEvent.click(screen.getByRole("button", { name: "Enable alerts" }));

        await waitFor(() => expect(screen.getByText("Network request failed")).toBeInTheDocument());
        expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("keeps the local subscription when server removal fails", async () => {
        const subscription = createSubscription();
        mockGetRegistration.mockResolvedValue(createRegistration(subscription));
        mockFetchWithRetry.mockResolvedValue({ ok: false, status: 500 } as Response);

        render(<RecallPushSubscriber />);
        await waitFor(() => expect(screen.getByText("Disable alerts")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: "Disable alerts" }));

        await waitFor(() =>
            expect(
                screen.getByText("Unable to disable alerts. Please try again.")
            ).toBeInTheDocument()
        );
        expect(subscription.unsubscribe).not.toHaveBeenCalled();
        expect(screen.getByText("Disable alerts")).toBeInTheDocument();
    });

    it("does not call the subscription API when authentication is unavailable", async () => {
        const subscription = createSubscription();
        mockUseSession.mockReturnValue({ token: null, session: null, isLoading: false });
        mockGetRegistration.mockResolvedValue(null);
        mockRegister.mockResolvedValue(createRegistration(subscription));

        render(<RecallPushSubscriber />);
        fireEvent.click(screen.getByRole("button", { name: "Enable alerts" }));

        await waitFor(() =>
            expect(screen.getByText("Please sign in to enable push alerts.")).toBeInTheDocument()
        );
        expect(mockGetCsrfToken).not.toHaveBeenCalled();
        expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });
});
