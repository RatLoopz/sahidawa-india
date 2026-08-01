/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SettingsPage from "@/app/[locale]/settings/page";
import {
    getSubscriptionStatus,
    registerSubscription,
    verifyGuestOtp,
    updateSubscription,
    optOutSubscription,
} from "@/lib/api/notifications";
import { useSession } from "@/src/components/AuthProvider";

const GUEST_PHONE_KEY = "sahidawa-sms-phone";
const GUEST_TOKEN_KEY = "sahidawa-guest-token";

jest.mock("@/lib/api/notifications", () => ({
    getSubscriptionStatus: jest.fn(),
    registerSubscription: jest.fn(),
    verifyGuestOtp: jest.fn(),
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
            otpSentTitle: "Verify your phone number",
            otpSentDesc: "We sent a code to your phone.",
            otpLabel: "Verification code",
            otpPlaceholder: "6-digit code",
            otpSentMessage: "We sent a verification code to your phone.",
            verifyButton: "Verify",
            verifying: "Verifying...",
            verifySuccess: "Your number is verified.",
            otpInvalid: "Please enter the 6-digit code we sent you.",
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
const mockedVerifyGuestOtp = verifyGuestOtp as jest.Mock;
const mockedUpdateSubscription = updateSubscription as jest.Mock;
const mockedOptOutSubscription = optOutSubscription as jest.Mock;
const mockedUseSession = useSession as jest.Mock;

const fillForm = ({ phone, district }: { phone?: string; district?: string }) => {
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
        mockedVerifyGuestOtp.mockResolvedValue({
            success: true,
            message: "Phone verified successfully",
            guestToken: "guest-token-value",
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

    it("does not query subscription status for a guest with no token", async () => {
        render(<SettingsPage />);
        await waitFor(() => expect(screen.getByLabelText("Phone number")).toBeInTheDocument());

        expect(mockedGetSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("registers a brand-new guest, shows the OTP step, and stores the token on verify", async () => {
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

        // Registration triggers the OTP step; verifying stores the guest token.
        const otpInput = await screen.findByLabelText("Verification code");
        fireEvent.change(otpInput, { target: { value: "123456" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify" }));

        await waitFor(() => {
            expect(mockedVerifyGuestOtp).toHaveBeenCalledWith({
                phone: "9876543210",
                otp: "123456",
            });
        });
        await waitFor(() => {
            expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBe("guest-token-value");
        });
    });

    it("re-applies preferences the API withheld once the OTP proves the number", async () => {
        // The number is already a subscriber, so /register keeps the stored
        // settings and only sends an OTP (#3956). The requested settings have to
        // land after verification, not before, or the guest silently loses them.
        mockedRegisterSubscription.mockResolvedValue({
            success: true,
            preferencesApplied: false,
        });

        render(<SettingsPage />);
        expect(await screen.findByLabelText("Phone number")).toBeInTheDocument();

        fillForm({ phone: "9876543210", district: "Pune" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        const otpInput = await screen.findByLabelText("Verification code");
        // Nothing is applied while the challenge is outstanding.
        expect(mockedUpdateSubscription).not.toHaveBeenCalled();
        expect(localStorage.getItem(GUEST_PHONE_KEY)).toBe("+919876543210");

        fireEvent.change(otpInput, { target: { value: "123456" } });
        fireEvent.click(screen.getByRole("button", { name: "Verify" }));

        await waitFor(() => {
            expect(mockedUpdateSubscription).toHaveBeenCalledWith(
                {
                    phone: "9876543210",
                    channels: ["whatsapp"],
                    language: "en",
                    district: "Pune",
                },
                undefined,
                "guest-token-value"
            );
        });
    });

    it("lets a verified returning guest update settings with their token instead of re-registering", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        localStorage.setItem(GUEST_TOKEN_KEY, "guest-token-value");
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

        fillForm({ district: "Pune" });
        fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

        await waitFor(() => {
            expect(mockedUpdateSubscription).toHaveBeenCalledWith(
                {
                    phone: "9876543210",
                    channels: ["whatsapp"],
                    language: "en",
                    district: "Pune",
                },
                undefined,
                "guest-token-value"
            );
        });
        // Status was read with the token, and no re-registration happened.
        expect(mockedGetSubscriptionStatus).toHaveBeenCalledWith(undefined, "guest-token-value");
        expect(mockedRegisterSubscription).not.toHaveBeenCalled();
    });

    it("re-registers and asks a returning guest to verify when they switch to a new number", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        localStorage.setItem(GUEST_TOKEN_KEY, "guest-token-value");
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
        expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
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

    it("opts a verified guest out and clears their local phone and token", async () => {
        localStorage.setItem(GUEST_PHONE_KEY, "+919876543210");
        localStorage.setItem(GUEST_TOKEN_KEY, "guest-token-value");
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
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Opt out" })).toBeInTheDocument()
        );

        fireEvent.click(screen.getByRole("button", { name: "Opt out" }));

        await waitFor(() => {
            expect(mockedOptOutSubscription).toHaveBeenCalledWith(
                { phone: "+919876543210" },
                undefined,
                "guest-token-value"
            );
        });
        expect(localStorage.getItem(GUEST_PHONE_KEY)).toBeNull();
        expect(localStorage.getItem(GUEST_TOKEN_KEY)).toBeNull();
        expect(await screen.findByText("You have been opted out.")).toBeInTheDocument();
    });
});
