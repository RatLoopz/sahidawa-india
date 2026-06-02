"use client";

import { Mail, Lock, ShieldCheck, ArrowRight, Hand, AlertTriangle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
export default function LoginPage() {
    const router = useRouter();
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseAnonKey();
    const isMissingEnvVars = !supabaseUrl || !supabaseKey;
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError("");

        if (isMissingEnvVars) {
            setError("Database connection is not configured.");
            setLoading(false);
            return;
        }

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

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError("");

        if (isMissingEnvVars) {
            setError("Database connection is not configured.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/reports/me`,
                },
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-login)] px-4 py-10">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 shadow-sm dark:bg-emerald-950/30">
                        <ShieldCheck className="dark:text-emerald-450 h-7 w-7 text-emerald-600" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-(--color-text-primary)">SahiDawa</h1>
                        <p className="text-sm text-(--color-text-secondary)">
                            Secure Health Verification
                        </p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl">
                    <div className="mb-7">
                        <h2 className="flex items-center gap-2 text-3xl font-bold text-(--color-text-primary)">
                            Welcome Back <Hand className="h-8 w-8 animate-bounce text-amber-500" />
                        </h2>

                        <p className="mt-2 text-(--color-text-secondary)">
                            Sign in to access your reports and continue using SahiDawa.
                        </p>
                    </div>

                    {/* Missing Env Variables Warning */}
                    {isMissingEnvVars && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
                            <div>
                                <p className="mb-1 font-semibold">Missing Configuration</p>
                                <p className="text-amber-700 dark:text-amber-400">
                                    Database connection variables are missing in your local setup.
                                    Please configure .env.local to proceed.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <LiveMessage
                            tone="critical"
                            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400"
                        >
                            {error}
                        </LiveMessage>
                    )}

                    {/* Google Login Button */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading || isMissingEnvVars}
                        className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/50 bg-white/60 px-4 py-3.5 font-medium text-slate-700 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800/50 dark:text-white dark:hover:bg-slate-800/80 dark:hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                    >
                        <FcGoogle size={20} />
                        Sign in with Google
                    </button>

                    {/* OR Separator */}
                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                        <span className="text-xs font-medium tracking-wider text-(--color-text-muted) uppercase">
                            Or continue with email
                        </span>
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                    </div>

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
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-sm font-medium text-(--color-text-primary)">
                                Password
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page)">
                                <Lock className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading || isMissingEnvVars}
                            className="shadow-emerald-250/20 mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 dark:shadow-emerald-950/20"
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
