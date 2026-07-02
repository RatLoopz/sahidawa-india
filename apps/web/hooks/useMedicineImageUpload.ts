import { useState, useRef } from "react";
import Tesseract from "tesseract.js";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import {
    extractMedicineName,
    extractBatchNumber,
    extractExpiryDate,
} from "@/lib/sync/medicineParser";
import { verifyMedicine, verifyMedicineByBrand, VerifyResult, fuzzyMatchBrand } from "@/lib/api";
import { structuredLog } from "@/lib/structuredLogger";
import { saveScanHistory } from "@/lib/db/scanHistory";
import { expiryToIso } from "@/lib/medicineDateUtils";

type UseMedicineImageUploadProps = {
    handleVerify: (batch: string) => Promise<void>;
    processVerificationResult: (result: VerifyResult, fallbackBrandName?: string) => Promise<void>;
    setVerifyError: (error: string | null) => void;
    setShowResult: (show: boolean) => void;
    setBatchInput: (batch: string) => void;
    setVerifyResult: (result: VerifyResult | null) => void;
    setIsScanning: (scanning: boolean) => void;
};

export function useMedicineImageUpload({
    handleVerify,
    processVerificationResult,
    setVerifyError,
    setShowResult,
    setBatchInput,
    setVerifyResult,
    setIsScanning,
}: UseMedicineImageUploadProps) {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [ocrText, setOcrText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
    const [parsedBrand, setParsedBrand] = useState("");
    const [parsedBatch, setParsedBatch] = useState("");
    const [parsedExpiry, setParsedExpiry] = useState("");
    const [ocrStatus, setOcrStatus] = useState<
        "idle" | "scanning-barcode" | "extracting-text" | "done" | "error"
    >("idle");

    const abortControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
    const ocrWorkerRef = useRef<Tesseract.Worker | null>(null);
    const ocrCancelledRef = useRef(false);

    const reset = () => {
        setUploadedImage(null);
        setOcrText(null);
        setOcrConfidence(null);
        setParsedBrand("");
        setParsedBatch("");
        setParsedExpiry("");
        setOcrStatus("idle");
        setIsScanning(false);
    };

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const COMPRESSION_THRESHOLD = 2 * 1024 * 1024;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let processedFile = file;

        if (file.size > MAX_FILE_SIZE) {
            toast.error("File exceeds 10MB limit");
            e.target.value = "";
            return;
        }

        if (file.size > COMPRESSION_THRESHOLD) {
            try {
                processedFile = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                });
            } catch {
                toast.error("Failed to compress image");
                return;
            }
        }

        const reader = new FileReader();
        let dataUrl: string;
        try {
            dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Failed to read image file"));
                reader.readAsDataURL(processedFile);
            });
        } catch {
            toast.error("Could not read the image file. Please try again.");
            e.target.value = "";
            return;
        }
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
            } catch (error) {
                structuredLog({
                    log_level: "warn",
                    route: "/scan",
                    meta: {
                        message: "[scan] Barcode detection (ZXing) failed, falling back to OCR",
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
            }

            if (!isMountedRef.current || controller.signal.aborted) return;
            if (barcodeFound || ocrCancelledRef.current) return;

            // ── Step 2: Tesseract.js OCR Fallback ────────────────────────────
            setOcrStatus("extracting-text");

            if (!ocrWorkerRef.current) {
                ocrWorkerRef.current = await Tesseract.createWorker("eng");
            }

            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current)
                return;

            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("OCR timed out")), 30000);
            });

            const ocrPromise = ocrWorkerRef.current.recognize(dataUrl);
            let raceResult;
            try {
                raceResult = await Promise.race([ocrPromise, timeoutPromise]);
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
            const { data } = raceResult;

            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current)
                return;

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
                } catch (error) {
                    structuredLog({
                        log_level: "warn",
                        route: "/scan",
                        meta: {
                            message: "[scan] Batch verification failed, trying brand match",
                            batch: parsedBatchNum,
                            error: error instanceof Error ? error.message : String(error),
                        },
                    });
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
                            const brandRes = await verifyMedicineByBrand(
                                topMatch.name,
                                controller.signal
                            );
                            if (brandRes.verified) {
                                finalResult = brandRes;
                            }
                        }
                    }
                } catch (error) {
                    structuredLog({
                        log_level: "warn",
                        route: "/scan",
                        meta: {
                            message: "[scan] Fuzzy brand match verification failed",
                            brand: medName,
                            error: error instanceof Error ? error.message : String(error),
                        },
                    });
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
                const unverifiedResult =
                    finalResult ||
                    ({
                        verified: false,
                        message: "No match found in CDSCO Database",
                    } satisfies VerifyResult);
                await processVerificationResult(
                    unverifiedResult,
                    parsedBrand || medName || undefined
                );
            }
        } catch (err) {
            if (!isMountedRef.current || controller.signal.aborted || ocrCancelledRef.current)
                return;

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
                void saveScanHistory({
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    medicineName: parsedBrand || parsedBatch || "Unknown Medicine",
                    status: "SUSPICIOUS",
                }).catch((error) => {
                    console.error("Failed to save scan history:", error);
                });
            } else {
                toast.error("Failed to extract text from image.");
                setVerifyError(
                    "Unable to read text from this image. Please try a clearer photo or enter the batch number manually."
                );
                void saveScanHistory({
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    medicineName: parsedBrand || parsedBatch || "Unknown Medicine",
                    status: "SUSPICIOUS",
                }).catch((error) => {
                    console.error("Failed to save scan history:", error);
                });
            }
            setOcrStatus("error");
        } finally {
            if (isMountedRef.current && !controller.signal.aborted && !ocrCancelledRef.current) {
                setIsScanning(false);
                setShowResult(true);
            }
        }
    };

    return {
        uploadedImage,
        ocrText,
        ocrConfidence,
        parsedBrand,
        parsedBatch,
        parsedExpiry,
        ocrStatus,
        handleFileUpload,
        reset,
    };
}
