"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Loader2, Save, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import {
    getSubscriptionStatus,
    registerSubscription,
    updateSubscription,
    optOutSubscription,
} from "@/lib/api/notifications";
import { useSession } from "@/src/components/AuthProvider";
import { PageHeader } from "../components/PageHeader";

const GUEST_PHONE_KEY = "sahidawa-sms-phone";

type FormState = {
    phone: string;
    sms: boolean;
    whatsapp: boolean;
    language: string;
    district: string;
};

export default function SettingsPage() {
    const t = useTranslations("Settings");
    const { token: sessionToken, isLoading: authLoading } = useSession();

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
        null
    );

    const [form, setForm] = useState<FormState>({
        phone: "",
        sms: false,
        whatsapp: true, // Default to whatsapp as requested
        language: "en",
        district: "",
    });

    const [validationError, setValidationError] = useState<string | null>(null);

    // Decode JWT token loosely to verify authenticated status
    useEffect(() => {
        if (authLoading) return;

        if (sessionToken) {
            setToken(sessionToken);
            setIsAuthenticated(true);
        }

        // Fetch subscription status on load
        const guestPhone = localStorage.getItem(GUEST_PHONE_KEY) || undefined;

        getSubscriptionStatus(guestPhone, sessionToken || undefined)
            .then((res) => {
                if (res.registered) {
                    setForm({
                        phone: res.subscriber.phone.replace("+91", ""),
                        sms: res.subscriber.channels.includes("sms"),
                        whatsapp: res.subscriber.channels.includes("whatsapp"),
                        language: res.subscriber.language,
                        district: res.subscriber.district || "",
                    });
                }
            })
            .catch((err) => {
                console.error("Failed to load settings:", err);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [authLoading, sessionToken]);

    const validateForm = (): boolean => {
        if (!/^\d{10}$/.test(form.phone.trim())) {
            setValidationError(t("phoneInvalid"));
            return false;
        }
        if (!form.sms && !form.whatsapp) {
            setValidationError(
                "At least one communication channel (SMS or WhatsApp) must be enabled."
            );
            return false;
        }
        if (!form.district.trim()) {
            setValidationError(t("districtRequired"));
            return false;
        }
        setValidationError(null);
        return true;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSaving(true);
        setMessage(null);

        const channels: ("sms" | "whatsapp")[] = [];
        if (form.sms) channels.push("sms");
        if (form.whatsapp) channels.push("whatsapp");

        const payload = {
            phone: form.phone.trim(),
            channels,
            language: form.language,
            district: form.district.trim(),
        };

        try {
            const guestPhone = localStorage.getItem(GUEST_PHONE_KEY);
            let response;

            if (guestPhone || isAuthenticated) {
                // If already registered in local storage or logged in, update it
                response = await updateSubscription(
                    {
                        phone: guestPhone || payload.phone,
                        newPhone: payload.phone,
                        channels: payload.channels,
                        language: payload.language,
                        district: payload.district,
                    },
                    token || undefined
                );
            } else {
                // Register a new subscription
                response = await registerSubscription(payload, token || undefined);
            }

            if (response.success) {
                localStorage.setItem(GUEST_PHONE_KEY, response.subscriber.phone);
                setMessage({ type: "success", text: t("successMessage") });
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setMessage({ type: "error", text: err.message || t("errorMessage") });
            } else {
                setMessage({ type: "error", text: t("errorMessage") });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleOptOut = async () => {
        const guestPhone = localStorage.getItem(GUEST_PHONE_KEY);
        if (!guestPhone && !isAuthenticated) return;

        if (
            !confirm(
                "Are you sure you want to opt out and stop receiving all SMS & WhatsApp alerts?"
            )
        ) {
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const response = await optOutSubscription(
                { phone: guestPhone || undefined },
                token || undefined
            );
            if (response.success) {
                localStorage.removeItem(GUEST_PHONE_KEY);
                setForm({
                    phone: "",
                    sms: false,
                    whatsapp: true,
                    language: "en",
                    district: "",
                });
                setMessage({ type: "success", text: t("optOutSuccess") });
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setMessage({ type: "error", text: err.message || t("errorMessage") });
            } else {
                setMessage({ type: "error", text: t("errorMessage") });
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-grow items-center justify-center bg-(--color-surface-muted) py-12">
                <div className="flex flex-col items-center gap-3 text-(--color-text-secondary)">
                    <Loader2
                        className="animate-spin text-emerald-600 dark:text-emerald-400"
                        size={36}
                    />
                    <p className="font-semibold">Loading your preferences...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8 text-(--color-text-primary)">
            <div className="mx-auto max-w-2xl">
                <PageHeader backHref="/profile" variant="light" />

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400">
                        <Bell size={30} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-(--color-text-primary) sm:text-3xl">
                            {t("title")}
                        </h1>
                        <p className="mt-1 text-(--color-text-secondary)">{t("subtitle")}</p>
                    </div>
                </div>

                {/* Message Banners */}
                {message && (
                    <div
                        className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
                            message.type === "success"
                                ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-300"
                                : "border-red-200 bg-red-50/50 text-red-800 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-300"
                        }`}
                    >
                        {message.type === "success" ? (
                            <CheckCircle
                                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                size={20}
                            />
                        ) : (
                            <AlertTriangle
                                className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                                size={20}
                            />
                        )}
                        <span className="text-sm font-semibold">{message.text}</span>
                    </div>
                )}

                {validationError && (
                    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-amber-800 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-amber-300">
                        <AlertTriangle
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            size={20}
                        />
                        <span className="text-sm font-semibold">{validationError}</span>
                    </div>
                )}

                {/* Settings Card */}
                <form
                    onSubmit={handleSave}
                    className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm sm:p-8"
                >
                    <div className="flex flex-col gap-6">
                        {/* Phone Number */}
                        <div>
                            <label className="mb-2 block text-sm font-bold text-(--color-text-primary)">
                                {t("phoneLabel")}
                            </label>
                            <div className="flex rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 shadow-inner">
                                <span className="mr-2 border-r border-(--color-border-muted) pr-2 font-semibold text-(--color-text-secondary) select-none">
                                    +91
                                </span>
                                <input
                                    type="text"
                                    value={form.phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        setForm({ ...form, phone: val.slice(0, 10) });
                                    }}
                                    placeholder={t("phonePlaceholder")}
                                    className="w-full bg-transparent font-semibold text-(--color-text-primary) placeholder-(--color-text-muted) focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* District Selector */}
                        <div>
                            <label className="mb-2 block text-sm font-bold text-(--color-text-primary)">
                                {t("districtLabel")}
                            </label>
                            <input
                                type="text"
                                value={form.district}
                                onChange={(e) => setForm({ ...form, district: e.target.value })}
                                placeholder={t("districtPlaceholder")}
                                className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 font-semibold text-(--color-text-primary) placeholder-(--color-text-muted) shadow-inner focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                            <p className="mt-1 text-xs text-(--color-text-secondary)">
                                {t("districtDesc")}
                            </p>
                        </div>

                        {/* Preferred Alert Language */}
                        <div>
                            <label className="mb-2 block text-sm font-bold text-(--color-text-primary)">
                                {t("langLabel")}
                            </label>
                            <select
                                value={form.language}
                                onChange={(e) => setForm({ ...form, language: e.target.value })}
                                className="w-full rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 font-semibold text-(--color-text-primary) shadow-inner focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                                <option value="en">English</option>
                                <option value="hi">हिन्दी (Hindi)</option>
                                <option value="ta">தமிழ் (Tamil)</option>
                                <option value="te">తెలుగు (Telugu)</option>
                                <option value="bn">বাংলা (Bengali)</option>
                                <option value="mr">मराठी (Marathi)</option>
                                <option value="gu">ગુજરાતી (Gujarati)</option>
                                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                                <option value="ml">മലയാളം (Malayalam)</option>
                                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                                <option value="ur">اردو (Urdu)</option>
                                <option value="as">অসমীয়া (Assamese)</option>
                            </select>
                            <p className="mt-1 text-xs text-(--color-text-secondary)">
                                {t("langDesc")}
                            </p>
                        </div>

                        <hr className="border-(--color-border-muted)" />

                        {/* Preferred Channels */}
                        <div>
                            <h3 className="mb-4 text-sm font-bold text-(--color-text-primary)">
                                {t("channelsLabel")}
                            </h3>

                            <div className="flex flex-col gap-4">
                                {/* SMS Toggle */}
                                <label className="flex cursor-pointer items-start gap-4">
                                    <input
                                        type="checkbox"
                                        checked={form.sms}
                                        onChange={(e) =>
                                            setForm({ ...form, sms: e.target.checked })
                                        }
                                        className="mt-1 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-bold text-(--color-text-primary)">
                                            {t("smsLabel")}
                                        </span>
                                        <span className="block text-xs text-(--color-text-secondary)">
                                            {t("smsDesc")}
                                        </span>
                                    </div>
                                </label>

                                {/* WhatsApp Toggle */}
                                <label className="flex cursor-pointer items-start gap-4">
                                    <input
                                        type="checkbox"
                                        checked={form.whatsapp}
                                        onChange={(e) =>
                                            setForm({ ...form, whatsapp: e.target.checked })
                                        }
                                        className="mt-1 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-bold text-(--color-text-primary)">
                                            {t("whatsappLabel")}
                                        </span>
                                        <span className="block text-xs text-(--color-text-secondary)">
                                            {t("whatsappDesc")}
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <hr className="border-(--color-border-muted)" />

                        {/* Actions */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                {isSaving ? t("saving") : t("saveButton")}
                            </button>

                            {((typeof window !== "undefined" &&
                                localStorage.getItem(GUEST_PHONE_KEY)) ||
                                isAuthenticated) && (
                                <button
                                    type="button"
                                    onClick={handleOptOut}
                                    disabled={isSaving}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-transparent px-6 py-3.5 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/30 dark:hover:bg-red-950/10"
                                >
                                    <Trash2 size={18} />
                                    {t("optOutButton")}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
