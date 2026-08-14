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
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../app/[locale]/login/page";
import { createBrowserClient } from "@supabase/ssr";

const mockAuth = {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
};

jest.mock("@supabase/ssr", () => ({
    createBrowserClient: jest.fn(() => ({
        auth: mockAuth,
    })),
}));

jest.mock("@/lib/env", () => ({
    getSupabaseUrl: () => "https://example.supabase.co",
    getSupabaseAnonKey: () => "anon-key-123",
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const mockRouter = { push: jest.fn() };

jest.mock("@/i18n/routing", () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
    useRouter: () => mockRouter,
}));

describe("LoginPage Supabase client creation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.getSession.mockResolvedValue({ data: { session: null } });
        mockAuth.signInWithPassword.mockResolvedValue({
            data: { session: { access_token: "token-123" } },
            error: null,
        });
        // Reset URL so a fresh query string can be set per test.
        window.history.replaceState({}, "", "/en/login");
    });

    it("should instantiate the Supabase client only once on initial render and reuse it across state updates", () => {
        render(<LoginPage />);

        // createBrowserClient should have been called once on initial render
        expect(createBrowserClient).toHaveBeenCalledTimes(1);

        // Find the email input field and type in it to trigger state updates/re-renders
        const emailInput = screen.getByPlaceholderText("Login.emailPlaceholder");
        fireEvent.change(emailInput, { target: { value: "test@example.com" } });

        // Type in the password input to trigger another state update/re-render
        const passwordInput = screen.getByPlaceholderText("Login.passwordPlaceholder");
        fireEvent.change(passwordInput, { target: { value: "password123" } });

        // createBrowserClient should STILL have been called only once, demonstrating useMemo is successfully keeping it cached/singleton
        expect(createBrowserClient).toHaveBeenCalledTimes(1);
    });

    it("redirects to the stripped returnTo path after password login", async () => {
        window.history.replaceState({}, "", "/en/login?returnTo=%2Fen%2Fadmin%2Fdashboard");

        render(<LoginPage />);

        fireEvent.change(screen.getByPlaceholderText("Login.emailPlaceholder"), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByPlaceholderText("Login.passwordPlaceholder"), {
            target: { value: "password123" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Login.signIn" }));

        await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalledWith("/admin/dashboard");
        });
    });

    it("redirects away from the login page when a session already exists", async () => {
        mockAuth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1" } } },
        });
        window.history.replaceState({}, "", "/en/login?returnTo=%2Fen%2Fadmin%2Fapproval");

        render(<LoginPage />);

        await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalledWith("/admin/approval");
        });
    });

    it("falls back to My Reports when no returnTo is present", async () => {
        mockAuth.getSession.mockResolvedValue({
            data: { session: { user: { id: "u1" } } },
        });

        render(<LoginPage />);

        await waitFor(() => {
            expect(mockRouter.push).toHaveBeenCalledWith("/reports/me");
        });
    });
});
