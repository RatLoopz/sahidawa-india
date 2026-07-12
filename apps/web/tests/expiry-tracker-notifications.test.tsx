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
import { toast } from "sonner";

import ExpiryTrackerPage from "../app/[locale]/expiry-tracker/page";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string) => key,
}));

jest.mock("../app/[locale]/components/PageHeader", () => ({
    PageHeader: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
        <header>
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </header>
    ),
}));

jest.mock("@/components/scanner/BarcodeScanner", () => ({
    BarcodeScanner: () => <div data-testid="barcode-scanner" />,
}));

jest.mock("@/lib/api", () => ({
    verifyMedicine: jest.fn(),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
    },
}));

const mockedToast = toast as jest.Mocked<typeof toast>;

function defineNotificationMock(permission: NotificationPermission) {
    const requestPermission = jest.fn<Promise<NotificationPermission>, []>();
    const notification = jest.fn() as unknown as typeof Notification;

    Object.defineProperty(notification, "permission", {
        configurable: true,
        get: () => permission,
    });
    Object.defineProperty(notification, "requestPermission", {
        configurable: true,
        value: requestPermission,
    });
    Object.defineProperty(window, "Notification", {
        configurable: true,
        value: notification,
    });
    Object.defineProperty(global, "Notification", {
        configurable: true,
        value: notification,
    });
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
            getRegistration: jest.fn().mockResolvedValue(null),
        },
    });

    return requestPermission;
}

async function waitForInitialLoad() {
    await waitFor(() => {
        expect(screen.queryByText("loading")).not.toBeInTheDocument();
    });
}

describe("ExpiryTracker notification permission", () => {
    const originalNotification = window.Notification;
    const originalServiceWorker = navigator.serviceWorker;

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(window, "Notification", {
            configurable: true,
            value: originalNotification,
        });
        Object.defineProperty(global, "Notification", {
            configurable: true,
            value: originalNotification,
        });
        Object.defineProperty(navigator, "serviceWorker", {
            configurable: true,
            value: originalServiceWorker,
        });
    });

    it("shows a success toast when notification permission is granted", async () => {
        const requestPermission = defineNotificationMock("default");
        requestPermission.mockResolvedValueOnce("granted");

        render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        fireEvent.click(await screen.findByRole("button", { name: /enable notifications/i }));

        await waitFor(() => {
            expect(mockedToast.success).toHaveBeenCalledWith(
                "Notifications enabled! You will be alerted before medicines expire."
            );
        });
        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/expiry alerts enabled/i)).toBeInTheDocument();
    });

    it("shows a denied-state toast when notification permission is denied", async () => {
        const requestPermission = defineNotificationMock("default");
        requestPermission.mockResolvedValueOnce("denied");

        render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        fireEvent.click(await screen.findByRole("button", { name: /enable notifications/i }));

        await waitFor(() => {
            expect(mockedToast.error).toHaveBeenCalledWith(
                "Notification permission denied. Please enable alerts in your browser settings."
            );
        });
        expect(screen.getByRole("button", { name: /enable notifications/i })).toBeInTheDocument();
    });

    it("handles unavailable Notification API without rendering permission controls", async () => {
        delete (window as Partial<Window>).Notification;
        delete (global as { Notification?: typeof Notification }).Notification;

        render(<ExpiryTrackerPage />);
        await waitForInitialLoad();

        expect(screen.queryByRole("button", { name: /enable notifications/i })).toBeNull();
        expect(screen.queryByRole("heading", { name: /enable expiry alerts/i })).toBeNull();
        expect(mockedToast.success).not.toHaveBeenCalled();
        expect(mockedToast.error).not.toHaveBeenCalled();
    });
});
