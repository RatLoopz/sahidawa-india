"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SkeletonLoader } from "@/components/scanner/SkeletonLoader";
import { uploadABHAVerification } from "@/lib/api/abha";
import { Camera, Layers, Search, X, ScanLine, History } from "lucide-react";
import { useMedicineVerification } from "@/hooks/useMedicineVerification";
import { VerifiedSafeResult } from "@/components/scanner/results/VerifiedSafeResult";
import { CounterfeitAlertResult } from "@/components/scanner/results/CounterfeitAlertResult";
import { UnverifiedResult } from "@/components/scanner/results/UnverifiedResult";
import { ErrorResult } from "@/components/scanner/results/ErrorResult";
import { formatExpiryForBadge } from "@/lib/medicineDateUtils";
import { useMedicineImageUpload } from "@/hooks/useMedicineImageUpload";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import { toast } from "sonner";
import { verifyMedicineByBrand, type VerifiedMedicine } from "@/lib/api";
import LasaConfirmation from "@/components/scanner/LasaConfirmation";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import LazyImage from "@/components/LazyImage";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineScanner } from "@/hooks/useOfflineScanner";
import { usePendingScanQueue } from "@/hooks/usePendingScanQueue";
import { PendingScanQueue } from "@/components/scanner/PendingScanQueue";
import { useTranslations } from "next-intl";
import { buildVerificationShareText, type VerificationShareCopy } from "@/lib/verificationShare";
import { saveScanHistory } from "@/lib/db/scanHistory";
import { recordScanHistory } from "@/lib/scanHistoryUtils";

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

async function copyTextToClipboard(text: string) {
    try {
        if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        return copied;
    }
}

export default function ScanPage() {
    const tScan = useTranslations("Scan");
    const { queueBarcode } = useOfflineScanner();
    const { pending, isSyncing, refresh } = usePendingScanQueue();
    // Add these near the top of your component, inside the main function
    const [isVerifying, setIsVerifying] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const { isOffline, registerRetryCallback, unregisterRetryCallback } = useOfflineStatus();
    const abortControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
    const [isScanning, setIsScanning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [batchInput, setBatchInput] = useState("");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [showResult, setShowResult] = useState(false);

    const {
        verifyResult,
        verifyError,
        lasaMatches,
        showLasaConfirmation,
        pendingVerifyResult,
        setVerifyResult,
        setVerifyError,
        setPendingVerifyResult,
        setShowLasaConfirmation,
        handleVerify,
        processVerificationResult,
    } = useMedicineVerification(abortControllerRef, isMountedRef, setIsScanning, setShowResult, {
        queueBarcode,
        onQueued: (barcode) => {
            setBatchInput(barcode);
            void refresh();
        },
    });
    const {
        uploadedImage,
        ocrText,
        ocrConfidence,
        parsedBrand,
        parsedBatch,
        parsedExpiry,
        handleFileUpload,
        reset,
    } = useMedicineImageUpload({
        handleVerify,
        processVerificationResult,
        setVerifyError,
        setShowResult,
        setBatchInput,
        setVerifyResult,
        setIsScanning,
    });

    const handleSaveToABHA = async () => {
        if (!verifyResult?.verified) return;

        try {
            await uploadABHAVerification({
                medicineId: "demo-medicine",
                verificationResult: verifyResult.medicine.is_counterfeit_alert
                    ? "counterfeit"
                    : "verified",
                scannedAt: new Date().toISOString(),
            });

            toast.success("Verification saved to ABHA");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save to ABHA");
        }
    };

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
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            unregisterRetryCallback(autoRetry);
        };
    }, [showResult, verifyError, batchInput, registerRetryCallback, unregisterRetryCallback]);

    const shareCopy: VerificationShareCopy = {
        realStatus: tScan("share.real_status"),
        suspiciousStatus: tScan("share.suspicious_status"),
        warningPrefix: tScan("share.warning_prefix"),
        verifiedBy: tScan("share.verified_by"),
        batchLabel: tScan("share.batch_label"),
        manufacturerLabel: tScan("share.manufacturer_label"),
        avoidAndReport: tScan("share.avoid_and_report"),
        verifyYourself: tScan("share.verify_yourself"),
        unknownMedicine: tScan("share.unknown_medicine"),
        unknownBatch: tScan("share.unknown_batch"),
        unknownManufacturer: tScan("share.unknown_manufacturer"),
    };

    const handleConfirmScanned = () => {
        if (pendingVerifyResult) {
            setVerifyResult(pendingVerifyResult);
            void recordScanHistory(pendingVerifyResult).catch((error) => {
                console.error("Failed to save scan history:", error);
            });
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
            await processVerificationResult(brandRes, conflictName);
        } catch (err) {
            if (!isMountedRef.current || controller.signal.aborted) return;
            const errorMsg = err instanceof Error ? err.message : "Verification failed";
            if (errorMsg === "Request was cancelled.") return;
            void saveScanHistory({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                medicineName: conflictName,
                status: "SUSPICIOUS",
            }).catch((error) => {
                console.error("Failed to save scan history:", error);
            });
            setVerifyError(errorMsg);
            setShowResult(true);
        } finally {
            if (isMountedRef.current && !controller.signal.aborted) {
                setIsScanning(false);
            }
        }
    };

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

        const copiedSuccessfully = await copyTextToClipboard(details);

        if (copiedSuccessfully) {
            showCopied();
        } else {
            toast.error("Unable to copy medicine details");
        }
    }, [verifyResult]);

    const handleBarcodeScan = useCallback(
        async (scannedText: string) => {
            setIsVerifying(true);
            setApiError(null);

            try {
                await handleVerify(scannedText);
            } catch (error: any) {
                setApiError(error.message || "Failed to verify medicine with CDSCO.");
            } finally {
                setIsVerifying(false);
            }
        },
        [handleVerify]
    );

    const handleScanAgain = () => {
        reset();
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
        setBatchInput("");
        setIsCameraActive(false);
    };

    const handleDismissResult = () => {
        reset();
        setShowResult(false);
        setVerifyResult(null);
        setVerifyError(null);
    };

    const handleShare = async () => {
        const shareText = buildVerificationShareText({
            result: verifyResult,
            batchNumber: batchInput || parsedBatch,
            brandName: parsedBrand,
            copy: shareCopy,
        });

        const shareData = {
            title: tScan("share.title"),
            text: shareText,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                toast.success(tScan("share.shared_success"));
            } else {
                const copiedToClipboard = await copyTextToClipboard(shareText);
                if (!copiedToClipboard) {
                    throw new Error("Clipboard copy failed");
                }
                toast.success(tScan("share.copy_success"));
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name !== "AbortError") {
                toast.error(tScan("share.failure"));
            }
        }
    };

    const handleBatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleVerify(batchInput);
    };

    return (
        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-x-clip bg-(--color-surface-page) font-sans text-(--color-text-primary)">
            <input
                type="file"
                id="medicine-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />

            <PageHeader
                title={tScan("scanMedicine")}
                subtitle={tScan("positionBarcode")}
                backHref="/"
                variant="light"
            />

            <div className="relative flex flex-1 items-center justify-center">
                <div className="absolute inset-0 overflow-hidden bg-slate-900">
                    {isCameraActive ? (
                        <BarcodeScanner
                            onScan={handleBarcodeScan}
                            debounceMs={2500}
                            isVerifying={isVerifying}
                            apiError={apiError}
                            onRetry={() => {
                                setApiError(null);
                                setIsCameraActive(false);
                            }}
                        />
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
                    <div className="absolute top-0 left-0 h-12 w-12 animate-pulse rounded-tl-2xl border-t-4 border-l-4 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>
                    <div className="absolute top-0 right-0 h-12 w-12 animate-pulse rounded-tr-2xl border-t-4 border-r-4 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>
                    <div className="absolute bottom-0 left-0 h-12 w-12 animate-pulse rounded-bl-2xl border-b-4 border-l-4 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>
                    <div className="absolute right-0 bottom-0 h-12 w-12 animate-pulse rounded-br-2xl border-r-4 border-b-4 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>

                    {isScanning && (
                        <div className="animate-scan absolute right-4 left-4 z-20 h-[2px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
                    )}

                    {!isScanning && !showResult && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Camera size={48} className="animate-pulse text-emerald-500/30" />
                        </div>
                    )}
                </div>

                {isScanning && <SkeletonLoader />}

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
                                    aria-label="Close verification result (Press Escape)"
                                    title="Close result (Esc)"
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                            handleDismissResult();
                                        }
                                    }}
                                >
                                    <X size={24} aria-hidden="true" />
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
                                            shareLabel={tScan("share.button")}
                                            copied={copied}
                                        />
                                    )}

                                {!verifyError &&
                                    verifyResult?.verified &&
                                    !verifyResult.medicine.is_counterfeit_alert && (
                                        <div className="flex w-full max-w-sm flex-col items-center gap-6">
                                            {verifyResult.batch_status && (
                                                <div
                                                    className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
                                                        verifyResult.batch_status === "safe"
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                            : verifyResult.batch_status ===
                                                                "recalled"
                                                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                    }`}
                                                >
                                                    {verifyResult.batch_status === "safe" &&
                                                        "Batch Safe"}
                                                    {verifyResult.batch_status === "recalled" &&
                                                        "Batch Recalled"}
                                                    {verifyResult.batch_status === "unknown" &&
                                                        "Batch Status Unknown"}
                                                </div>
                                            )}

                                            {verifyResult.batch_status === "recalled" && (
                                                <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                                                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                                                        This batch has been recalled
                                                    </p>
                                                    <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                                                        Please do not use this medicine. Return it
                                                        to your pharmacy immediately.
                                                    </p>
                                                </div>
                                            )}

                                            <VerifiedSafeResult
                                                medicine={verifyResult.medicine}
                                                scanMeta={verifyResult.scanMeta}
                                                onScanAgain={handleScanAgain}
                                                onShare={handleShare}
                                                shareLabel={tScan("share.button")}
                                                onCopyMedicineDetails={handleCopyMedicineDetails}
                                                copied={copied}
                                            />

                                            <button
                                                onClick={handleSaveToABHA}
                                                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
                                            >
                                                Save to ABHA Record
                                            </button>
                                        </div>
                                    )}

                                {!verifyError && verifyResult && !verifyResult.verified && (
                                    <UnverifiedResult
                                        brandName={parsedBrand}
                                        batchNumber={parsedBatch}
                                        expiryDate={parsedExpiry}
                                        onScanAgain={handleDismissResult}
                                        onShare={handleShare}
                                        shareLabel={tScan("share.button")}
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

            <div className="flex flex-col items-center gap-6 bg-linear-to-t from-(--color-surface-page) to-transparent p-8">
                <PendingScanQueue pending={pending} isSyncing={isSyncing} />

                <form
                    onSubmit={handleBatchSubmit}
                    className="flex w-full max-w-sm flex-col gap-3 sm:flex-row"
                >
                    <label htmlFor="batch-input" className="sr-only">
                        Enter batch number
                    </label>
                    <input
                        id="batch-input"
                        type="text"
                        value={batchInput}
                        onChange={(e) => setBatchInput(e.target.value)}
                        placeholder={tScan("enterBatchNumber")}
                        className="flex-1 rounded-full border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 text-center text-sm font-medium text-(--color-text-primary) placeholder-(--color-text-muted) focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-white/40"
                    />
                    <button
                        type="submit"
                        disabled={isScanning}
                        className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                            isScanning
                                ? "Verifying medicine..."
                                : isOffline
                                  ? "Verify button disabled - offline"
                                  : "Verify medicine batch number"
                        }
                        aria-busy={isScanning}
                    >
                        <Search size={18} aria-hidden="true" />
                        {isOffline ? tScan("offlineVerify") : tScan("verify")}
                    </button>
                </form>

                <p className="max-w-xs text-center text-sm font-medium text-slate-400">
                    {tScan("batchNumberHelp")}
                </p>

                <Link
                    href="/history"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-white/20 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none dark:border-white/20"
                >
                    <History size={18} />
                    {tScan("viewHistory")}
                </Link>
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                    <h3 className="mb-4 text-center text-lg font-bold text-white">Scan Controls</h3>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setIsCameraActive((prev) => !prev)}
                            disabled={isOffline}
                            className={`flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                isCameraActive
                                    ? "bg-red-500 text-white hover:bg-red-400"
                                    : "bg-emerald-500 text-white hover:bg-emerald-400"
                            }`}
                            aria-label={
                                isCameraActive
                                    ? "Stop barcode scanner camera"
                                    : "Start barcode scanner camera"
                            }
                            aria-pressed={isCameraActive}
                        >
                            <ScanLine size={18} aria-hidden="true" />
                            {isCameraActive ? tScan("stopScanner") : tScan("ScanBarcode")}
                        </button>
                        <label
                            htmlFor={isOffline ? undefined : "medicine-upload"}
                            onClick={(e) => {
                                if (isOffline) {
                                    e.preventDefault();
                                    toast.error(
                                        "You are currently offline. Please check your internet connection."
                                    );
                                }
                            }}
                            className={`flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-slate-200 ${
                                isOffline ? "cursor-not-allowed opacity-50" : ""
                            }`}
                            aria-label="Upload medicine photo from device (disabled while offline)"
                            aria-disabled={isOffline}
                        >
                            <Layers size={18} aria-hidden="true" />
                            {tScan("uploadPhoto")}
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
