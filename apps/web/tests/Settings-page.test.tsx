/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SettingsPage from "@/app/[locale]/settings/page";
import {
    getSubscriptionStatus,
    registerSubscription,
    updateSubscription,
    optOutSubscription,
} from "@/lib/api/notifications";
import { useSession } from "@/src/components/AuthProvider";

const GUEST_PHONE_KEY = "sahidawa-sms-phone";

jest.mock("@/lib/api/notifications", () => ({
    getSubscriptionStatus: jest.fn(),
    registerSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    optOutSubscription: jest.fn(),
}));

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: jest.fn(),
}));

jest.mock("@/app/[locale]/components/PageHeader", () => ({
    PageHeader: () => null,
}));

jest.mock("next-intl", () => ({
    useTranslations: () => {
        const labels: Record<string, string> = {
            title: "Notification Settings",
            subtitle: "Manage how you receive alerts",
            loadingPreferences: "Loading your preferences...",
            phoneLabel: "Phone number",
            phonePlaceholder: "10-digit number",
            phoneInvalid: "Please enter a valid 10-digit phone number.",
            districtLabel: "District",
            districtPlaceholder: "Enter your district",
            districtDesc: "Used to send region-specific alerts.",
            districtRequired: "District is required.",
            langLabel: "Preferred language",
            langDesc: "Alerts will be sent in this language.",
            languageOptionEn: "English",
            languageOptionHi: "Hindi",
            languageOptionTa: "Tamil",
            languageOptionTe: "Telugu",
            languageOptionBn: "Bengali",
            languageOptionMr: "Marathi",
            languageOptionGu: "Gujarati",
            languageOptionKn: "Kannada",
            languageOptionMl: "Malayalam",
            languageOptionPa: "Punjabi",
            languageOptionUr: "Urdu",
            languageOptionAs: "Assamese",
            channelsLabel: "Alert channels",
            channelRequired: "Select at least one channel.",
            smsLabel: "SMS",
            smsDesc: "Get alerts via text message.",
            whatsappLabel: "WhatsApp",
            whatsappDesc: "Get alerts via WhatsApp.",
            saveButton: "Save settings",
            saving: "Saving...",
            optOutButton: "Opt out",
            optOutConfirm: "Are you sure you want to opt out?",
            optOutSuccess: "You have been opted out.",
            successMessage: "Settings saved successfully.",
            errorMessage: "Something went wrong. Please try again.",
        };
        return (key: string) => labels[key] ?? key;
    },
}));

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockedGetSubscriptionStatus = getSubscriptionStatus as jest.Mock;
const mockedRegisterSubscription = registerSubscription as jest.Mock;
const mockedUpdateSubscription = updateSubscription as jest.Mock;
const mockedOptOutSubscription = optOutSubscription as jest.Mock;
const mockedUseSession = useSession as jest.Mock;

const fillForm = ({
    phone,
    district,
}: {
    phone?: string;
    district?: string;
}) => {
    if (phone !== undefined) {
        fireEvent.change(screen.getByLabelText("Phone number"), {
            target: { value: phone },
        });
    }
    if (district !== undefined) {
        fireEvent.change(screen.getByLabelText("District"), {
            target: { value: district },
        });
    }
};

describe("SettingsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        window.confirm = jest.fn().mockReturnValue(true);

        mockedGetSubscriptionStatus.mockResolvedValue({ registered: false });
        mockedRegisterSubscription.mockResolvedValue({
            success: true,
            subscriber: { phone: "+919876543210" },
        });
        mockedUpdateSubscription.mockResolvedValue({
            success: true,
            subscriber: { phone: "+919876543210" },
        });
        mockedOptOutSubscription.mockResolvedValue({ success: true });
        mockedUseSession.mockReturnValue({ token: null, isLoading: false });
    });

    it("shows a loading state while auth/subscription status is resolving", async () => {
        render(<SettingsPage />);
        expect(screen.getByText("Loading your preferences...")).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText("Loading your preferences...")).not.toBeInTheDocument();
        });
    });

    it("registers a brand-new guest subscriber via the guest-friendly flow", async () => {
        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByLabelText("Phone number")).toBeInTheDocument());

        fillForm({ phone: "9876543210", district: "Pune" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        await waitFor(() => {
            expect(mockedRegisterSubscription).toHaveBeenCalledWith(
                {
                    phone: "9876543210",
                    channels: ["whatsapp"],
                    language: "en",
                    district: "Pune",
                },
                undefined
            );
        });
        expect(mockedUpdateSubscription).not.toHaveBeenCalled();
    });

    it("uses the guest-friendly registration flow (not the authenticated update API) when a returning guest changes their district", async () => {
        // Simulate a guest who already registered once before.
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        mockedGetSubscriptionStatus.mockResolvedValue({
            registered: true,
            subscriber: {
                phone: "+919876543210",
                channels: ["whatsapp"],
                language: "en",
                district: "Mumbai",
            },
        });

        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByDisplayValue("Mumbai")).toBeInTheDocument());

        // Returning guest changes their district only.
        fillForm({ district: "Pune" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        await waitFor(() => {
            expect(mockedRegisterSubscription).toHaveBeenCalledWith(
                {
                    phone: "9876543210",
                    channels: ["whatsapp"],
                    language: "en",
                    district: "Pune",
                },
                undefined
            );
        });
        // This is the core regression check for the bug: guests must never
        // hit the authenticated update endpoint.
        expect(mockedUpdateSubscription).not.toHaveBeenCalled();
    });

    it("uses the guest-friendly registration flow when a returning guest changes their phone number", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        mockedGetSubscriptionStatus.mockResolvedValue({
            registered: true,
            subscriber: {
                phone: "+919876543210",
                channels: ["sms"],
                language: "en",
                district: "Pune",
            },
        });

        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument());

        fillForm({ phone: "9123456789" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        await waitFor(() => {
            expect(mockedRegisterSubscription).toHaveBeenCalledWith(
                {
                    phone: "9123456789",
                    channels: ["sms"],
                    language: "en",
                    district: "Pune",
                },
                undefined
            );
        });
        expect(mockedUpdateSubscription).not.toHaveBeenCalled();
    });

    it("uses the authenticated update API for a logged-in user, even if a guest phone is also on file", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        mockedUseSession.mockReturnValue({ token: "session-token", isLoading: false });
        mockedGetSubscriptionStatus.mockResolvedValue({
            registered: true,
            subscriber: {
                phone: "+919876543210",
                channels: ["whatsapp"],
                language: "en",
                district: "Pune",
            },
        });

        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByDisplayValue("Pune")).toBeInTheDocument());

        fillForm({ district: "Nashik" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        await waitFor(() => {
            expect(mockedUpdateSubscription).toHaveBeenCalledWith(
                {
                    phone: "+919876543210",
                    newPhone: "9876543210",
                    channels: ["whatsapp"],
                    language: "en",
                    district: "Nashik",
                },
                "session-token"
            );
        });
        expect(mockedRegisterSubscription).not.toHaveBeenCalled();
    });

    it("shows a validation error and does not call any API when the district is missing", async () => {
        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByLabelText("Phone number")).toBeInTheDocument());

        fillForm({ phone: "9876543210", district: "" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        expect(await screen.findByText("District is required.")).toBeInTheDocument();
        expect(mockedRegisterSubscription).not.toHaveBeenCalled();
        expect(mockedUpdateSubscription).not.toHaveBeenCalled();
    });

    it("shows a validation error for an invalid phone number", async () => {
        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByLabelText("Phone number")).toBeInTheDocument());

        fillForm({ phone: "123", district: "Pune" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        expect(
            await screen.findByText("Please enter a valid 10-digit phone number.")
        ).toBeInTheDocument();
        expect(mockedRegisterSubscription).not.toHaveBeenCalled();
    });

    it("opts a guest out and clears their local guest phone", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        mockedGetSubscriptionStatus.mockResolvedValue({
            registered: true,
            subscriber: {
                phone: "+919876543210",
                channels: ["whatsapp"],
                language: "en",
                district: "Pune",
            },
        });

        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Opt out" })).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "Opt out" }));

        await waitFor(() => {
            expect(mockedOptOutSubscription).toHaveBeenCalledWith(
                { phone: "+919876543210" },
                undefined
            );
        });
        expect(localStorage.getItem(GUEST_PHONE_KEY)).toBeNull();
        expect(await screen.findByText("You have been opted out.")).toBeInTheDocument();
    });
});