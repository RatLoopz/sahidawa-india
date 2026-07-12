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

import SignUpPage from "../app/[locale]/signup/page";

const mockPush = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();

jest.mock("@/i18n/routing", () => ({
    Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: (namespace: string) => (key: string) => {
        const messages: Record<string, Record<string, string>> = {
            SignUp: {
                brandSubtitle: "Medicine safety platform",
                heading: "Create your account",
                description: "Join SahiDawa to track medicine safety reports.",
                "missingConfig.title": "Authentication is not configured",
                "missingConfig.description": "Supabase URL or anon key is missing.",
                googleButton: "Continue with Google",
                githubButton: "Continue with Github",
                emailSeparator: "or continue with email",
                fullNameLabel: "Full name",
                fullNamePlaceholder: "Your full name",
                emailLabel: "Email address",
                emailPlaceholder: "you@example.com",
                passwordLabel: "Password",
                passwordPlaceholder: "Create a password",
                confirmPasswordLabel: "Confirm password",
                confirmPasswordPlaceholder: "Re-enter your password",
                showPassword: "Show password",
                hidePassword: "Hide password",
                showConfirmPassword: "Show confirm password",
                hideConfirmPassword: "Hide confirm password",
                signingUp: "Creating account...",
                signUp: "Sign Up",
                footerPrompt: "Already have an account?",
                signInLink: "Sign in",
                bottomText: "Protected access for SahiDawa community tools.",
                success: "Account created successfully! Redirecting...",
                "errors.fullNameRequired": "Full name is required.",
                "errors.emailRequired": "Email address is required.",
                "errors.emailInvalid": "Please enter a valid email address.",
                "errors.passwordRequired": "Password is required.",
                "errors.passwordWeak":
                    "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
                "errors.confirmPasswordRequired": "Please confirm your password.",
                "errors.passwordMismatch": "Passwords do not match.",
                "errors.generic": "Unable to create account. Please try again.",
            },
        };

        return messages[namespace]?.[key] ?? `${namespace}.${key}`;
    },
}));

jest.mock("@supabase/ssr", () => ({
    createBrowserClient: () => ({
        auth: {
            signUp: mockSignUp,
            signInWithOAuth: mockSignInWithOAuth,
        },
    }),
}));

describe("SignUpPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSignUp.mockResolvedValue({
            data: { session: { access_token: "token" }, user: { id: "user-1" } },
            error: null,
        });
    });

    it("renders signup form fields and login navigation link", () => {
        render(<SignUpPage />);

        expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^email address$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();

        const loginLink = screen.getByRole("link", { name: /sign in/i });
        expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("shows validation error when passwords do not match", async () => {
        render(<SignUpPage />);

        fireEvent.change(screen.getByLabelText(/full name/i), {
            target: { value: "Test User" },
        });
        fireEvent.change(screen.getByLabelText(/^email address$/i), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), {
            target: { value: "Password1" },
        });
        fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
            target: { value: "Password2" },
        });

        fireEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

        expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
        expect(mockSignUp).not.toHaveBeenCalled();
    });

    it("submits valid signup data and redirects on success", async () => {
        render(<SignUpPage />);

        fireEvent.change(screen.getByLabelText(/full name/i), {
            target: { value: "Test User" },
        });
        fireEvent.change(screen.getByLabelText(/^email address$/i), {
            target: { value: "test@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), {
            target: { value: "Password1" },
        });
        fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
            target: { value: "Password1" },
        });

        fireEvent.click(screen.getByRole("button", { name: /^sign up$/i }));

        await waitFor(() => {
            expect(mockSignUp).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "Password1",
                options: {
                    data: { full_name: "Test User" },
                    emailRedirectTo: "http://localhost/en/reports/me",
                },
            });
        });

        expect(mockPush).toHaveBeenCalledWith("/reports/me");
    });
});
