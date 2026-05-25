"use client";

import { Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
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
                    <div className="rounded-2xl bg-emerald-100 p-3 shadow-sm">
                        <ShieldCheck className="h-7 w-7 text-emerald-600" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">SahiDawa</h1>
                        <p className="text-sm text-slate-500">Secure Health Verification</p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
                    <div className="mb-7">
                        <h2 className="text-3xl font-bold text-slate-900">Welcome Back 👋</h2>

                        <p className="mt-2 text-slate-500">
                            Sign in to access your reports and continue using SahiDawa.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <LiveMessage
                            tone="critical"
                            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                        >
                            {error}
                        </LiveMessage>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="text-sm font-medium text-slate-700">
                                Email Address
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 transition focus-within:border-emerald-500 focus-within:bg-white">
                                <Mail className="h-5 w-5 text-slate-400" />

                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-sm font-medium text-slate-700">Password</label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 transition focus-within:border-emerald-500 focus-within:bg-white">
                                <Lock className="h-5 w-5 text-slate-400" />

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700"
                        >
                            {loading ? "Signing In..." : "Sign In"}

                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-7 text-center text-sm text-slate-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/" className="font-medium text-emerald-600 hover:underline">
                            Return Home
                        </Link>
                    </div>
                </div>

                {/* Bottom Text */}
                <p className="mt-6 text-center text-xs text-slate-400">
                    Protected by Supabase Authentication • SahiDawa © 2026
                </p>
            </div>
        </div>
    );
}
