/** @jest-environment jsdom */

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

describe("ProfilePage navigation and guest state", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders a back-to-home link pointing at the localized home route", () => {
        render(<ProfilePage />);

        const backLink = screen.getByRole("link", { name: /go back to previous page/i });
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
