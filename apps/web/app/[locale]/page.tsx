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
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
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

export default function SahiDawaHome() {
    const router = useRouter();
    const params = useParams();
    // const locale = params.locale;
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale;
    const tHome = useTranslations("Home");
    const tNav = useTranslations("Navigation");

    const [homepageAlerts, setHomepageAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const { data, error } = await supabase
                    .from("medicines")
                    .select("*")
                    .or(
                        "is_counterfeit_alert.eq.true,cdsco_approval_status.eq.recalled,cdsco_approval_status.eq.banned, brand_name.eq.SYSTEM_UPDATE"
                    )
                    .order("created_at", { ascending: false })
                    .limit(4);

                if (data) {
                    setHomepageAlerts(data);
                }
            } catch (err) {
                console.error("Failed to query alerts matrix:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
    }, []);

    const handleNavigation = (path: string) => {
        router.push(`/${locale}/${path}`);
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
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
                <Skeleton className="absolute top-0 right-0 left-0 h-2 rounded-none bg-emerald-500" />
                <div className="flex flex-col items-center space-y-4 text-center">
                    <Skeleton className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                        <ShieldCheck size={40} className="text-slate-200" />
                    </Skeleton>
                    <div className="w-full space-y-2">
                        <Skeleton className="mx-auto h-7 w-3/4 rounded-lg bg-slate-100" />
                        <Skeleton className="mx-auto h-4 w-1/2 rounded-lg bg-slate-100" />
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <Skeleton className="mx-auto h-3 w-3/4 rounded bg-slate-200" />
                            <Skeleton className="mx-auto h-5 w-1/2 rounded bg-slate-200" />
                        </div>
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <Skeleton className="mx-auto h-3 w-3/4 rounded bg-slate-200" />
                            <Skeleton className="mx-auto h-5 w-1/2 rounded bg-slate-200" />
                        </div>
                    </div>
                    <div className="w-full space-y-2 rounded-2xl border border-emerald-100/50 bg-emerald-50/50 p-4">
                        <Skeleton className="h-3 w-full rounded bg-emerald-200/50" />
                        <Skeleton className="h-3 w-5/6 rounded bg-emerald-200/50" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-2xl bg-slate-100" />
                    <Skeleton className="mx-auto h-4 w-24 rounded bg-slate-100" />
                </div>
                <div className="mt-4 animate-pulse text-center text-sm font-medium text-slate-400">
                    {message}
                </div>
                {ocrStatus === "extracting-text" && (
                    <div className="mx-auto mt-3 h-1.5 w-3/4 overflow-hidden rounded-full bg-slate-200">
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
// Result views with dark/light mode surface tokens and variables support
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
                                onClick={onCopyMedicineDetails}
                                aria-label="Copy medicine details"
                                title="Copy medicine details"
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
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-red-700">{medicine.batch_number}</span>
                            <button
                                onClick={onCopyMedicineDetails}
                                aria-label="Copy medicine details"
                                title="Copy medicine details"
                                className={`shrink-0 rounded-lg p-1.5 transition-all duration-200 ${
                                    copied
                                        ? "bg-red-100 text-red-600"
                                        : "bg-red-200/60 text-red-400 hover:bg-red-200 hover:text-red-600"
                                }`}
                            >
                                {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                            </button>
                        </div>
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
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 text-slate-900 shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-amber-500"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                    <XCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-amber-700">
                        {brandName || "Unverified Medicine"}
                    </h3>
                    <p className="font-medium text-slate-500">No match found in CDSCO Database</p>
                </div>
                {(batchNumber || expiryDate) && (
                    <div className="grid w-full grid-cols-2 gap-3 pt-2">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                Batch No.
                            </span>
                            <span className="font-bold text-slate-700">
                                {batchNumber || "Unknown"}
                            </span>
                        </div>
                        <ExpiryBadge expiryDate={expiryDate} />
                    </div>
                )}
                <div className="flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
                    <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed font-medium text-amber-800">
                        No matching record was found for this medicine batch in the CDSCO database.
                        Please verify the spelling or report it if suspicious.
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
function ErrorResult({ message, onRetry, isOffline }: { message: string; onRetry: () => void; isOffline?: boolean }) {
    return (
        <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) p-8 text-(--color-text-primary) shadow-2xl">
            <div className="absolute top-0 right-0 left-0 h-2 bg-slate-400"></div>
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-inner">
                    <AlertCircle size={40} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight text-(--color-text-primary)">
                        {isOffline ? "Connection Lost" : "Verification Failed"}
                    </h3>
                    <p className="font-medium text-slate-500 text-sm whitespace-pre-wrap">{message}</p>
                </div>
                <button
                    onClick={onRetry}
                    disabled={isOffline}
                    className="w-full rounded-2xl bg-slate-900 py-4 font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isOffline ? "Waiting for connection..." : "Try Again"}
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
    const { isOffline, registerRetryCallback, unregisterRetryCallback } = useOfflineStatus();
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
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
    // Auto-retry when coming back online
    const handleVerifyRef = useRef<(batch: string) => Promise<void>>(null as any);
    useEffect(() => {
        isMountedRef.current = true;
        
        const autoRetry = () => {
            if (isMountedRef.current && showResult && verifyError && batchInput) {
                toast.info("Connection restored. Retrying verification...");
                handleVerifyRef.current?.(batchInput);
            }
        };
        registerRetryCallback(autoRetry);
        return () => {
            isMountedRef.current = false;
            ocrCancelledRef.current = true;
            if (ocrWorkerRef.current) {
                ocrWorkerRef.current.terminate();
                ocrWorkerRef.current = null;
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            unregisterRetryCallback(autoRetry);
        };
    }, [showResult, verifyError, batchInput, registerRetryCallback, unregisterRetryCallback]);
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
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsScanning(true);
        setShowResult(false);
        try {
            const brandRes = await verifyMedicineByBrand(conflictName, controller.signal);
            if (!isMountedRef.current || controller.signal.aborted) return;
            setParsedBrand(conflictName);
            await processVerificationResult(brandRes, conflictName);
        } catch (err) {
            if (!isMountedRef.current || controller.signal.aborted) return;
            const errorMsg = err instanceof Error ? err.message : "Verification failed";
            if (errorMsg === "Request was cancelled.") {
                return;
            }
            setVerifyError(errorMsg);
            setShowResult(true);
        } finally {
            if (isMountedRef.current && !controller.signal.aborted) {
                setIsScanning(false);
            }
        }
    };
    const handleVerify = useCallback(async (batch: string) => {
        if (!batch.trim()) {
            toast.error("Please enter a batch number to verify");
            return;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsScanning(true);
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
        try {
            const result = await verifyMedicine(batch.trim(), controller.signal);
            if (!isMountedRef.current || controller.signal.aborted) return;
            await processVerificationResult(result);
        } catch (err) {
            if (!isMountedRef.current || controller.signal.aborted) return;
            const errorMsg = err instanceof Error ? err.message : "Verification failed";
            if (errorMsg === "Request was cancelled.") {
                return;
            }
            setVerifyError(errorMsg);
            setShowResult(true);
        } finally {
            if (isMountedRef.current && !controller.signal.aborted) {
                setIsScanning(false);
            }
        }
    }, [processVerificationResult]);
    // Keep handleVerifyRef current
    useEffect(() => {
        handleVerifyRef.current = handleVerify;
    }, [handleVerify]);
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
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
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
                    if (!isMountedRef.current || controller.signal.aborted) return;
                    setBatchInput(barcodeText);
                    setOcrStatus("done");
                    toast.success(`Barcode detected: ${barcodeText} — verifying…`);
                    await handleVerify(barcodeText);
                    return;
                }
            } catch {
                // ZXing failed — continue to OCR fallback
            }
            if (!isMountedRef.current || controller.signal.aborted) return;
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
            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current) return;
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("OCR timed out")), 30000);
            });
            const ocrPromise = ocrWorkerRef.current.recognize(dataUrl);
            const { data } = await Promise.race([ocrPromise, timeoutPromise]);
            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current) return;
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
                    const batchRes = await verifyMedicine(parsedBatchNum, controller.signal);
                    if (batchRes.verified) {
                        finalResult = batchRes;
                    }
                } catch {
                    // Silent fallback
                }
            }
            if (!isMountedRef.current || controller.signal.aborted) return;
            if (!finalResult && medName) {
                try {
                    const matchRes = await fuzzyMatchBrand(medName, controller.signal);
                    if (matchRes && matchRes.length > 0) {
                        const topMatch = matchRes[0];
                        if (topMatch.score >= 60) {
                            setParsedBrand(topMatch.name);
                            const brandRes = await verifyMedicineByBrand(topMatch.name, controller.signal);
                            if (brandRes.verified) {
                                finalResult = brandRes;
                            }
                        }
                    }
                } catch {
                    // Silent fallback
                }
            }
            if (!isMountedRef.current || controller.signal.aborted) return;
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
            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current) return;
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
            if (isMountedRef.current && !controller.signal.aborted && !ocrCancelledRef.current) {
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
                                        onRetry={() => handleVerify(batchInput)}
                                        isOffline={isOffline}
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
                        disabled={isScanning || isOffline}
                        className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Search size={18} />
                        {isOffline ? "Offline" : "Verify"}
                    </button>
                </form>
                <p className="max-w-xs text-center text-sm font-medium text-slate-400">
                    Enter the batch number from the medicine strip, or upload a photo from your
                    gallery.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsCameraActive((prev) => !prev)}
                        disabled={isOffline}
                        className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                            isCameraActive
                                ? "bg-red-500 text-white hover:bg-red-400"
                                : "bg-emerald-500 text-white hover:bg-emerald-400"
                        }`}
                    >
                        <ScanLine size={18} />
                        {isCameraActive ? "Stop Scanner" : "Scan Barcode"}
                    </button>
                    <label
                        htmlFor={isOffline ? undefined : "medicine-upload"}
                        onClick={(e) => {
                            if (isOffline) {
                                e.preventDefault();
                                toast.error("You are currently offline. Please check your internet connection.");
                            }
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-slate-200 ${
                            isOffline ? "cursor-not-allowed opacity-50" : ""
                        }`}
                    >
                        <Layers size={18} />
                        Upload Photo
                    </label>
                </div>
            </div>
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-200">
            {/* ── Top Navigation ── */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-lg">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm sm:h-10 sm:w-10"
                            aria-label="SahiDawa Logo"
                        >
                            <img
                                src="/favicon.ico"
                                alt=""
                                aria-hidden="true"
                                className="h-7 w-7 object-contain"
                                width={28}
                                height={28}
                            />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-800 md:text-2xl">
                            SahiDawa
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex"
                            aria-label="Main navigation"
                        >
                            <Link
                                href="/how-it-works"
                                className="transition-colors hover:text-emerald-600"
                            >
                                {tNav("how_it_works")}
                            </Link> */}

                        <nav
                            className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex"
                            aria-label="Main navigation"
                        >
                            <Link
                                href="/how-it-works"
                                className={desktopNavLinkClassName}
                            >
                                {tNav("how_it_works")}
                            </Link>
                            <Link
                                href="/alerts"
                                className={desktopNavLinkClassName}
                            >
                                {tNav("alerts")}
                            </Link>
                            <Link href="/map" className={desktopNavLinkClassName}>
                                {tNav("pharmacy_map")}
                            </Link>
                            <Link
                                href="/reports/me"
                                className={`${desktopNavLinkClassName} flex items-center gap-1`}
                            >
                                <History size={14} /> My Reports
                            </Link>
                        </nav>

                        <button
                            onClick={() => handleNavigation("health")}
                            className="flex h-9 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 sm:h-10 sm:px-4 sm:py-2"
                            aria-label="Open AI Health Assistant"
                        >
                            <MessageCircle size={16} />
                            <span className="hidden sm:inline">AI Health Assistant</span>
                            <span className="whitespace-nowrap sm:hidden">AI Chat</span>
                        </button>

                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="container mx-auto max-w-6xl px-4 pt-8 pb-24 md:pb-12">
                {/* Hero */}
                <div className="space-y-6 py-12 text-center md:py-20">
                    <div className="animate-in fade-in slide-in-from-bottom-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 duration-700">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        GSSoC 2026 Open Source Project
                    </div>
                    <h2 className="text-4xl leading-[1.1] font-black tracking-tight text-slate-900 md:text-6xl">
                        {tHome("title")}
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
                        {tHome("subtitle")}
                    </p>
                </div>

                {/* ── Primary CTA — Full-width Scan Button ── */}
                <button
                    onClick={() => handleNavigation("scan")}
                    className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-emerald-500 bg-emerald-600 p-7 text-left text-white shadow-xl shadow-emerald-600/20 transition-all hover:shadow-emerald-600/40 active:scale-[0.99] md:p-8"
                    aria-label="Scan medicine"
                >
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-700 to-emerald-500"></div>
                    <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 md:h-20 md:w-20">
                            <Camera
                                className="h-8 w-8 text-white drop-shadow-md md:h-10 md:w-10"
                                strokeWidth={2}
                            />
                        </div>
                        <div>
                            <span className="block text-2xl font-bold tracking-wide drop-shadow-sm md:text-3xl">
                                {tHome("scan_button")}
                            </span>
                            <span className="mt-1 block text-sm font-medium text-emerald-100 opacity-90 md:text-base">
                                {tHome("scan_subtitle")}
                            </span>
                        </div>
                    </div>
                    <ChevronRight
                        size={32}
                        className="relative z-10 hidden shrink-0 text-emerald-200 opacity-50 transition-all group-hover:translate-x-2 group-hover:opacity-100 sm:block"
                    />
                </button>

                {/* ── Secondary Action Cards ── */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {/* Upload Photo */}
                    <button
                        onClick={() => handleNavigation("scan")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/50 active:scale-[0.99]"
                        aria-label="Upload photo"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-emerald-500 group-hover:text-white">
                                <Camera size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-800">
                                {tHome("upload_photo")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                {tHome("upload_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Voice Triage */}
                    <button
                        onClick={() => handleNavigation("voice")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50 active:scale-[0.99]"
                        aria-label="Voice triage"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-blue-500 group-hover:text-white">
                                <Mic size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-800">
                                {tHome("voice_triage")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                {tHome("voice_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Pharmacy Map */}
                    <button
                        onClick={() => handleNavigation("map")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-100/50 active:scale-[0.99]"
                        aria-label="Pharmacy map"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-amber-500 group-hover:text-white">
                                <MapPin size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-800">
                                {tHome("pharmacy_map")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                {tHome("pharmacy_subtitle")}
                            </p>
                        </div>
                    </button>

                    {/* Report Fake Medicine */}
                    <button
                        onClick={() => handleNavigation("report")}
                        className="group flex min-h-[170px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-red-100/50 active:scale-[0.99]"
                        aria-label="Report fake medicine"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-white/60 transition-colors duration-300 ring-inset group-hover:bg-red-500 group-hover:text-white">
                                <AlertTriangle size={28} strokeWidth={2.5} />
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-400" />
                        </div>

                        <div className="pt-4">
                            <h3 className="text-lg font-bold tracking-tight text-slate-800">
                                {tHome("report_fake")}
                            </h3>
                            <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                {tHome("report_fake_subtitle")}
                            </p>
                        </div>
                    </button>
                </div>

                {/* ── AI Health Assistant CTA Banner ── */}
                <div className="group relative mt-8 overflow-hidden rounded-3xl border border-purple-200/60 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100/80 p-6 shadow-md shadow-purple-100/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-200/40 sm:p-8 md:p-10">
                    {/* Decorative background orbs */}
                    <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                    {/* Center glow */}
                    <div className="pointer-events-none absolute top-1/2 left-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/30 blur-3xl" />

                    <div className="relative z-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <div className="flex items-center gap-4 sm:gap-5">
                            {/* Icon container */}
                            <div className="flex h-14 w-14 shrink-0 -translate-y-9 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-purple-500/35 sm:h-16 sm:w-16 sm:-translate-y-0">
                                <MessageCircle size={28} className="text-white drop-shadow-sm" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl">
                                        AI Health Assistant
                                    </h3>
                                    {/* Animated AI badge */}
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider whitespace-nowrap text-purple-700 uppercase ring-1 ring-purple-200/60">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-60" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-600" />
                                        </span>
                                        Live AI
                                    </span>
                                </div>
                                <p className="text-sm leading-relaxed font-medium text-slate-500 sm:text-base">
                                    Get instant health advice, symptom checking &amp; prescription
                                    guidance
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleNavigation("health")}
                            className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-md shadow-purple-500/25 transition-all duration-300 hover:scale-[1.04] hover:shadow-xl hover:shadow-purple-500/30 active:scale-[0.98] sm:w-auto"
                        >
                            <MessageCircle size={18} />
                            Chat Now
                            <ChevronRight
                                size={18}
                                className="transition-transform duration-200 group-hover/btn:translate-x-1"
                            />
                        </button>
                    </div>
                </div>

                {/* ── Global Search ── */}
                <SearchBar />

                {/* ── Live Alerts Panel (full-width) ── */}
                <div className="mt-8 mb-20">
                    <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-5">
                            <div className="flex items-center gap-2">
                                <Activity size={20} className="text-red-500" />
                                <h3 className="text-lg font-bold text-slate-800">
                                    Live CDSCO Alerts
                                </h3>
                            </div>
                            <span className="hidden rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold tracking-wider text-red-600 uppercase sm:block">
                                India Region
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {loading ? (
                                    <>
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                                            >
                                                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-slate-200" />
                                                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <Skeleton className="h-4 w-1/2" />
                                                        <Skeleton className="h-3 w-12" />
                                                    </div>
                                                    <Skeleton className="h-3 w-3/4" />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : homepageAlerts && homepageAlerts.length > 0 ? (
                                    homepageAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                        >
                                            {/* Left edge colored strip */}
                                            <div
                                                className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-500"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-red-500"
                                                          : "bg-orange-400"
                                                }`}
                                            />

                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                    alert.brand_name === "SYSTEM_UPDATE"
                                                        ? "bg-blue-50 text-blue-500 group-hover:bg-blue-100"
                                                        : alert.cdsco_approval_status ===
                                                                "banned" ||
                                                            alert.is_counterfeit_alert
                                                          ? "bg-red-50 text-red-500 group-hover:bg-red-100"
                                                          : "bg-orange-50 text-orange-500 group-hover:bg-orange-100"
                                                }`}
                                            >
                                                {alert.brand_name === "SYSTEM_UPDATE" ? (
                                                    <Globe size={20} strokeWidth={2.5} />
                                                ) : (
                                                    <AlertTriangle size={20} strokeWidth={2.5} />
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <h4 className="leading-tight font-bold text-slate-800">
                                                        {alert.brand_name}
                                                    </h4>
                                                    <span className="text-[11px] font-medium text-slate-400">
                                                        {formatRelativeTime(alert.created_at)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm leading-snug font-medium text-slate-500">
                                                    {alert.composition} Batch{" "}
                                                    <span className="font-bold text-slate-700">
                                                        {alert.batch_number}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    /* ── Improved Empty State ── */
                                    <div className="sm:col-span-2">
                                        <EmptyState
                                            icon={
                                                <ShieldCheck
                                                    size={26}
                                                    strokeWidth={2}
                                                    className="text-emerald-500"
                                                />
                                            }
                                            title="All clear!"
                                            description="No active regulatory alerts right now. Stay safe and verify your medicines."
                                            className="border-none !bg-transparent p-6"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── View Full Alert Log CTA ── */}
                        <div className="border-t border-slate-100 bg-white p-4">
                            <Link href="/alerts" className="block w-full">
                                <button className="group/log flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 font-bold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm">
                                    <Activity
                                        size={15}
                                        className="text-slate-400 transition-colors duration-200 group-hover/log:text-red-500"
                                    />
                                    View Full Alert Log
                                    <ChevronRight
                                        size={16}
                                        className="text-slate-400 transition-transform duration-200 group-hover/log:translate-x-1"
                                    />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Spacer for mobile nav */}
            <div className="h-16 md:hidden"></div>

            {/* ── Mobile Bottom Navigation ── */}
            <nav
                className="fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t border-slate-200/60 bg-white/90 px-2 py-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
                aria-label="Mobile navigation"
            >
                <Link
                    href="/"
                    className="group flex w-16 flex-col items-center gap-1.5"
                    aria-label="Home"
                >
                    <div className="text-emerald-600 transition-transform group-hover:-translate-y-1">
                        <Home size={24} strokeWidth={2.5} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-bold text-emerald-600`}>
                        Home
                    </span>
                </Link>

                <Link
                    href="/scan"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label="Scans"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <History size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Scans
                    </span>
                </Link>

                <Link
                    href="/map"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-amber-600"
                    aria-label="Map"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <MapPin size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Map
                    </span>
                </Link>

                <Link
                    href="/alerts"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-red-500"
                    aria-label="Alerts"
                >
                    <div className="relative transition-transform group-hover:-translate-y-1">
                        <Bell size={24} strokeWidth={2} />
                        <span className="absolute top-0 right-0.5 h-2 w-2 animate-pulse rounded-full border border-white bg-red-500"></span>
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Alerts
                    </span>
                </Link>

                <Link
                    href="/profile"
                    className="group flex w-16 flex-col items-center gap-1.5 text-slate-400 transition-colors hover:text-emerald-600"
                    aria-label="Profile"
                >
                    <div className="transition-transform group-hover:-translate-y-1">
                        <User size={24} strokeWidth={2} />
                    </div>
                    <span className={`${mobileNavLabelClassName} text-[11px] font-semibold`}>
                        Profile
                    </span>
                </Link>
            </nav>
        </div>
    );
}
