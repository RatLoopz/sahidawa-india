"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { ArrowLeft, FileText, CheckCircle2, ShieldCheck, Activity } from "lucide-react";
import {
    getABHAPrescriptions,
    ABHAPrescription,
    getABHAStatus,
    linkABHA,
    verifyABHAOtp,
} from "@/lib/api/abha";
import { useTranslations } from "next-intl";

export default function ABHARecordsPage() {
    const t = useTranslations("AbhaRecords");

    // Core state
    const [isLinked, setIsLinked] = useState<boolean | null>(null);
    const [records, setRecords] = useState<ABHAPrescription[]>([]);

    // Status states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Linking states
    const [linkingStep, setLinkingStep] = useState<"IDLE" | "OTP_SENT">("IDLE");
    const [abhaAddress, setAbhaAddress] = useState("");
    const [otp, setOtp] = useState("");
    const [txnId, setTxnId] = useState("");
    const [linkLoading, setLinkLoading] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            setLoading(true);
            setError("");
            const status = await getABHAStatus();
            setIsLinked(status.isLinked);

            if (status.isLinked) {
                await loadRecords();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failedToLoadStatus"));
        } finally {
            setLoading(false);
        }
    };

    const loadRecords = async () => {
        try {
            const data = await getABHAPrescriptions();
            setRecords(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failedToLoad"));
        }
    };

    const handleLinkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!abhaAddress.trim()) return;

        try {
            setLinkLoading(true);
            setError("");
            const res = await linkABHA({ abhaAddress });
            setTxnId(res.txnId);
            setLinkingStep("OTP_SENT");
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failedToLink"));
        } finally {
            setLinkLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim()) return;

        try {
            setLinkLoading(true);
            setError("");
            await verifyABHAOtp({ abhaAddress, txnId, otp });
            // Successfully verified
            setIsLinked(true);
            setLinkingStep("IDLE");
            await loadRecords();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("failedToVerify"));
        } finally {
            setLinkLoading(false);
        }
    };

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    href="/profile"
                    className="mb-6 inline-flex items-center gap-2 font-medium text-(--color-text-muted) transition-colors hover:text-(--color-text-default)"
                >
                    <ArrowLeft size={18} />
                    {t("backToProfile")}
                </Link>

                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-8 shadow-sm">
                    <div className="mb-8 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-(--color-text-default)">
                                {t("title")}
                            </h1>
                            <p className="text-sm text-(--color-text-muted)">{t("subtitle")}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                            <ShieldCheck className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                        </div>
                    ) : isLinked === false ? (
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-6">
                            <h2 className="mb-2 text-lg font-semibold">{t("linkAccount")}</h2>
                            <p className="mb-6 text-sm text-(--color-text-muted)">
                                {t("linkDescription")}
                            </p>

                            {linkingStep === "IDLE" ? (
                                <form onSubmit={handleLinkSubmit} className="max-w-md space-y-4">
                                    <div>
                                        <label
                                            htmlFor="abhaAddress"
                                            className="mb-1 block text-sm font-medium"
                                        >
                                            {t("abhaAddressLabel")}
                                        </label>
                                        <input
                                            id="abhaAddress"
                                            type="text"
                                            value={abhaAddress}
                                            onChange={(e) => setAbhaAddress(e.target.value)}
                                            placeholder={t("abhaAddressPlaceholder")}
                                            className="w-full rounded-xl border border-(--color-border-default) px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            disabled={linkLoading}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={linkLoading || !abhaAddress.trim()}
                                        className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        {linkLoading ? (
                                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                        ) : null}
                                        {t("requestOtp")}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleOtpSubmit} className="max-w-md space-y-4">
                                    <div>
                                        <label
                                            htmlFor="otp"
                                            className="mb-1 block text-sm font-medium"
                                        >
                                            {t("otpLabel")}
                                        </label>
                                        <input
                                            id="otp"
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            placeholder={t("otpPlaceholder")}
                                            className="w-full rounded-xl border border-(--color-border-default) px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                            disabled={linkLoading}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLinkingStep("IDLE");
                                                setOtp("");
                                            }}
                                            disabled={linkLoading}
                                            className="w-1/3 rounded-xl border border-(--color-border-default) px-4 py-3 font-semibold hover:bg-(--color-surface-hover) disabled:opacity-50"
                                        >
                                            {t("cancel")}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={linkLoading || !otp.trim()}
                                            className="flex w-2/3 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {linkLoading ? (
                                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                            ) : null}
                                            {t("verifyOtp")}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-600">
                                <CheckCircle2 size={18} />
                                <span className="font-medium">{t("accountLinked")}</span>
                            </div>

                            {records.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-(--color-border-default) p-12 text-center">
                                    <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                                    <h3 className="text-lg font-medium text-gray-900">
                                        {t("noPrescriptions")}
                                    </h3>
                                    <p className="mt-1 text-gray-500">{t("noPrescriptionsDesc")}</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {records.map((record) => (
                                        <div
                                            key={record.id}
                                            className="group flex cursor-pointer items-start gap-4 rounded-2xl border border-(--color-border-muted) p-5 transition-all hover:border-emerald-200 hover:shadow-md"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-(--color-text-default) transition-colors group-hover:text-emerald-700">
                                                    {record.title}
                                                </h3>
                                                <p className="mt-1 text-sm text-(--color-text-muted)">
                                                    {new Date(record.issuedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
