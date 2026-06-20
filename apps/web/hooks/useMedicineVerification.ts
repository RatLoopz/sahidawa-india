import { useCallback, useState, type RefObject, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { verifyMedicine, checkLasaConflicts, type VerifyResult, type LasaMatch } from "@/lib/api";
import { recordScanHistory } from "@/lib/scanHistoryUtils";
import { saveScanHistory } from "@/lib/db/scanHistory";
import { isNetworkFailure } from "@/lib/scanQueueSync";
import { saveVerificationResult } from "@/lib/offlineCache";

export function useMedicineVerification(
    abortControllerRef: RefObject<AbortController | null>,
    isMountedRef: RefObject<boolean>,
    setIsScanning: Dispatch<SetStateAction<boolean>>,
    setShowResult: Dispatch<SetStateAction<boolean>>,
    options?: {
        queueBarcode?: (barcode: string) => Promise<boolean>;
        onQueued?: (barcode: string) => void;
    }
) {
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [lasaMatches, setLasaMatches] = useState<LasaMatch[]>([]);
    const [showLasaConfirmation, setShowLasaConfirmation] = useState(false);
    const [pendingVerifyResult, setPendingVerifyResult] = useState<VerifyResult | null>(null);

    const processVerificationResult = useCallback(
        async (result: VerifyResult, fallbackBrandName?: string) => {
            if (!result.verified) {
                setVerifyResult(result);

                void recordScanHistory(result, fallbackBrandName).catch((error) => {
                    console.error("Failed to save scan history:", error);
                });

                setShowResult(true);

                return;
            }
            if (result.medicine) {
                saveVerificationResult({
                    brand_name: result.medicine.brand_name || fallbackBrandName || "Unknown",
                    active_components: result.medicine.generic_name || "N/A",
                    counterfeit_status: result.medicine.is_counterfeit_alert
                        ? "Counterfeit"
                        : "Verified",
                    timestamp: Date.now(),
                });
            }
            try {
                const medicineName = result.medicine.brand_name || fallbackBrandName;
                if (!medicineName) {
                    setVerifyResult(result);

                    void recordScanHistory(result, fallbackBrandName).catch((error) => {
                        console.error("Failed to save scan history:", error);
                    });

                    setShowResult(true);

                    return;
                }
                const lasaRes = await checkLasaConflicts(medicineName);
                if (lasaRes.hasConflicts && lasaRes.matches.length > 0) {
                    setLasaMatches(lasaRes.matches);
                    setPendingVerifyResult(result);
                    setShowLasaConfirmation(true);
                    setShowResult(true);
                } else {
                    setVerifyResult(result);

                    void recordScanHistory(result, fallbackBrandName).catch((error) => {
                        console.error("Failed to save scan history:", error);
                    });

                    setShowResult(true);
                }
            } catch (error) {
                console.error("LASA check error:", error);
                setVerifyResult(result);

                void recordScanHistory(result, fallbackBrandName).catch((historyError) => {
                    console.error("Failed to save scan history:", historyError);
                });

                setShowResult(true);
            }
        },
        [setShowResult]
    );

    const handleVerify = useCallback(
        async (batch: string) => {
            if (!batch.trim()) {
                toast.error("Please enter a batch number to verify");
                return;
            }
            const normalizedBatch = batch.trim();

            if (typeof navigator !== "undefined" && !navigator.onLine && options?.queueBarcode) {
                const queued = await options.queueBarcode(normalizedBatch);
                if (queued) {
                    options.onQueued?.(normalizedBatch);
                }
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
                const result = await verifyMedicine(normalizedBatch, controller.signal);
                if (!isMountedRef.current || controller.signal.aborted) return;
                await processVerificationResult(result, undefined);
            } catch (err) {
                if (!isMountedRef.current || controller.signal.aborted) return;
                const errorMsg = err instanceof Error ? err.message : "Verification failed";
                if (errorMsg === "Request was cancelled.") {
                    return;
                }
                if (options?.queueBarcode && isNetworkFailure(err)) {
                    const queued = await options.queueBarcode(normalizedBatch);
                    if (queued) {
                        options.onQueued?.(normalizedBatch);
                    }
                    return;
                }
                setVerifyError(errorMsg);
                void saveScanHistory({
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    medicineName: batch.trim() || "Unknown Medicine",
                    status: "SUSPICIOUS",
                }).catch((error) => {
                    console.error("Failed to save scan history:", error);
                });
                setShowResult(true);
            } finally {
                if (isMountedRef.current && !controller.signal.aborted) {
                    setIsScanning(false);
                }
            }
        },
        [
            processVerificationResult,
            abortControllerRef,
            isMountedRef,
            setIsScanning,
            setShowResult,
            options?.queueBarcode,
            options?.onQueued,
        ]
    );

    return {
        verifyResult,
        verifyError,
        lasaMatches,
        showLasaConfirmation,
        pendingVerifyResult,

        setVerifyResult,
        setVerifyError,
        setLasaMatches,
        setPendingVerifyResult,
        setShowLasaConfirmation,

        handleVerify,
        processVerificationResult,
    };
}
