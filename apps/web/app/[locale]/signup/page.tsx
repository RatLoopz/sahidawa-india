"use client";

import {
    Mail,
    Lock,
    ShieldCheck,
    ArrowRight,
    AlertTriangle,
    Eye,
    EyeOff,
    User,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createBrowserClient } from "@supabase/ssr";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { FaGithub } from "react-icons/fa6";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isStrongPassword(password: string): boolean {
    return (
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password)
    );
}

export default function SignUpPage() {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations("SignUp");
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseAnonKey();
    const isMissingEnvVars = !supabaseUrl || !supabaseKey;
    const supabase = useMemo(
        () => createBrowserClient(supabaseUrl, supabaseKey),
        [supabaseUrl, supabaseKey]
    );
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validateForm = (): string | null => {
        const trimmedName = fullName.trim();
        const trimmedEmail = email.trim();

        if (!trimmedName) {
            return t("errors.fullNameRequired");
        }

        if (!trimmedEmail) {
            return t("errors.emailRequired");
        }

        if (!EMAIL_PATTERN.test(trimmedEmail)) {
            return t("errors.emailInvalid");
        }

        if (!password) {
            return t("errors.passwordRequired");
        }

        if (!isStrongPassword(password)) {
            return t("errors.passwordWeak");
        }

        if (!confirmPassword) {
            return t("errors.confirmPasswordRequired");
        }

        if (password !== confirmPassword) {
            return t("errors.passwordMismatch");
        }

        return null;
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError("");
        setSuccess("");

        if (isMissingEnvVars) {
            setError(t("errors.databaseNotConfigured"));
            setLoading(false);
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            setLoading(false);
            return;
        }

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                    },
                    emailRedirectTo: `${window.location.origin}/${locale}/reports/me`,
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            if (data?.session?.access_token) {
                setSuccess(t("success"));
                router.push("/reports/me");
                return;
            }

            if (data?.user) {
                setSuccess(t("successConfirmEmail"));
            }
        } catch {
            setError(t("errors.generic"));
        }

        setLoading(false);
    };

    const handleGoogleSignUp = async () => {
        setLoading(true);
        setError("");
        setSuccess("");

        if (isMissingEnvVars) {
            setError(t("errors.databaseNotConfigured"));
            setLoading(false);
            return;
        }

        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/${locale}/reports/me`,
                },
            });

            if (oauthError) {
                setError(oauthError.message);
                setLoading(false);
            }
        } catch {
            setError(t("errors.generic"));
            setLoading(false);
        }
    };

    const handleGithubSignUp = async () => {
        setLoading(true);
        setError("");
        setSuccess("");

        if (isMissingEnvVars) {
            setError(t("errors.databaseNotConfigured"));
            setLoading(false);
            return;
        }

        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: "github",
                options: {
                    redirectTo: `${window.location.origin}/${locale}/reports/me`,
                },
            });

            if (oauthError) {
                setError(oauthError.message);
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

                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-xl">
                    <div className="mb-7">
                        <h2 className="text-3xl font-bold text-(--color-text-primary)">
                            {t("heading")}
                        </h2>

                        <p className="mt-2 text-(--color-text-secondary)">{t("description")}</p>
                    </div>

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

                    {success && (
                        <LiveMessage
                            tone="polite"
                            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-400"
                        >
                            {success}
                        </LiveMessage>
                    )}

                    {error && (
                        <LiveMessage
                            tone="critical"
                            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400"
                        >
                            {error}
                        </LiveMessage>
                    )}

                    <button
                        type="button"
                        onClick={handleGoogleSignUp}
                        disabled={loading || isMissingEnvVars}
                        className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        <FcGoogle size={20} />
                        {t("googleButton")}
                    </button>

                    <button
                        type="button"
                        onClick={handleGithubSignUp}
                        disabled={loading || isMissingEnvVars}
                        className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                        <FaGithub size={20} />
                        {t("githubButton")}
                    </button>

                    <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                        <span className="text-xs font-medium tracking-wider text-(--color-text-muted) uppercase">
                            {t("emailSeparator")}
                        </span>
                        <div className="h-px flex-1 bg-(--color-border-muted)"></div>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-5" noValidate>
                        <div>
                            <label
                                htmlFor="signup-full-name"
                                className="text-sm font-medium text-(--color-text-primary)"
                            >
                                {t("fullNameLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <User className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    id="signup-full-name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder={t("fullNamePlaceholder")}
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="signup-email"
                                className="text-sm font-medium text-(--color-text-primary)"
                            >
                                {t("emailLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <Mail className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    id="signup-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder={t("emailPlaceholder")}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="signup-password"
                                className="text-sm font-medium text-(--color-text-primary)"
                            >
                                {t("passwordLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <Lock className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    id="signup-password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
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
                                    aria-label={
                                        showPassword ? t("hidePassword") : t("showPassword")
                                    }
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

                        <div>
                            <label
                                htmlFor="signup-confirm-password"
                                className="text-sm font-medium text-(--color-text-primary)"
                            >
                                {t("confirmPasswordLabel")}
                            </label>

                            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3.5 transition focus-within:border-emerald-500 focus-within:bg-(--color-surface-page) focus-within:ring-2 focus-within:ring-emerald-500/20">
                                <Lock className="h-5 w-5 text-(--color-text-muted)" />

                                <input
                                    id="signup-confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder={t("confirmPasswordPlaceholder")}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={isMissingEnvVars}
                                    className="w-full bg-transparent text-(--color-text-primary) outline-none placeholder:text-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-50"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    aria-label={
                                        showConfirmPassword
                                            ? t("hideConfirmPassword")
                                            : t("showConfirmPassword")
                                    }
                                    aria-pressed={showConfirmPassword}
                                    className="shrink-0 rounded text-(--color-text-muted) transition hover:text-(--color-text-primary) focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || isMissingEnvVars}
                            className="shadow-emerald-250/20 mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 dark:shadow-emerald-950/20"
                        >
                            {loading ? t("signingUp") : t("signUp")}

                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </button>
                    </form>

                    <div className="mt-7 space-y-2 text-center text-sm text-(--color-text-secondary)">
                        <p>
                            {t("footerPrompt")}{" "}
                            <Link
                                href="/login"
                                className="font-medium text-emerald-600 hover:underline"
                            >
                                {t("signInLink")}
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="mt-6 text-center text-xs text-(--color-text-muted)">
                    {t("bottomText")}
                </p>
            </div>
        </div>
    );
}
