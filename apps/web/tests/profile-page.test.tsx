import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import ProfilePage from "../app/[locale]/profile/page";

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: () => ({
        session: null,
        isLoading: false,
        token: null,
    }),
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => {
        const messages: Record<string, string> = {
            backToHome: "Back to Home",
            title: "Your Profile",
            subtitle: "Manage your account and medicine activity.",
            checkingStatus: "Checking account status",
            guestUser: "Guest User",
            signedInUser: "Signed-in User",
            authenticatedAccount: "Authenticated account",
            readingSession: "Reading your local session",
            noAccountConnected: "No account connected",
            errorTitle: "Failed to load profile",
            errorDescription: "We couldn't read your session. Please try again or sign in.",
            retry: "Retry",
            signIn: "Sign In",
            signInRegister: "Sign In / Register",
            signOut: "Sign Out",
            abhaSetup: "ABHA Setup",
            abhaRecords: "ABHA Records",
            notificationSettings: "Notification Settings",
            privacySecurity: "Privacy & Security",
        };
        return (key: string) => messages[key] ?? key;
    },
}));

describe("ProfilePage navigation and guest state", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders a back-to-home link pointing at the localized home route", () => {
        render(<ProfilePage />);

        const backLink = screen.getByRole("link", { name: /back to home/i });
        expect(backLink).toHaveAttribute("href", "/");
    });

    it("renders guest information on initial load when no session token exists", async () => {
        render(<ProfilePage />);

        expect(await screen.findByText("Guest User")).toBeInTheDocument();
        expect(screen.getByText("No account connected")).toBeInTheDocument();

        const signInLink = screen.getByRole("link", { name: /sign in \/ register/i });
        expect(signInLink).toHaveAttribute("href", "/login");
        expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
    });
});
