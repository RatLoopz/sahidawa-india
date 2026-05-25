"use client";

import { Mail, Lock, ShieldCheck, ArrowRight, Hand } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { LiveMessage } from "@/components/ui/LiveMessage";
export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError("");

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                setLoading(false);
                return;
            }

            if (data?.session?.access_token) {
                localStorage.setItem("sb-access-token", data.session.access_token);

                router.push("/reports/me");
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        }

        setLoading(false);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-login)] px-4 py-10">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 p-3 shadow-sm">
                        <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-450" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-(--color-text-primary)">SahiDawa</h1>
                        <p className="text-sm text-(--color-text-secondary)">Secure Health Verification</p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl">
                    <div className="mb-7">
                        <h2 className="flex items-center gap-2 text-3xl font-bold text-(--color-text-primary)">
                            Welcome Back <Hand className="h-8 w-8 text-amber-500 animate-bounce" />
                        </h2>

                        <p className="mt-2 text-(--color-text-secondary)">
                            Sign in to access your reports and continue using SahiDawa.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <LiveMessage
                            tone="critical"
                            className="mb-5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                        >
                            {error}
                        </LiveMessage>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="text-sm font-medium text-(--color-text-primary)">
                                Email Address
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page)">
                                <Mail className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted)"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-sm font-medium text-(--color-text-primary)">Password</label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page)">
                                <Lock className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted)"
                                />
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white shadow-lg shadow-emerald-250/20 dark:shadow-emerald-950/20 transition-all hover:bg-emerald-700"
                        >
                            {loading ? "Signing In..." : "Sign In"}

                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-7 text-center text-sm text-(--color-text-secondary)">
                        Don&apos;t have an account?{" "}
                        <Link href="/" className="font-medium text-emerald-600 hover:underline">
                            Return Home
                        </Link>
                    </div>
                </div>

                {/* Bottom Text */}
                <p className="mt-6 text-center text-xs text-(--color-text-muted)">
                    Protected by Supabase Authentication • SahiDawa © 2026
                </p>
            </div>
        </div>
    );
}
