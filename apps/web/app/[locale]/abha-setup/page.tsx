"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { linkABHA, verifyABHAOtp } from "@/lib/api/abha";

export default function ABHASetupPage() {
    const [abhaAddress, setAbhaAddress] = useState("");
    const [txnId, setTxnId] = useState("");
    const [otp, setOtp] = useState("");
    const [linked, setLinked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleGenerateOtp = async () => {
        setError("");

        if (!abhaAddress.trim()) {
            setError("ABHA address is required");
            return;
        }

        try {
            setLoading(true);

            const result = await linkABHA({
                abhaAddress,
            });

            setTxnId(result.txnId);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError("");

        if (!otp.trim()) {
            setError("OTP is required");
            return;
        }

        try {
            setLoading(true);

            await verifyABHAOtp({
                txnId,
                otp,
            });

            setLinked(true);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-6 py-8">
            <div className="mx-auto max-w-2xl">
                <Link href="/profile" className="mb-6 inline-flex items-center gap-2">
                    <ArrowLeft size={18} />
                    Back to Profile
                </Link>

                <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <ShieldCheck className="text-emerald-600" />
                        <h1 className="text-2xl font-bold">ABHA Setup</h1>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl bg-red-100 p-4 text-red-700">{error}</div>
                    )}

                    {!linked && (
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={abhaAddress}
                                onChange={(e) => setAbhaAddress(e.target.value)}
                                placeholder="Enter ABHA Address"
                                className="w-full rounded-xl border p-3"
                            />

                            <button
                                onClick={handleGenerateOtp}
                                disabled={loading}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
                            >
                                Generate OTP
                            </button>

                            {txnId && (
                                <>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="Enter OTP"
                                        className="w-full rounded-xl border p-3"
                                    />

                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={loading}
                                        className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
                                    >
                                        Verify OTP
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {linked && (
                        <div className="rounded-xl bg-green-100 p-4 text-green-700">
                            ABHA successfully linked.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
