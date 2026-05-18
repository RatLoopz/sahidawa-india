"use client";

import { useState, useCallback } from "react";
import {
    Camera,
    ShieldCheck,
    Info,
    AlertCircle,
    Layers,
    Copy,
    Check,
    Home,
    Share2,
    XCircle,
    AlertTriangle,
    Search,
    X,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { toast } from "sonner";
import Footer from "../components/Footer";
import { ExpiryBadge } from "@/components/scanner/ExpiryBadge";
import { verifyMedicine, VerifyResult, VerifiedMedicine } from "@/lib/api";

function formatExpiryForBadge(isoDate: string | null | undefined): string | undefined {
    if (!isoDate) return undefined;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return undefined;
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function CdscoStatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        approved: {
            label: "CDSCO Approved",
            className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
        recalled: {
            label: "Recalled",
            className: "bg-amber-50 text-amber-700 border-amber-200",
        },
        banned: {
            label: "Banned",
            className: "bg-red-50 text-red-700 border-red-200",
        },
    };
    const c = config[status] ?? {
        label: status,
        className: "bg-slate-50 text-slate-600 border-slate-200",
    };
    return (
        <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${c.className}`}
        >
            {c.label}
        </span>
    );
}

function LoadingSkeleton() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
                <div className="absolute top-0 right-0 left-0 h-2 animate-pulse bg-emerald-500"></div>
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-slate-100">
                        <ShieldCheck size={40} className="text-slate-200" />
                    </div>
                    <div className="w-full space-y-2">
                        <div className="mx-auto h-7 w-3/4 animate-pulse rounded-lg bg-slate-100"></div>
                        <div className="mx-auto h-4 w-1/2 animate-pulse rounded-lg bg-slate-100"></div>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-200"></div>
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-200"></div>
                        </div>
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-slate-200"></div>
                            <div className="mx-auto h-5 w-1/2 animate-pulse rounded bg-slate-200"></div>
                        </div>
                    </div>
                    <div className="w-full space-y-2 rounded-2xl border border-emerald-100/50 bg-emerald-50/50 p-4">
                        <div className="h-3 w-full animate-pulse rounded bg-emerald-200/50"></div>
                        <div className="h-3 w-5/6 animate-pulse rounded bg-emerald-200/50"></div>
                    </div>
                    <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100 py-4"></div>
                    <div className="mx-auto h-4 w-24 animate-pulse rounded bg-slate-100"></div>
                </div>
                <div className="mt-4 animate-pulse text-center text-sm font-medium text-slate-400">
                    Verifying with CDSCO Database...
                </div>
            </div>
        </div>
    );
}

function VerifiedSafeResult({
    medicine,
    onScanAgain,
    onShare,
    onCopyBatch,
    copied,
}: {
    medicine: VerifiedMedicine;
    onScanAgain: () => void;
    onShare: () => void;
    onCopyBatch: () => void;
    copied: boolean;
}) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                    <ShieldCheck size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight">{medicine.brand_name}</h3>
                    <p className="font-medium text-slate-500">Verified by CDSCO Database</p>
                </div>

                <CdscoStatusBadge status={medicine.cdsco_approval_status} />

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Batch No.
                        </span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-700">
                                {medicine.batch_number}
                            </span>
                            <button
                                onClick={onCopyBatch}
                                className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                                    copied
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-slate-200/60 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                    <ExpiryBadge expiryDate={formatExpiryForBadge(medicine.expiry_date)} />
                </div>

                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-slate-700">
                            {medicine.manufacturer}
                        </span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Generic Name
                        </span>
                        <span className="text-sm font-bold text-slate-700">
                            {medicine.generic_name}
                        </span>
                    </div>
                </div>

                {(medicine.cdsco_approval_status === "recalled" ||
                    medicine.cdsco_approval_status === "banned") && (
                    <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                        <p className="text-xs leading-relaxed font-medium text-amber-800">
                            This medicine has been <strong>{medicine.cdsco_approval_status}</strong>{" "}
                            by CDSCO. Consult your pharmacist before use.
                        </p>
                    </div>
                )}

                {medicine.cdsco_approval_status === "approved" && (
                    <div className="flex w-full items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left">
                        <Info size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                        <p className="text-xs leading-relaxed font-medium text-emerald-800">
                            This medicine matches the official records. Always check the physical
                            seal before use.
                        </p>
                    </div>
                )}

                <ResultActions onScanAgain={onScanAgain} onShare={onShare} />
            </div>
        </div>
    );
}

function CounterfeitAlertResult({
    medicine,
    onScanAgain,
    onShare,
}: {
    medicine: VerifiedMedicine;
    onScanAgain: () => void;
    onShare: () => void;
}) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-red-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner">
                    <AlertTriangle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-red-700">
                        Counterfeit Alert
                    </h3>
                    <p className="font-medium text-slate-500">{medicine.brand_name}</p>
                </div>

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 uppercase">
                            Batch No.
                        </span>
                        <span className="font-bold text-red-700">{medicine.batch_number}</span>
                    </div>
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 uppercase">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-red-700">
                            {medicine.manufacturer}
                        </span>
                    </div>
                </div>

                <div className="flex w-full items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
                    <p className="text-xs leading-relaxed font-bold text-red-800">
                        WARNING: This medicine has been flagged as counterfeit. Do NOT consume.
                        Report to your nearest pharmacy or call the CDSCO helpline immediately.
                    </p>
                </div>

                <ResultActions onScanAgain={onScanAgain} onShare={onShare} />
            </div>
        </div>
    );
}

function UnverifiedResult({ onScanAgain }: { onScanAgain: () => void }) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                    <XCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-amber-700">
                        Unverified Medicine
                    </h3>
                    <p className="font-medium text-slate-500">No match found in CDSCO Database</p>
                </div>

                <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                    <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed font-medium text-amber-800">
                        No matching record was found for this batch number. This does not
                        necessarily mean the medicine is fake. Try re-entering the batch number or
                        report it for investigation.
                    </p>
                </div>

                <button
                    onClick={onScanAgain}
                    className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}

function ErrorResult({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-slate-400"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-inner">
                    <AlertCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-700">
                        Verification Failed
                    </h3>
                    <p className="font-medium text-slate-500">{message}</p>
                </div>

                <button
                    onClick={onRetry}
                    className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}

function ResultActions({ onScanAgain, onShare }: { onScanAgain: () => void; onShare: () => void }) {
    return (
        <div className="grid w-full grid-cols-1 gap-3">
            <button
                onClick={onScanAgain}
                className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800"
            >
                Scan Another
            </button>
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 py-3.5 font-semibold text-slate-700 transition-all hover:bg-slate-200"
                >
                    <Home size={18} />
                    <span>Home</span>
                </Link>
                <button
                    onClick={onShare}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 py-3.5 font-semibold text-slate-700 transition-all hover:bg-slate-200"
                >
                    <Share2 size={18} />
                    <span>Share</span>
                </button>
            </div>
        </div>
    );
}

export default function ScanPage() {
    const [isScanning, setIsScanning] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [batchInput, setBatchInput] = useState("");
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const handleVerify = useCallback(async (batch: string) => {
        if (!batch.trim()) {
            toast.error("Please enter a batch number to verify");
            return;
        }
        setIsScanning(true);
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);

        try {
            const result = await verifyMedicine(batch.trim());
            setVerifyResult(result);
        } catch (err) {
            setVerifyError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setIsScanning(false);
            setShowResult(true);
        }
    }, []);

    const handleCopyBatch = useCallback(async () => {
        const batch = verifyResult?.verified ? verifyResult.medicine.batch_number : batchInput;
        try {
            await navigator.clipboard.writeText(batch);
            setCopied(true);
            toast.success("Batch number copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textArea = document.createElement("textarea");
            textArea.value = batch;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setCopied(true);
            toast.success("Batch number copied!");
            setTimeout(() => setCopied(false), 2000);
        }
    }, [verifyResult, batchInput]);

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast.error("File exceeds 10MB limit");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setUploadedImage(reader.result as string);
            if (!batchInput.trim()) {
                toast.error("Please enter a batch number before uploading");
                return;
            }
            handleVerify(batchInput);
        };
        reader.readAsDataURL(file);
    };

    const handleScanAgain = () => {
        setIsScanning(false);
        setShowResult(false);
        setUploadedImage(null);
        setVerifyResult(null);
        setVerifyError(null);
        setBatchInput("");
    };

    const handleDismissResult = () => {
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
    };

    const handleShare = async () => {
        let shareText = "";
        if (verifyResult?.verified) {
            const m = verifyResult.medicine;
            shareText = [
                `Medicine: ${m.brand_name}`,
                `Generic: ${m.generic_name}`,
                `Manufacturer: ${m.manufacturer}`,
                `Batch No: ${m.batch_number}`,
                `Expiry: ${formatExpiryForBadge(m.expiry_date) ?? "Unknown"}`,
                `CDSCO Status: ${m.cdsco_approval_status}`,
                m.is_counterfeit_alert ? "⚠ COUNTERFEIT ALERT" : "Status: Verified",
            ].join("\n");
        } else {
            shareText = `Medicine Verification: Unverified batch — ${batchInput}`;
        }

        const shareData = {
            title: "Medicine Verification Result",
            text: shareText,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                toast.success("Result shared successfully");
            } else {
                await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
                toast.success("Result copied to clipboard");
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name !== "AbortError") {
                toast.error("Failed to share result");
            }
        }
    };

    const handleBatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleVerify(batchInput);
    };

    return (
        <div className="relative flex min-h-screen flex-col bg-black font-sans text-white">
            <input
                type="file"
                id="medicine-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />

            <PageHeader
                title="Scanner Mode"
                subtitle="Position the Barcode"
                backHref="/"
                variant="dark"
            />

            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                <div className="absolute inset-0 overflow-hidden bg-slate-900">
                    {uploadedImage ? (
                        <img
                            src={uploadedImage}
                            alt="Uploaded"
                            className="h-full w-full object-cover opacity-60"
                        />
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                            <div className="absolute inset-0 animate-pulse bg-emerald-500/5"></div>
                        </>
                    )}
                </div>

                <div className="relative z-10 h-72 w-72 md:h-96 md:w-96">
                    <div className="absolute top-0 left-0 h-12 w-12 rounded-tl-2xl border-t-4 border-l-4 border-emerald-500"></div>
                    <div className="absolute top-0 right-0 h-12 w-12 rounded-tr-2xl border-t-4 border-r-4 border-emerald-500"></div>
                    <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-2xl border-b-4 border-l-4 border-emerald-500"></div>
                    <div className="absolute right-0 bottom-0 h-12 w-12 rounded-br-2xl border-r-4 border-b-4 border-emerald-500"></div>

                    {isScanning && (
                        <div className="animate-scan absolute right-4 left-4 z-20 h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
                    )}

                    {!isScanning && !showResult && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Camera size={48} className="animate-pulse text-emerald-500/30" />
                        </div>
                    )}
                </div>

                {isScanning && <LoadingSkeleton />}

                {showResult && (
                    <div className="animate-in fade-in zoom-in absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm duration-300">
                        <button
                            onClick={handleDismissResult}
                            className="absolute top-4 right-4 z-40 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                        >
                            <X size={24} />
                        </button>
                        {verifyError && (
                            <ErrorResult message={verifyError} onRetry={handleDismissResult} />
                        )}
                        {!verifyError &&
                            verifyResult?.verified &&
                            verifyResult.medicine.is_counterfeit_alert && (
                                <CounterfeitAlertResult
                                    medicine={verifyResult.medicine}
                                    onScanAgain={handleScanAgain}
                                    onShare={handleShare}
                                />
                            )}
                        {!verifyError &&
                            verifyResult?.verified &&
                            !verifyResult.medicine.is_counterfeit_alert && (
                                <VerifiedSafeResult
                                    medicine={verifyResult.medicine}
                                    onScanAgain={handleScanAgain}
                                    onShare={handleShare}
                                    onCopyBatch={handleCopyBatch}
                                    copied={copied}
                                />
                            )}
                        {!verifyError && verifyResult && !verifyResult.verified && (
                            <UnverifiedResult onScanAgain={handleDismissResult} />
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center gap-6 bg-gradient-to-t from-black to-transparent p-8">
                <form onSubmit={handleBatchSubmit} className="flex w-full max-w-sm gap-2">
                    <input
                        type="text"
                        value={batchInput}
                        onChange={(e) => setBatchInput(e.target.value)}
                        placeholder="Enter batch number"
                        className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white placeholder-white/40 focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isScanning}
                        className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Search size={18} />
                        Verify
                    </button>
                </form>

                <p className="max-w-xs text-center text-sm font-medium text-slate-400">
                    Enter the batch number from the medicine strip, or upload a photo from your
                    gallery.
                </p>
                <div className="flex gap-4">
                    <label
                        htmlFor="medicine-upload"
                        className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-slate-200"
                    >
                        <Layers size={18} />
                        Upload Photo
                    </label>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <AlertCircle size={20} className="text-white/50" />
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
