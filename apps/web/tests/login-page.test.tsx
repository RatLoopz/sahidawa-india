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
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "../app/[locale]/login/page";
import { createBrowserClient } from "@supabase/ssr";

jest.mock("@supabase/ssr", () => ({
    createBrowserClient: jest.fn(() => ({
        auth: {
            signInWithPassword: jest.fn(),
            signInWithOAuth: jest.fn(),
        },
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

jest.mock("@/i18n/routing", () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

describe("LoginPage Supabase client creation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
