"use client";

import {
    Mail,
    Lock,
    ShieldCheck,
    ArrowRight,
    Hand,
    AlertTriangle,
    Eye,
    EyeOff,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createBrowserClient } from "@supabase/ssr";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { FaGithub } from "react-icons/fa6";
export default function LoginPage() {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations("Login");

    // Safely retrieve Supabase configurations without crashing during SSR or when missing
    const { supabaseUrl, supabaseKey, isMissingEnvVars } = useMemo(() => {
        try {
            const url = getSupabaseUrl();
            const key = getSupabaseAnonKey();
            return {
                supabaseUrl: url,
                supabaseKey: key,
                isMissingEnvVars: !url || !key,
            };
        } catch {
            return {
                supabaseUrl: "",
                supabaseKey: "",
                isMissingEnvVars: true,
            };
        }
    }, []);

    // Memoize the browser client so it is created once and persists across renders
    const supabase = useMemo(() => {
        if (isMissingEnvVars) return null;
        return createBrowserClient(supabaseUrl, supabaseKey);
    }, [isMissingEnvVars, supabaseUrl, supabaseKey]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError("");

        if (isMissingEnvVars || !supabase) {
            setError(t("errors.databaseNotConfigured"));
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
                router.push("/reports/me");
            }
        } catch {
            setError(t("errors.generic"));
        }

        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError("");

        if (isMissingEnvVars || !supabase) {
            setError(t("errors.databaseNotConfigured"));
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/${locale}/reports/me`,
                },
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } catch {
            setError(t("errors.generic"));
            setLoading(false);
        }
    };
    const handleGithubLogin = async () => {
        setLoading(true);
        setError("");

        if (isMissingEnvVars || !supabase) {
            setError(t("errors.databaseNotConfigured"));
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "github",
                options: {
                    redirectTo: `${window.location.origin}/${locale}/reports/me`,
                },
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            }
        } catch {
            setError(t("errors.generic"));
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-login)] [background-image:radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(5,150,105,0.06)_0%,transparent_50%)] px-4 py-10">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 shadow-sm dark:bg-emerald-950/30">
                        <ShieldCheck className="dark:text-emerald-450 h-7 w-7 text-emerald-600" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-(--color-text-primary)">SahiDawa</h1>
                        <p className="text-sm text-(--color-text-secondary)">
                            {t("brandSubtitle")}
                        </p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl">
                    <div className="mb-7">
                        <h2 className="flex items-center gap-2 text-3xl font-bold text-(--color-text-primary)">
                            {t("heading")}{" "}
                            <Hand className="h-8 w-8 animate-bounce text-amber-500" />
                        </h2>

                        <p className="mt-2 text-(--color-text-secondary)">{t("description")}</p>
                    </div>

                    {/* Missing Env Variables Warning */}
                    {isMissingEnvVars && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
                            <div>
                                <p className="mb-1 font-semibold">{t("missingConfig.title")}</p>
                                <p className="text-amber-700 dark:text-amber-400">
                                    {t("missingConfig.description")}
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
                        className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        <FcGoogle size={20} />
                        {t("googleButton")}
                    </button>
                    <button
                        type="button"
                        onClick={handleGithubLogin}
                        disabled={loading || isMissingEnvVars}
                        className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        <FaGithub size={20} />
                        {t("githubButton")}
                    </button>

                    {/* OR Separator */}
                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                        <span className="text-xs font-medium tracking-wider text-(--color-text-muted) uppercase">
                            {t("emailSeparator")}
                        </span>
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="text-sm font-medium text-(--color-text-primary)">
                                {t("emailLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <Mail className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    type="email"
                                    placeholder={t("emailPlaceholder")}
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
                                {t("passwordLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <Lock className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t("passwordPlaceholder")}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    className="shrink-0 rounded text-(--color-text-muted) transition hover:text-(--color-text-primary) focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading || isMissingEnvVars}
                            className="shadow-emerald-250/20 mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 dark:shadow-emerald-950/20"
                        >
                            {loading ? t("signingIn") : t("signIn")}

                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-7 space-y-2 text-center text-sm text-(--color-text-secondary)">
                        <p>
                            {t("signUpPrompt")}{" "}
                            <Link
                                href="/signup"
                                className="font-medium text-emerald-600 hover:underline"
                            >
                                {t("signUpLink")}
                            </Link>
                        </p>
                        <p>
                            {t("footerPrompt")}{" "}
                            <Link href="/" className="font-medium text-emerald-600 hover:underline">
                                {t("returnHome")}
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Bottom Text */}
                <p className="mt-6 text-center text-xs text-(--color-text-muted)">
                    {t("bottomText")}
                </p>
            </div>
        </div>
    );
}
