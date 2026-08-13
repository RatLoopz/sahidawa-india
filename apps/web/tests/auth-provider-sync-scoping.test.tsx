import { describe, it, expect, jest, beforeEach } from "@jest/globals";
/**
 * @jest-environment jsdom
 */
import { act } from "@testing-library/react";
import { render } from "@testing-library/react";
import { AuthProvider } from "@/src/components/AuthProvider";
import { createBrowserClient } from "@supabase/ssr";
import { clearSyncQueueForLogout, registerCurrentUser } from "@/lib/syncUserScoping";

jest.mock("@supabase/ssr", () => ({
    createBrowserClient: jest.fn(),
}));

jest.mock("@/lib/env", () => ({
    getSupabaseUrl: () => "https://example.supabase.co",
    getSupabaseAnonKey: () => "anon-key-123",
}));

jest.mock("@/lib/syncUserScoping", () => ({
    registerCurrentUser: jest.fn(),
    clearSyncQueueForLogout: jest.fn(),
}));

const mockedCreateBrowserClient = createBrowserClient as jest.Mock;

function setupAuth(options: { initialSession: Record<string, unknown> | null }) {
    const authStateListeners: Array<(event: string, session: any) => void> = [];
    const client = {
        auth: {
            getSession: jest.fn().mockResolvedValue({
                data: { session: options.initialSession },
                error: null,
            }),
            onAuthStateChange: jest.fn((listener: (event: string, session: any) => void) => {
                authStateListeners.push(listener);
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            }),
        },
    };
    mockedCreateBrowserClient.mockReturnValue(client);
    return { authStateListeners };
}

function sessionFor(userId: string): Record<string, unknown> {
    return {
        access_token: `token-${userId}`,
        user: { id: userId, email: `${userId}@test.dev` },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
});

describe("AuthProvider sync queue user-scoping", () => {
    it("registers the signed-in user with the service worker on mount", async () => {
        setupAuth({ initialSession: sessionFor("user-A") });

        await act(async () => {
            render(
                <AuthProvider>
                    <div>app</div>
                </AuthProvider>
            );
        });

        expect(registerCurrentUser).toHaveBeenCalledWith("user-A");
        expect(clearSyncQueueForLogout).not.toHaveBeenCalled();
        expect(localStorage.getItem("sb-access-token")).toBeNull();
    });

    it("clears the queue and unregisters the user when the session ends", async () => {
        const { authStateListeners } = setupAuth({ initialSession: sessionFor("user-A") });

        await act(async () => {
            render(
                <AuthProvider>
                    <div>app</div>
                </AuthProvider>
            );
        });
        expect(registerCurrentUser).toHaveBeenCalledWith("user-A");

        await act(async () => {
            for (const listener of authStateListeners) listener("SIGNED_OUT", null);
        });

        expect(clearSyncQueueForLogout).toHaveBeenCalled();
    });

    it("registers a newly signed-in user via the auth state change", async () => {
        const { authStateListeners } = setupAuth({ initialSession: null });

        await act(async () => {
            render(
                <AuthProvider>
                    <div>app</div>
                </AuthProvider>
            );
        });
        expect(clearSyncQueueForLogout).toHaveBeenCalled();

        await act(async () => {
            for (const listener of authStateListeners) listener("SIGNED_IN", sessionFor("user-B"));
        });

        expect(registerCurrentUser).toHaveBeenCalledWith("user-B");
    });

    it("re-registers the correct user when the session switches users", async () => {
        const { authStateListeners } = setupAuth({ initialSession: null });

        await act(async () => {
            render(
                <AuthProvider>
                    <div>app</div>
                </AuthProvider>
            );
        });

        await act(async () => {
            for (const listener of authStateListeners) listener("SIGNED_IN", sessionFor("user-A"));
        });
        expect(registerCurrentUser).toHaveBeenLastCalledWith("user-A");

        await act(async () => {
            for (const listener of authStateListeners) listener("SIGNED_OUT", null);
            for (const listener of authStateListeners) listener("SIGNED_IN", sessionFor("user-B"));
        });

        expect(clearSyncQueueForLogout).toHaveBeenCalled();
        expect(registerCurrentUser).toHaveBeenLastCalledWith("user-B");
    });
});
