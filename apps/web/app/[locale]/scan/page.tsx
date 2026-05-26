"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
    ScanLine,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { toast } from "sonner";
import { ExpiryBadge } from "@/components/scanner/ExpiryBadge";
import {
    submitReport,
    verifyMedicine,
    fuzzyMatchBrand,
    verifyMedicineByBrand,
    checkLasaConflicts,
    type VerifyResult,
    type LasaMatch,
    type VerifiedMedicine,
    API_BASE,
} from "@/lib/api";
import LasaConfirmation from "@/components/scanner/LasaConfirmation";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import LazyImage from "@/components/LazyImage";
import { Skeleton } from "@/components/ui/Skeleton";
import Tesseract from "tesseract.js";
import {
    extractExpiryDate,
    extractBatchNumber,
    extractMedicineName,
} from "@/src/utils/medicineParser";

function formatExpiryForBadge(isoDate: string | null | undefined): string | undefined {
    if (!isoDate) return undefined;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return undefined;
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function expiryToIso(expiryStr: string): string {
    const [month, year] = expiryStr.split("/");
    return `${year}-${month.padStart(2, "0")}-01T00:00:00.000Z`;
}

function CdscoStatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        approved: {
            label: "CDSCO Approved",
            className: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border-emerald-250 dark:border-emerald-900/30",
        },
        recalled: {
            label: "Recalled",
            className: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450 border-amber-250 dark:border-amber-900/30",
        },
        banned: {
            label: "Banned",
            className: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/30",
        },
    };
    const c = config[status] ?? {
        label: status,
        className: "bg-(--color-surface-muted) text-(--color-text-secondary) border-(--color-border-muted)",
    };
    return (
        <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${c.className}`}
        >
            {c.label}
        </span>
    );
}

function formatMedicineDetails(medicine: VerifiedMedicine) {
    return [
        `Medicine: ${medicine.brand_name}`,
        `Generic: ${medicine.generic_name}`,
        `Manufacturer: ${medicine.manufacturer}`,
        `Batch No: ${medicine.batch_number}`,
        `Expiry: ${formatExpiryForBadge(medicine.expiry_date) ?? "Unknown"}`,
        `CDSCO Status: ${medicine.cdsco_approval_status}`,
        medicine.is_counterfeit_alert ? "Status: Counterfeit alert" : "Status: Verified",
    ].join("\n");
}

function LoadingSkeleton({ ocrStatus, ocrProgress }: { ocrStatus: string; ocrProgress: number }) {
    let message = "Verifying with CDSCO Database...";
    if (ocrStatus === "scanning-barcode") {
        message = "Scanning barcode...";
    } else if (ocrStatus === "extracting-text") {
        message = `Extracting text with OCR... ${ocrProgress}%`;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-(--color-surface-page) p-8 text-(--color-text-primary) border border-(--color-border-muted) shadow-2xl">
                <Skeleton className="absolute top-0 right-0 left-0 h-2 rounded-none bg-emerald-500" />
                <div className="flex flex-col items-center space-y-4 text-center">
                    <Skeleton className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-surface-muted)">
                        <ShieldCheck size={40} className="text-(--color-text-muted)" />
                    </Skeleton>
                    <div className="w-full space-y-2">
                        <Skeleton className="mx-auto h-7 w-3/4 rounded-lg bg-(--color-surface-muted)" />
                        <Skeleton className="mx-auto h-4 w-1/2 rounded-lg bg-(--color-surface-muted)" />
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <Skeleton className="mx-auto h-3 w-3/4 rounded bg-(--color-border-muted)" />
                            <Skeleton className="mx-auto h-5 w-1/2 rounded bg-(--color-border-muted)" />
                        </div>
                        <div className="space-y-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <Skeleton className="mx-auto h-3 w-3/4 rounded bg-(--color-border-muted)" />
                            <Skeleton className="mx-auto h-5 w-1/2 rounded bg-(--color-border-muted)" />
                        </div>
                    </div>
                    <div className="w-full space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <Skeleton className="h-3 w-full rounded bg-emerald-500/20" />
                        <Skeleton className="h-3 w-5/6 rounded bg-emerald-500/20" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-2xl bg-(--color-surface-muted)" />
                    <Skeleton className="mx-auto h-4 w-24 rounded bg-(--color-surface-muted)" />
                </div>
                <div className="mt-4 animate-pulse text-center text-sm font-medium text-slate-400">
                    {message}
                </div>
                {ocrStatus === "extracting-text" && (
                    <div className="mx-auto mt-3 h-1.5 w-3/4 overflow-hidden rounded-full bg-(--color-surface-muted)">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function VerifiedSafeResult({
    medicine,
    onScanAgain,
    onShare,
    onCopyMedicineDetails,
    copied,
}: {
    medicine: VerifiedMedicine;
    onScanAgain: () => void;
    onShare: () => void;
    onCopyMedicineDetails: () => void;
    copied: boolean;
}) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-(--color-surface-page) p-8 text-(--color-text-primary) border border-(--color-border-muted) shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-450 shadow-inner">
                    <ShieldCheck size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight">{medicine.brand_name}</h3>
                    <p className="font-medium text-(--color-text-secondary)">Verified by CDSCO Database</p>
                </div>

                <CdscoStatusBadge status={medicine.cdsco_approval_status} />

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Batch No.
                        </span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-(--color-text-primary)">
                                {medicine.batch_number}
                            </span>
                            <button
                                onClick={onCopyMedicineDetails}
                                aria-label="Copy medicine details"
                                title="Copy medicine details"
                                className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                                    copied
                                        ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                                        : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                    <ExpiryBadge expiryDate={formatExpiryForBadge(medicine.expiry_date)} />
                </div>

                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-(--color-text-primary)">
                            {medicine.manufacturer}
                        </span>
                    </div>
                    <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Generic Name
                        </span>
                        <span className="text-sm font-bold text-(--color-text-primary)">
                            {medicine.generic_name}
                        </span>
                    </div>
                </div>

                {(medicine.cdsco_approval_status === "recalled" ||
                    medicine.cdsco_approval_status === "banned") && (
                    <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-250 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 text-left">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-400">
                            This medicine has been <strong>{medicine.cdsco_approval_status}</strong>{" "}
                            by CDSCO. Consult your pharmacist before use.
                        </p>
                    </div>
                )}

                {medicine.cdsco_approval_status === "approved" && (
                    <div className="flex w-full items-start gap-3 rounded-2xl border border-emerald-250 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-left">
                        <Info size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-450" />
                        <p className="text-xs leading-relaxed font-medium text-emerald-800 dark:text-amber-400">
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
    onCopyMedicineDetails,
    copied,
}: {
    medicine: VerifiedMedicine;
    onScanAgain: () => void;
    onShare: () => void;
    onCopyMedicineDetails: () => void;
    copied: boolean;
}) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-(--color-surface-page) p-8 text-(--color-text-primary) border border-(--color-border-muted) shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-red-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 shadow-inner">
                    <AlertTriangle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-red-700 dark:text-red-400">
                        Counterfeit Alert
                    </h3>
                    <p className="font-medium text-(--color-text-secondary)">{medicine.brand_name}</p>
                </div>

                <div className="grid w-full grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl border border-red-250/30 dark:border-red-900/30 bg-red-500/10 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 dark:text-red-500/80 uppercase">
                            Batch No.
                        </span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-red-700 dark:text-red-400">{medicine.batch_number}</span>
                            <button
                                onClick={onCopyMedicineDetails}
                                aria-label="Copy medicine details"
                                title="Copy medicine details"
                                className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                                    copied
                                        ? "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                                        : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-red-250/30 dark:border-red-900/30 bg-red-500/10 p-3">
                        <span className="block text-[10px] font-bold tracking-wider text-red-400 dark:text-red-500/80 uppercase">
                            Manufacturer
                        </span>
                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                            {medicine.manufacturer}
                        </span>
                    </div>
                </div>

                <div className="flex w-full items-start gap-3 rounded-2xl border border-red-250 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 text-left">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                    <p className="text-xs leading-relaxed font-bold text-red-800 dark:text-red-400">
                        WARNING: This medicine has been flagged as counterfeit. Do NOT consume.
                        Report to your nearest pharmacy or call the CDSCO helpline immediately.
                    </p>
                </div>

                <ResultActions onScanAgain={onScanAgain} onShare={onShare} />
            </div>
        </div>
    );
}

function UnverifiedResult({
    brandName,
    batchNumber,
    expiryDate,
    onScanAgain,
}: {
    brandName?: string;
    batchNumber?: string;
    expiryDate?: string;
    onScanAgain: () => void;
}) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-(--color-surface-page) p-8 text-(--color-text-primary) border border-(--color-border-muted) shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-450 shadow-inner">
                    <XCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-amber-700 dark:text-amber-450">
                        {brandName || "Unverified Medicine"}
                    </h3>
                    <p className="font-medium text-(--color-text-secondary)">No match found in CDSCO Database</p>
                </div>

                {(batchNumber || expiryDate) && (
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                Batch No.
                            </span>
                            <span className="font-bold text-(--color-text-primary)">
                                {batchNumber || "Unknown"}
                            </span>
                        </div>
                        <ExpiryBadge expiryDate={expiryDate} />
                    </div>
                )}

                <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-250 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 text-left">
                    <Info size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs leading-relaxed font-medium text-amber-800 dark:text-amber-450">
                        No matching record was found for this medicine batch in the CDSCO database.
                        Please verify the spelling or report it if suspicious.
                    </p>
                </div>

                <button
                    onClick={onScanAgain}
                    className="w-full rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}

function ErrorResult({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-(--color-surface-page) p-8 text-(--color-text-primary) border border-(--color-border-muted) shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-slate-400"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-surface-muted) text-(--color-text-secondary) shadow-inner">
                    <AlertCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-(--color-text-primary)">
                        Verification Failed
                    </h3>
                    <p className="font-medium text-(--color-text-secondary)">{message}</p>
                </div>

                <button
                    onClick={onRetry}
                    className="w-full rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}

function ResultActions({ onScanAgain, onShare }: { onScanAgain: () => void; onShare: () => void }) {
    return (
        <div className="no-print grid w-full grid-cols-1 gap-3">
            <button
                onClick={onScanAgain}
                className="w-full rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800"
            >
                Scan Another
            </button>
            <div className="grid grid-cols-2 gap-3">
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3.5 font-semibold text-(--color-text-primary) transition-all hover:bg-(--color-border-muted)"
                >
                    <Home size={18} />
                    <span>Home</span>
                </Link>
                <button
                    onClick={onShare}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-3.5 font-semibold text-(--color-text-primary) transition-all hover:bg-(--color-border-muted)"
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
    const [ocrText, setOcrText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
    const [parsedBrand, setParsedBrand] = useState<string>("");
    const [parsedBatch, setParsedBatch] = useState<string>("");
    const [parsedExpiry, setParsedExpiry] = useState<string>("");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [ocrStatus, setOcrStatus] = useState<
        "idle" | "scanning-barcode" | "extracting-text" | "done" | "error"
    >("idle");
    const [ocrProgress, setOcrProgress] = useState(0);

    const ocrWorkerRef = useRef<Tesseract.Worker | null>(null);
    const ocrCancelledRef = useRef(false);

    useEffect(() => {
        return () => {
            ocrCancelledRef.current = true;
            if (ocrWorkerRef.current) {
                ocrWorkerRef.current.terminate();
                ocrWorkerRef.current = null;
            }
        };
    }, []);

    // LASA Check State
    const [lasaMatches, setLasaMatches] = useState<LasaMatch[]>([]);
    const [showLasaConfirmation, setShowLasaConfirmation] = useState(false);
    const [pendingVerifyResult, setPendingVerifyResult] = useState<VerifyResult | null>(null);

    const processVerificationResult = async (result: VerifyResult, fallbackBrandName?: string) => {
        if (!result.verified) {
            setVerifyResult(result);
            return;
        }
        try {
            const medicineName = result.medicine.brand_name || fallbackBrandName;
            if (!medicineName) {
                setVerifyResult(result);
                return;
            }
            const lasaRes = await checkLasaConflicts(medicineName);
            if (lasaRes.hasConflicts && lasaRes.matches.length > 0) {
                setLasaMatches(lasaRes.matches);
                setPendingVerifyResult(result);
                setShowLasaConfirmation(true);
            } else {
                setVerifyResult(result);
            }
        } catch (error) {
            console.error("LASA check error:", error);
            setVerifyResult(result);
        }
    };

    const handleConfirmScanned = () => {
        if (pendingVerifyResult) {
            setVerifyResult(pendingVerifyResult);
            setShowLasaConfirmation(false);
            setPendingVerifyResult(null);
        }
    };

    const handleSelectConflict = async (conflictName: string) => {
        setShowLasaConfirmation(false);
        setPendingVerifyResult(null);
        setIsScanning(true);
        setShowResult(false);

        try {
            const brandRes = await verifyMedicineByBrand(conflictName);
            setParsedBrand(conflictName);
            await processVerificationResult(brandRes, conflictName);
        } catch (err) {
            setVerifyError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setIsScanning(false);
            setShowResult(true);
        }
    };

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
            await processVerificationResult(result);
        } catch (err) {
            setVerifyError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setIsScanning(false);
            setShowResult(true);
        }
    }, []);

    const handleCopyMedicineDetails = useCallback(async () => {
        if (!verifyResult?.verified) return;

        const details = formatMedicineDetails(verifyResult.medicine);
        const showCopied = () => {
            setCopied(true);
            toast.success("Medicine details copied!");
            setTimeout(() => setCopied(false), 2000);
        };

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error("Clipboard API unavailable");
            }
            await navigator.clipboard.writeText(details);
            showCopied();
        } catch {
            const textArea = document.createElement("textarea");
            textArea.value = details;
            textArea.setAttribute("readonly", "");
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();
            const copiedWithFallback = document.execCommand("copy");
            document.body.removeChild(textArea);
            if (copiedWithFallback) {
                showCopied();
            } else {
                toast.error("Unable to copy medicine details");
            }
        }
    }, [verifyResult]);

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast.error("File exceeds 10MB limit");
            e.target.value = "";
            return;
        }

        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        setUploadedImage(dataUrl);
        e.target.value = "";

        setIsScanning(true);
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
        setOcrText(null);
        setOcrConfidence(null);
        setParsedBrand("");
        setParsedBatch("");
        setParsedExpiry("");

        ocrCancelledRef.current = false;

        try {
            // ── Step 1: Try ZXing barcode decode from uploaded image ──────────
            setOcrStatus("scanning-barcode");
            let barcodeFound = false;

            try {
                const { BrowserMultiFormatReader } = await import("@zxing/browser");
                const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

                const hints = new Map();
                hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                    BarcodeFormat.CODE_128,
                    BarcodeFormat.QR_CODE,
                    BarcodeFormat.EAN_13,
                    BarcodeFormat.EAN_8,
                    BarcodeFormat.CODE_39,
                    BarcodeFormat.DATA_MATRIX,
                ]);
                hints.set(DecodeHintType.TRY_HARDER, true);

                const reader = new BrowserMultiFormatReader(hints);
                const zxingResult = await reader.decodeFromImageUrl(dataUrl);
                const barcodeText = zxingResult.getText().trim();
                if (barcodeText) {
                    barcodeFound = true;
                    setBatchInput(barcodeText);
                    setOcrStatus("done");
                    toast.success(`Barcode detected: ${barcodeText} — verifying…`);
                    await handleVerify(barcodeText);
                    return;
                }
            } catch {
                // ZXing failed — continue to OCR fallback
            }

            if (barcodeFound || ocrCancelledRef.current) return;

            // ── Step 2: Tesseract.js OCR Fallback ────────────────────────────
            setOcrStatus("extracting-text");
            setOcrProgress(0);

            if (!ocrWorkerRef.current) {
                ocrWorkerRef.current = await Tesseract.createWorker("eng", 1, {
                    logger: (m: { status: string; progress: number }) => {
                        if (m.status === "recognizing text") {
                            setOcrProgress(Math.round(m.progress * 100));
                        }
                    },
                });
            }

            if (ocrCancelledRef.current) return;

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("OCR timed out")), 30000);
            });

            const ocrPromise = ocrWorkerRef.current.recognize(dataUrl);
            const { data } = await Promise.race([ocrPromise, timeoutPromise]);

            if (ocrCancelledRef.current) return;

            const rawText = data.text;
            if (!rawText || !rawText.trim()) {
                toast.warning("No clear text found in image.");
                setVerifyError(
                    "Failed to read medicine text. Please ensure the image is clear or upload another one."
                );
                setOcrStatus("error");
                setShowResult(true);
                setIsScanning(false);
                return;
            }

            setOcrText(rawText);
            setOcrConfidence(data.confidence / 100);
            setOcrStatus("done");
            toast.success("OCR extraction complete!");

            // Parse OCR Text using utility regex
            const parsedBatchNum = extractBatchNumber(rawText);
            const parsedExpiryStr = extractExpiryDate(rawText);
            const medName = extractMedicineName(rawText);

            if (parsedBatchNum) setParsedBatch(parsedBatchNum);
            if (parsedExpiryStr) setParsedExpiry(parsedExpiryStr);
            if (medName) setParsedBrand(medName);

            if (parsedBatchNum) {
                setBatchInput(parsedBatchNum);
            }

            // Database Lookup Strategy
            let finalResult: VerifyResult | null = null;

            if (parsedBatchNum) {
                try {
                    const batchRes = await verifyMedicine(parsedBatchNum);
                    if (batchRes.verified) {
                        finalResult = batchRes;
                    }
                } catch {
                    // Silent fallback
                }
            }

            if (!finalResult && medName) {
                try {
                    const matchRes = await fuzzyMatchBrand(medName);
                    if (matchRes && matchRes.length > 0) {
                        const topMatch = matchRes[0];
                        if (topMatch.score >= 60) {
                            setParsedBrand(topMatch.name);
                            const brandRes = await verifyMedicineByBrand(topMatch.name);
                            if (brandRes.verified) {
                                finalResult = brandRes;
                            }
                        }
                    }
                } catch {
                    // Silent fallback
                }
            }

            if (finalResult && finalResult.verified) {
                const updatedMedicine = { ...finalResult.medicine };
                if (parsedBatchNum) {
                    updatedMedicine.batch_number = parsedBatchNum;
                }
                if (parsedExpiryStr) {
                    updatedMedicine.expiry_date = expiryToIso(parsedExpiryStr);
                }
                await processVerificationResult(
                    { verified: true, medicine: updatedMedicine },
                    parsedBrand
                );
            } else {
                setVerifyResult(
                    finalResult || {
                        verified: false,
                        message: "No match found in CDSCO Database",
                    }
                );
            }
        } catch (err) {
            if (ocrCancelledRef.current) return;

            if (ocrWorkerRef.current) {
                await ocrWorkerRef.current.terminate();
                ocrWorkerRef.current = null;
            }

            const errorMsg = err instanceof Error ? err.message : String(err);
            if (errorMsg === "OCR timed out") {
                toast.error("OCR timed out. Please try again with a clearer image.");
                setVerifyError(
                    "The scan took too long. Please ensure the image is clear and try again."
                );
            } else {
                toast.error("Failed to extract text from image.");
                setVerifyError(
                    "Unable to read text from this image. Please try a clearer photo or enter the batch number manually."
                );
            }
            setOcrStatus("error");
        } finally {
            if (!ocrCancelledRef.current) {
                setIsScanning(false);
                setShowResult(true);
            }
        }
    };

    /** Handles a barcode scanned via the live camera scanner. */
    const handleBarcodeScan = useCallback(
        (barcodeText: string) => {
            setBatchInput(barcodeText);
            setIsCameraActive(false);
            toast.success(`Barcode detected: ${barcodeText} — verifying…`);
            handleVerify(barcodeText);
        },
        [handleVerify]
    );

    const handleScanAgain = async () => {
        if (ocrWorkerRef.current) {
            await ocrWorkerRef.current.terminate();
            ocrWorkerRef.current = null;
        }
        ocrCancelledRef.current = true;
        setIsScanning(false);
        setShowResult(false);
        setUploadedImage(null);
        setVerifyResult(null);
        setVerifyError(null);
        setBatchInput("");
        setOcrText(null);
        setOcrConfidence(null);
        setParsedBrand("");
        setParsedBatch("");
        setParsedExpiry("");
        setIsCameraActive(false);
        setOcrStatus("idle");
        setOcrProgress(0);
    };

    const handleDismissResult = async () => {
        if (ocrStatus === "error" && ocrWorkerRef.current) {
            await ocrWorkerRef.current.terminate();
            ocrWorkerRef.current = null;
        }
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
        setParsedBrand("");
        setParsedBatch("");
        setParsedExpiry("");
        setOcrStatus("idle");
        setOcrProgress(0);
    };

    const handleShare = async () => {
        let shareText = "";
        if (verifyResult?.verified) {
            shareText = formatMedicineDetails(verifyResult.medicine);
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
        <div className="relative flex min-h-screen flex-col overflow-x-clip bg-black font-sans text-white">
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

            <div className="relative flex flex-1 items-center justify-center">
                <div className="absolute inset-0 overflow-hidden bg-slate-900">
                    {isCameraActive ? (
                        <BarcodeScanner onScan={handleBarcodeScan} debounceMs={2500} />
                    ) : uploadedImage ? (
                        <LazyImage
                            src={uploadedImage}
                            alt="Uploaded"
                            wrapperClassName="h-full w-full"
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

                {isScanning && <LoadingSkeleton ocrStatus={ocrStatus} ocrProgress={ocrProgress} />}

                {showResult && (
                    <div className="animate-in fade-in zoom-in absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm duration-300">
                        {showLasaConfirmation ? (
                            <LasaConfirmation
                                scannedName={
                                    pendingVerifyResult?.verified
                                        ? pendingVerifyResult.medicine.brand_name
                                        : parsedBrand
                                }
                                matches={lasaMatches}
                                onConfirmScanned={handleConfirmScanned}
                                onSelectConflict={handleSelectConflict}
                            />
                        ) : (
                            <>
                                <button
                                    onClick={handleDismissResult}
                                    className="absolute top-4 right-4 z-40 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                                >
                                    <X size={24} />
                                </button>
                                {verifyError && (
                                    <ErrorResult
                                        message={verifyError}
                                        onRetry={handleDismissResult}
                                    />
                                )}
                                {!verifyError &&
                                    verifyResult?.verified &&
                                    verifyResult.medicine.is_counterfeit_alert && (
                                        <CounterfeitAlertResult
                                            medicine={verifyResult.medicine}
                                            onScanAgain={handleScanAgain}
                                            onShare={handleShare}
                                            onCopyMedicineDetails={handleCopyMedicineDetails}
                                            copied={copied}
                                        />
                                    )}
                                {!verifyError &&
                                    verifyResult?.verified &&
                                    !verifyResult.medicine.is_counterfeit_alert && (
                                        <VerifiedSafeResult
                                            medicine={verifyResult.medicine}
                                            onScanAgain={handleScanAgain}
                                            onShare={handleShare}
                                            onCopyMedicineDetails={handleCopyMedicineDetails}
                                            copied={copied}
                                        />
                                    )}
                                {!verifyError && verifyResult && !verifyResult.verified && (
                                    <UnverifiedResult
                                        brandName={parsedBrand}
                                        batchNumber={parsedBatch}
                                        expiryDate={parsedExpiry}
                                        onScanAgain={handleDismissResult}
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {ocrText && (
                <div className="mx-auto my-4 w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-4 text-xs backdrop-blur-md">
                    <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="font-bold text-emerald-400">OCR Extracted Text</span>
                        {ocrConfidence !== null && (
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-emerald-300">
                                Confidence: {Math.round(ocrConfidence * 100)}%
                            </span>
                        )}
                    </div>
                    {batchInput && (
                        <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5">
                            <span className="text-emerald-400">Batch detected:</span>
                            <span className="font-mono font-bold text-emerald-300">
                                {batchInput}
                            </span>
                        </div>
                    )}
                    <pre className="max-h-32 overflow-y-auto font-mono whitespace-pre-wrap text-slate-300">
                        {ocrText}
                    </pre>
                </div>
            )}

            <div className="flex flex-col items-center gap-6 bg-linear-to-t from-black to-transparent p-8">
                <form
                    onSubmit={handleBatchSubmit}
                    className="flex w-full max-w-sm flex-col gap-3 sm:flex-row"
                >
                    <input
                        type="text"
                        value={batchInput}
                        onChange={(e) => setBatchInput(e.target.value)}
                        placeholder="Enter batch number"
                        className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white placeholder-white/40 focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isScanning}
                        className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <button
                        onClick={() => setIsCameraActive((prev) => !prev)}
                        className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none ${
                            isCameraActive
                                ? "bg-red-500 text-white hover:bg-red-400"
                                : "bg-emerald-500 text-white hover:bg-emerald-400"
                        }`}
                    >
                        <ScanLine size={18} />
                        {isCameraActive ? "Stop Scanner" : "Scan Barcode"}
                    </button>
                    <label
                        htmlFor="medicine-upload"
                        className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-slate-200"
                    >
                        <Layers size={18} />
                        Upload Photo
                    </label>
                </div>
            </div>
        </div>
    );
}
