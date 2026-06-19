/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { TextDecoder as NodeTextDecoder } from "util";

import ProfilePage from "../app/[locale]/profile/page";

const mockPush = jest.fn();
let mockToken: string | null = null;

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: () => ({
        session: null,
        isLoading: false,
        token: mockToken,
    }),
}));

jest.mock("@/i18n/routing", () => ({
    Link: ({
        children,
        href,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    useRouter: () => ({
        push: mockPush,
    }),
}));

function createAccessToken(payload: Record<string, unknown>) {
    const encode = (value: Record<string, unknown>) =>
        Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

    return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("ProfilePage auth status", () => {
    beforeEach(() => {
        if (typeof globalThis.TextDecoder !== "function") {
            Object.defineProperty(globalThis, "TextDecoder", {
                configurable: true,
                value: NodeTextDecoder,
            });
        }

        if (typeof window.atob !== "function") {
            Object.defineProperty(window, "atob", {
                configurable: true,
                value: (value: string) => Buffer.from(value, "base64").toString("binary"),
            });
        }

        localStorage.clear();
        mockToken = null;
        mockPush.mockClear();
    });

    it("renders a guest card with a localized sign-in CTA when no access token exists", async () => {
        expect(renderToStaticMarkup(<ProfilePage />)).toContain("Checking account status");

        mockToken = null;
        render(<ProfilePage />);

        expect(await screen.findByText("Guest User")).toBeInTheDocument();
        expect(screen.getByText("No account connected")).toBeInTheDocument();

        const loginLink = screen.getByRole("link", { name: /sign in \/ register/i });
        expect(loginLink).toHaveAttribute("href", "/login");
        expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
    });

    it("shows authenticated account details from a valid access token", async () => {
        const token = createAccessToken({
            email: "asha@example.com",
            sub: "user-123",
            exp: Math.floor(Date.now() / 1000) + 3600,
            user_metadata: {
                full_name: "Asha Sharma",
            },
        });

        mockToken = token;
        render(<ProfilePage />);

        expect(await screen.findByText("Asha Sharma")).toBeInTheDocument();
        expect(screen.getByText("Authenticated account")).toBeInTheDocument();
        expect(screen.queryByText("Guest User")).not.toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(token);
    });

    it("clears malformed access tokens instead of rendering them", async () => {
        mockToken = "not-a-valid-jwt";
        localStorage.setItem("sb-access-token", "not-a-valid-jwt");

        render(<ProfilePage />);

        expect(await screen.findByText("Guest User")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /sign in \/ register/i })).toHaveAttribute(
            "href",
            "/login"
        );
        expect(localStorage.getItem("sb-access-token")).toBeNull();
        expect(document.body).not.toHaveTextContent("not-a-valid-jwt");
    });

    it("treats an expired access token as a guest session", async () => {
        const token = createAccessToken({
            email: "expired@example.com",
            exp: Math.floor(Date.now() / 1000) - 60,
        });
        mockToken = token;
        localStorage.setItem("sb-access-token", token);

        render(<ProfilePage />);

        expect(await screen.findByText("Guest User")).toBeInTheDocument();
        expect(screen.getByText("No account connected")).toBeInTheDocument();
        expect(localStorage.getItem("sb-access-token")).toBeNull();
    });

    it("signs out by clearing the local session and redirecting home", async () => {
        const token = createAccessToken({
            email: "asha@example.com",
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
        mockToken = token;
        localStorage.setItem("sb-access-token", token);

        render(<ProfilePage />);

        fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));

        expect(localStorage.getItem("sb-access-token")).toBeNull();
        expect(mockPush).toHaveBeenCalledWith("/");

        await waitFor(() => {
            expect(screen.getByText("Guest User")).toBeInTheDocument();
        });
    });
});
