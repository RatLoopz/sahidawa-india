"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { User, ShieldCheck, Bell, ChevronRight, ArrowLeft, LogIn, LogOut } from "lucide-react";
import ABHABadge from "@/components/ABHABadge";
import { useSession } from "@/src/components/AuthProvider";

const ACCESS_TOKEN_KEY = "sb-access-token";

type ProfileSession =
    | { status: "checking" }
    | { status: "guest" }
    | { status: "error" }
    | {
          status: "authenticated";
          displayName: string;
      };

type AccessTokenPayload = {
    email?: unknown;
    sub?: unknown;
    exp?: unknown;
    user_metadata?: Record<string, unknown> | null;
};

function getString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
}

function readSessionFromToken(token: string | null): {
    session: ProfileSession;
    clearToken: boolean;
} {
    if (!token) {
        return { session: { status: "guest" }, clearToken: false };
    }

    try {
        const [, payloadPart] = token.split(".");

        if (!payloadPart) {
            return { session: { status: "guest" }, clearToken: true };
        }

        const payload = JSON.parse(decodeBase64Url(payloadPart)) as AccessTokenPayload;

        if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
            return { session: { status: "guest" }, clearToken: true };
        }

        const displayName =
            getString(payload.user_metadata?.full_name) ??
            getString(payload.user_metadata?.name) ??
            getString(payload.email) ??
            getString(payload.sub) ??
            "Signed-in User";

        return {
            session: {
                status: "authenticated",
                displayName,
            },
            clearToken: false,
        };
    } catch {
        return { session: { status: "guest" }, clearToken: true };
    }
}

export default function ProfilePage() {
    const router = useRouter();
    const { token, isLoading: authLoading } = useSession();
    const [session, setSession] = useState<ProfileSession>({ status: "checking" });

    const accountTitle =
        session.status === "authenticated"
            ? session.displayName
            : session.status === "checking"
              ? "Checking account status"
              : "Guest User";

    const accountSubtitle =
        session.status === "authenticated"
            ? "Authenticated account"
            : session.status === "checking"
              ? "Reading your local session"
              : "No account connected";

    useEffect(() => {
        if (authLoading) return;

        try {
            const result = readSessionFromToken(token);

            if (result.clearToken) {
                localStorage.removeItem(ACCESS_TOKEN_KEY);
            }

            setSession(result.session);
        } catch {
            setSession({ status: "error" });
        }
    }, [authLoading, token]);

    const handleRetry = () => {
        setSession({ status: "checking" });
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        try {
            const result = readSessionFromToken(token);
            if (result.clearToken) localStorage.removeItem(ACCESS_TOKEN_KEY);
            setSession(result.session);
        } catch {
            setSession({ status: "error" });
        }
    };
    const handleSignOut = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        setSession({ status: "guest" });
        router.push("/");
    };

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8 text-(--color-text-primary)">
            <div className="mx-auto max-w-3xl">
                {/* Back Button */}
                <Link
                    href="/"
                    className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-(--color-text-secondary) transition-all hover:bg-(--color-surface-page) hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:hover:text-emerald-400"
                >
                    <ArrowLeft size={18} />
                    <span className="font-medium">Back to Home</span>
                </Link>

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400">
                        <User size={30} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-black text-(--color-text-primary) sm:text-3xl">
                            Your Profile
                        </h1>

                        <p className="mt-1 text-(--color-text-secondary)">
                            Manage your account and medicine activity.
                        </p>
                    </div>
                </div>

                {/* Error State */}
                {session.status === "error" && (
                    <div className="mb-6 flex flex-col items-center gap-4 rounded-3xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800/40 dark:bg-red-950/20">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <ShieldCheck size={28} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
                                Failed to load profile
                            </h2>
                            <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/70">
                                We couldn&apos;t read your session. Please try again or sign in.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                            >
                                Retry
                            </button>
                            <Link
                                href="/login"
                                className="rounded-2xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>
                )}

                {/* Profile Card */}
                <div className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-sm">
                    {/* User Info */}
                    <div className="flex flex-col gap-4 border-b border-(--color-border-muted) p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--color-surface-muted)">
                                <ShieldCheck
                                    className="text-emerald-600 dark:text-emerald-400"
                                    size={24}
                                />
                            </div>

                            <div>
                                <h2 className="font-bold break-all text-(--color-text-primary)">
                                    {accountTitle}
                                </h2>

                                <p className="mt-1 text-sm text-(--color-text-secondary)">
                                    {accountSubtitle}
                                </p>

                                {session.status === "authenticated" && (
                                    <div className="mt-2">
                                        <ABHABadge linked={true} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {session.status === "guest" && (
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                            >
                                <LogIn size={18} />
                                Sign In / Register
                            </Link>
                        )}
                    </div>

                    {/* Menu Items */}
                    <div className="divide-y divide-(--color-border-muted)">
                        {session.status === "authenticated" && (
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-(--color-surface-muted)"
                            >
                                <div className="flex items-center gap-3">
                                    <LogOut size={20} className="text-red-500" />
                                    <span className="font-semibold text-(--color-text-primary)">
                                        Sign Out
                                    </span>
                                </div>
                                <ChevronRight size={18} className="text-(--color-text-muted)" />
                            </button>
                        )}

                        <Link
                            href="/abha-setup"
                            className="flex items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)"
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck
                                    size={20}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="font-semibold text-(--color-text-primary)">
                                    ABHA Setup
                                </span>
                            </div>
                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </Link>

                        <Link
                            href="/abha-records"
                            className="flex items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)"
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck
                                    size={20}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="font-semibold text-(--color-text-primary)">
                                    ABHA Records
                                </span>
                            </div>
                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </Link>

                        <Link
                            href="/settings"
                            className="flex items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)"
                        >
                            <div className="flex items-center gap-3">
                                <Bell size={20} className="text-red-500" />
                                <span className="font-semibold text-(--color-text-primary)">
                                    Notification Settings
                                </span>
                            </div>
                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </Link>

                        <Link
                            href="/privacy"
                            className="flex items-center justify-between p-5 transition-colors hover:bg-(--color-surface-muted)"
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck
                                    size={20}
                                    className="text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="font-semibold text-(--color-text-primary)">
                                    Privacy & Security
                                </span>
                            </div>
                            <ChevronRight size={18} className="text-(--color-text-muted)" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
