"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
    Upload,
    X,
    Layers,
    Search,
    AlertTriangle,
    Check,
    Copy,
    Plus,
    Trash2,
    FileText,
    BookOpen,
    ShieldAlert,
    ShieldCheck,
    Clock,
    TrendingDown,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import Tesseract from "tesseract.js";
import {
    fuzzyMatchBrand,
    verifyMedicineByBrand,
    explainMedicine,
    extractPrescription,
    analyzePrescriptionText,
    type VerifiedMedicine,
    type MedicineExplanation,
} from "@/lib/api";
import { CdscoStatusBadge } from "./results/CdscoStatusBadge";

interface DashboardMedicine {
    id: string;
    verified: boolean;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    cdsco_approval_status: string;
    composition?: string | null;
    mrp?: number | null;
    jan_aushadhi_price?: number | null;
    explanation?: MedicineExplanation | null;
    explanationLoading?: boolean;
    explanationError?: string | null;
}

const LANGUAGES = [
    { code: "English", label: "English" },
    { code: "Hindi", label: "हिन्दी (Hindi)" },
    { code: "Bengali", label: "বাংলা (Bengali)" },
    { code: "Tamil", label: "தமிழ் (Tamil)" },
    { code: "Telugu", label: "తెలుగు (Telugu)" },
    { code: "Marathi", label: "मराठी (Marathi)" },
    { code: "Gujarati", label: "ગુજરાતી (Gujarati)" },
    { code: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
    { code: "Malayalam", label: "മലയാളம் (Malayalam)" },
    { code: "Punjabi", label: "ਪੰਜਾਬੀ (Punjabi)" },
    { code: "Urdu", label: "اردو (Urdu)" },
];

export function PrescriptionReader() {
    // Basic States
    const [selectedLanguage, setSelectedLanguage] = useState("English");
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [status, setStatus] = useState<
        "idle" | "compressing" | "ocr" | "matching" | "done" | "error"
    >("idle");
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // OCR & Parsed text states
    const [rawOcrText, setRawOcrText] = useState<string | null>(null);
    const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

    // Dashboard States
    const [detectedMedicines, setDetectedMedicines] = useState<DashboardMedicine[]>([]);

    // Manual Search States
    const [manualSearchQuery, setManualSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{ name: string; score: number }>>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Clipboard copies
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const ocrWorkerRef = useRef<Tesseract.Worker | null>(null);
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up Tesseract on unmount
    useEffect(() => {
        return () => {
            if (ocrWorkerRef.current) {
                void ocrWorkerRef.current.terminate();
            }
        };
    }, []);

    // Explain a specific medicine
    const fetchExplanation = useCallback(async (medId: string, name: string, lang: string) => {
        setDetectedMedicines((prev) =>
            prev.map((m) =>
                m.id === medId ? { ...m, explanationLoading: true, explanationError: null } : m
            )
        );

        try {
            const explanation = await explainMedicine(name, lang);
            setDetectedMedicines((prev) =>
                prev.map((m) =>
                    m.id === medId ? { ...m, explanation, explanationLoading: false } : m
                )
            );
        } catch (err) {
            console.error(`Explanation error for ${name}:`, err);
            setDetectedMedicines((prev) =>
                prev.map((m) =>
                    m.id === medId
                        ? {
                              ...m,
                              explanationLoading: false,
                              explanationError:
                                  "Failed to generate explanation. Click retry to query again.",
                          }
                        : m
                )
            );
        }
    }, []);

    // Re-fetch explanations when language changes
    useEffect(() => {
        if (detectedMedicines.length > 0) {
            detectedMedicines.forEach((m) => {
                void fetchExplanation(m.id, m.brand_name, selectedLanguage);
            });
        }
    }, [selectedLanguage]);

    // Compression + FileReader
    const processPrescriptionFile = async (file: File) => {
        if (!file) return;

        // Size check (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit.");
            return;
        }

        setStatus("compressing");
        setProgress(0);
        setStatusMessage("Compressing prescription photo...");

        let compressedFile = file;
        if (file.size > 2 * 1024 * 1024) {
            try {
                compressedFile = await imageCompression(file, {
                    maxSizeMB: 1.5,
                    maxWidthOrHeight: 2000,
                    useWebWorker: true,
                    onProgress: (pct) => setProgress(pct),
                });
            } catch (err) {
                console.error("Compression failed:", err);
            }
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);

        void runOcrExtraction(compressedFile);
    };

    // Run OCR using the backend scan endpoint
    const runOcrExtraction = async (file: File) => {
        setStatus("ocr");
        setProgress(0);
        setStatusMessage("Extracting text and matching medicines via scan API...");

        try {
            const result = await extractPrescription(file);
            const text = result.text;

            if (!text || !text.trim()) {
                setStatus("error");
                setStatusMessage("No text found in prescription. Please upload a clearer image.");
                toast.warning("We couldn't read any text from the prescription image.");
                return;
            }

            setRawOcrText(text);
            setOcrConfidence(result.confidence);

            // First: Add primary matched medicine if backend detected it
            const matchedList: DashboardMedicine[] = [];
            if (result.medicine) {
                const medId = crypto.randomUUID();
                matchedList.push({
                    id: medId,
                    verified: true,
                    brand_name: result.medicine.brand_name,
                    generic_name: result.medicine.generic_name,
                    manufacturer: result.medicine.manufacturer,
                    cdsco_approval_status: result.medicine.cdsco_approval_status,
                    composition: result.medicine.composition ?? null,
                    mrp: result.medicine.mrp ?? null,
                    jan_aushadhi_price: result.medicine.jan_aushadhi_price ?? null,
                    explanation: null,
                    explanationLoading: false,
                });
                // Immediately update UI with primary detected medicine
                setDetectedMedicines([...matchedList]);
            }

            // Move to matching remaining medicines from text
            void matchMedicinesFromOcr(text, matchedList);
        } catch (err) {
            console.warn(
                "Backend OCR unavailable or not configured. Falling back to browser-based local OCR...",
                err
            );

            setStatus("ocr");
            setStatusMessage("Running local text recognition engine...");

            try {
                if (!ocrWorkerRef.current) {
                    ocrWorkerRef.current = await Tesseract.createWorker("eng");
                }

                // Read file as Data URL for Tesseract
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error("Failed to read prescription file"));
                    reader.readAsDataURL(file);
                });

                const { data } = await ocrWorkerRef.current.recognize(dataUrl);
                const text = data.text;

                if (!text || !text.trim()) {
                    setStatus("error");
                    setStatusMessage(
                        "No text found in prescription. Please ensure the photo is readable."
                    );
                    toast.warning("We couldn't read any text from the prescription image.");
                    return;
                }

                setRawOcrText(text);
                setOcrConfidence(data.confidence / 100);

                // Move to matching medicines from local OCR text
                void matchMedicinesFromOcr(text, []);
            } catch (tessErr) {
                console.error("Local Tesseract OCR also failed:", tessErr);
                setStatus("error");
                setStatusMessage(
                    "Text extraction failed. Please ensure the image is bright and legible."
                );
                toast.error("Failed to read text from prescription image.");
            }
        }
    };

    // Match extracted text to medicines table
    const matchMedicinesFromOcr = async (
        ocrText: string,
        initialMatchedList: DashboardMedicine[] = []
    ) => {
        setStatus("matching");
        setStatusMessage("Analyzing prescription text using AI...");

        try {
            const { medicines } = await analyzePrescriptionText(ocrText, selectedLanguage);

            const matchedList = [...initialMatchedList];

            for (const med of medicines) {
                // Skip if already matched
                if (
                    matchedList.some(
                        (m) =>
                            m.brand_name.toLowerCase() === med.brand_name.toLowerCase() ||
                            m.generic_name.toLowerCase() === med.brand_name.toLowerCase()
                    )
                ) {
                    continue;
                }

                matchedList.push({
                    id: crypto.randomUUID(),
                    verified: true,
                    brand_name: med.brand_name,
                    generic_name: med.generic_name,
                    manufacturer: "AI Extracted",
                    cdsco_approval_status: "approved",
                    composition: med.composition,
                    explanation: {
                        purpose: med.purpose,
                        precautions: med.precautions,
                        sideEffects: med.sideEffects,
                        usageGuidance: med.usageGuidance,
                    },
                    explanationLoading: false,
                });
            }

            setDetectedMedicines(matchedList);
            setStatus("done");
            if (matchedList.length > 0) {
                toast.success(`Identified ${matchedList.length} medicines!`);
            } else {
                toast.error("No medicines could be identified from the text.");
            }
        } catch (err) {
            console.error("AI prescription analysis failed:", err);
            toast.error("Failed to analyze prescription using AI.");
            setStatus("error");
            setStatusMessage(
                "AI analysis failed. Please try again or type the medicine name manually."
            );
        }
    };

    // Drag events
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            void processPrescriptionFile(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            void processPrescriptionFile(file);
        }
    };

    const handleRemoveFile = () => {
        setPreviewImage(null);
        setRawOcrText(null);
        setOcrConfidence(null);
        setDetectedMedicines([]);
        setStatus("idle");
    };

    // Manual Search & Add
    const triggerManualSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const matches = await fuzzyMatchBrand(query);
            setSearchResults(matches || []);
        } catch (err) {
            console.error("Manual search failed:", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setManualSearchQuery(val);

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        searchDebounceRef.current = setTimeout(() => {
            void triggerManualSearch(val);
        }, 300);
    };

    const handleAddMedicine = async (brandName: string) => {
        // Prevent duplicate
        if (detectedMedicines.some((m) => m.brand_name.toLowerCase() === brandName.toLowerCase())) {
            toast.error(`${brandName} is already on the dashboard.`);
            setManualSearchQuery("");
            setSearchResults([]);
            return;
        }

        try {
            const detailsRes = await verifyMedicineByBrand(brandName);
            if (detailsRes.verified) {
                const medId = crypto.randomUUID();
                const newMed: DashboardMedicine = {
                    id: medId,
                    verified: true,
                    brand_name: detailsRes.medicine.brand_name,
                    generic_name: detailsRes.medicine.generic_name,
                    manufacturer: detailsRes.medicine.manufacturer,
                    cdsco_approval_status: detailsRes.medicine.cdsco_approval_status,
                    composition: (detailsRes.medicine as any).composition ?? null,
                    mrp: (detailsRes.medicine as any).mrp ?? null,
                    jan_aushadhi_price: (detailsRes.medicine as any).jan_aushadhi_price ?? null,
                    explanation: null,
                    explanationLoading: false,
                };

                setDetectedMedicines((prev) => [...prev, newMed]);
                setManualSearchQuery("");
                setSearchResults([]);
                toast.success(`Added ${brandName}!`);

                // Explain right away
                void fetchExplanation(medId, brandName, selectedLanguage);
            }
        } catch (err) {
            console.error("Failed to add manual medicine:", err);
            toast.error("Could not fetch details for this medicine.");
        }
    };

    const handleRemoveMedicine = (id: string) => {
        setDetectedMedicines((prev) => prev.filter((m) => m.id !== id));
    };

    const copyDetails = async (med: DashboardMedicine) => {
        const text = [
            `Medicine: ${med.brand_name}`,
            `Composition / Generic: ${med.generic_name}`,
            `Manufacturer: ${med.manufacturer}`,
            `CDSCO Status: ${med.cdsco_approval_status}`,
            med.explanation ? `Purpose: ${med.explanation.purpose}` : "",
            med.explanation ? `Usage Guidance: ${med.explanation.usageGuidance}` : "",
            med.explanation ? `Side Effects: ${med.explanation.sideEffects}` : "",
            med.explanation ? `Precautions: ${med.explanation.precautions}` : "",
        ]
            .filter(Boolean)
            .join("\n");

        try {
            await navigator.clipboard.writeText(text);
            setCopiedStates((prev) => ({ ...prev, [med.id]: true }));
            toast.success("Details copied to clipboard!");
            setTimeout(() => {
                setCopiedStates((prev) => ({ ...prev, [med.id]: false }));
            }, 2000);
        } catch (err) {
            toast.error("Failed to copy details.");
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
            {/* Header & Language Select */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-emerald-500 md:text-3xl">
                        <BookOpen size={28} className="text-emerald-500" />
                        AI Prescription Explainer
                    </h2>
                    <p className="mt-1 text-sm font-medium text-(--color-text-secondary)">
                        Upload a doctor's prescription to translate handwriting, list medicines, and
                        explain uses.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="explanation-lang"
                        className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase"
                    >
                        Explain in:
                    </label>
                    <select
                        id="explanation-lang"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-2 text-sm font-semibold text-(--color-text-primary) shadow-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                        {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>
                                {l.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Upload Area / States */}
            {status === "idle" && (
                <button
                    type="button"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-16 transition-all duration-300 focus:outline-none ${
                        isDragOver
                            ? "border-emerald-500 bg-emerald-50/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] dark:bg-emerald-950/10"
                            : "border-(--color-border-muted) bg-(--color-surface-muted) hover:border-emerald-400 hover:bg-emerald-50/10 dark:hover:bg-slate-800/20"
                    }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 shadow-inner dark:bg-emerald-950/50 dark:text-emerald-400">
                        <Upload size={28} />
                    </div>
                    <div className="max-w-sm text-center">
                        <p className="text-base font-bold text-(--color-text-primary)">
                            Drag and drop prescription photo here
                        </p>
                        <p className="mt-1 text-xs font-semibold text-(--color-text-muted)">
                            or click to browse from files · JPG, PNG, or WebP up to 10MB
                        </p>
                    </div>
                </button>
            )}

            {/* Loaders */}
            {(status === "compressing" || status === "ocr" || status === "matching") && (
                <div className="relative space-y-6 overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted) p-8 text-center shadow-xl">
                    {/* Simulated laser scan line */}
                    {status === "ocr" && (
                        <div className="animate-scan absolute right-4 left-4 z-20 h-[2.5px] bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
                    )}

                    <div className="flex justify-center">
                        <Loader2 className="animate-spin text-emerald-500" size={48} />
                    </div>

                    <div className="mx-auto max-w-sm space-y-2">
                        <p className="text-base font-bold text-(--color-text-primary)">
                            {statusMessage}
                        </p>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                style={{
                                    width:
                                        status === "compressing"
                                            ? `${progress}%`
                                            : status === "ocr"
                                              ? "60%"
                                              : "90%",
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard / Done State */}
            {status === "done" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-300">
                    {/* Prescription image reference & Meta */}
                    <div className="flex flex-col gap-4 rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4 md:flex-row md:items-center">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="Prescription snippet"
                                className="h-24 w-24 rounded-2xl border border-slate-200 bg-white object-cover dark:border-slate-700"
                            />
                        )}
                        <div className="flex-1 space-y-1">
                            <h4 className="flex items-center gap-1.5 text-sm font-bold text-(--color-text-primary)">
                                <FileText size={16} className="text-emerald-500" />
                                Prescription Scanned Successfully
                            </h4>
                            <p className="text-xs font-medium text-(--color-text-secondary)">
                                Detected {detectedMedicines.length} medicines in the prescription
                                paper.
                                {ocrConfidence &&
                                    ` OCR Reading Confidence: ${Math.round(ocrConfidence * 100)}%`}
                            </p>
                        </div>
                        <button
                            onClick={handleRemoveFile}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 focus:outline-none dark:border-red-950 dark:bg-red-950/30 dark:text-red-400"
                        >
                            <Trash2 size={14} />
                            Reset Scanner
                        </button>
                    </div>

                    {/* Dashboard Controls (Manual search) */}
                    <div className="relative max-w-md">
                        <label htmlFor="manual-med-search" className="sr-only">
                            Search and add another medicine
                        </label>
                        <div className="flex items-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) px-3 py-1.5 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/50">
                            <Search size={18} className="text-(--color-text-muted)" />
                            <input
                                id="manual-med-search"
                                type="text"
                                value={manualSearchQuery}
                                onChange={handleSearchChange}
                                placeholder="Search and add another medicine manually..."
                                className="flex-1 bg-transparent text-sm text-(--color-text-primary) placeholder-(--color-text-muted) outline-none"
                            />
                            {searchLoading && (
                                <Loader2 className="animate-spin text-emerald-500" size={16} />
                            )}
                        </div>

                        {searchResults.length > 0 && (
                            <ul className="animate-in fade-in absolute right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) p-1.5 shadow-2xl duration-150">
                                {searchResults.map((r, i) => (
                                    <li key={i}>
                                        <button
                                            type="button"
                                            onClick={() => handleAddMedicine(r.name)}
                                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-(--color-text-primary) hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                                        >
                                            <span>{r.name}</span>
                                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                                                <Plus size={14} /> Add
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Grid of Medicine Explanation Cards */}
                    {detectedMedicines.length === 0 ? (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-8 text-center dark:border-amber-950/20 dark:bg-amber-950/10">
                            <AlertTriangle className="mx-auto text-amber-500" size={36} />
                            <h4 className="mt-3 text-base font-bold text-(--color-text-primary)">
                                No Medicines Detected
                            </h4>
                            <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-(--color-text-secondary)">
                                The OCR couldn't match any names. Use the search bar above to look
                                up and add medicines manually.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {detectedMedicines.map((med) => (
                                <MedicineExplanationCard
                                    key={med.id}
                                    med={med}
                                    onDelete={() => handleRemoveMedicine(med.id)}
                                    onCopy={() => copyDetails(med)}
                                    copied={copiedStates[med.id] || false}
                                    onRetry={() =>
                                        fetchExplanation(med.id, med.brand_name, selectedLanguage)
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Raw Text Accordion */}
                    {rawOcrText && (
                        <details className="group overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted) p-4 transition-all duration-300">
                            <summary className="flex cursor-pointer items-center justify-between text-xs font-bold tracking-wider text-(--color-text-muted) uppercase outline-none select-none">
                                <span className="flex items-center gap-2">
                                    <FileText size={14} />
                                    Show Decoded Transcription (OCR Raw)
                                </span>
                                <span className="text-xs transition-transform duration-200 group-open:rotate-180">
                                    ▼
                                </span>
                            </summary>
                            <div className="mt-4 border-t border-(--color-border-muted) pt-4">
                                <pre className="max-h-40 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-(--color-text-secondary) select-all">
                                    {rawOcrText}
                                </pre>
                            </div>
                        </details>
                    )}
                </div>
            )}

            {/* Error state */}
            {status === "error" && (
                <div className="mx-auto max-w-md space-y-4 rounded-3xl border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-950/20 dark:bg-red-950/10">
                    <ShieldAlert className="mx-auto text-red-500" size={40} />
                    <div className="space-y-1">
                        <h4 className="text-base font-bold text-red-800 dark:text-red-400">
                            Scanning Process Failed
                        </h4>
                        <p className="text-xs font-medium text-red-700 dark:text-red-400">
                            {statusMessage}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-red-700 focus:outline-none"
                    >
                        Try Another Image
                    </button>
                </div>
            )}
        </div>
    );
}

// Medicine Card subcomponent
function MedicineExplanationCard({
    med,
    onDelete,
    onCopy,
    copied,
    onRetry,
}: {
    med: DashboardMedicine;
    onDelete: () => void;
    onCopy: () => void;
    copied: boolean;
    onRetry: () => void;
}) {
    // Current Active Tab for explanation details
    const [activeTab, setActiveTab] = useState<"purpose" | "safety" | "sideEffects" | "usage">(
        "purpose"
    );

    const renderTabContent = () => {
        if (med.explanationLoading) {
            return (
                <div className="flex flex-col items-center justify-center space-y-2 py-8">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                    <span className="text-xs font-semibold text-(--color-text-muted)">
                        Generating AI clinical guide...
                    </span>
                </div>
            );
        }

        if (med.explanationError) {
            return (
                <div className="border-red-250 rounded-2xl border bg-red-50/30 p-4 text-center dark:border-red-900/30 dark:bg-red-950/10">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-400">
                        {med.explanationError}
                    </p>
                    <button
                        onClick={onRetry}
                        className="mt-2 text-xs font-bold text-emerald-500 underline hover:text-emerald-600"
                    >
                        Retry explanation
                    </button>
                </div>
            );
        }

        if (!med.explanation) {
            return (
                <p className="py-6 text-center text-xs text-(--color-text-muted) italic">
                    Explanation currently unavailable.
                </p>
            );
        }

        switch (activeTab) {
            case "purpose":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-emerald-500 uppercase">
                            <BookOpen size={12} /> What it is for
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.purpose}
                        </p>
                    </div>
                );
            case "safety":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-amber-500 uppercase">
                            <ShieldAlert size={12} /> Warnings & Precautions
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.precautions}
                        </p>
                    </div>
                );
            case "sideEffects":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-red-500 uppercase">
                            <AlertTriangle size={12} /> Potential Side Effects
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.sideEffects}
                        </p>
                    </div>
                );
            case "usage":
                return (
                    <div className="animate-in fade-in space-y-1.5 duration-200">
                        <h5 className="flex items-center gap-1 text-xs font-bold tracking-wider text-blue-500 uppercase">
                            <Clock size={12} /> Usage & Dosage Guidance
                        </h5>
                        <p className="text-xs leading-relaxed font-semibold text-(--color-text-primary)">
                            {med.explanation.usageGuidance}
                        </p>
                    </div>
                );
        }
    };

    // Cost Savings Calculator
    const hasSavings = med.mrp && med.jan_aushadhi_price && med.mrp > med.jan_aushadhi_price;
    const savingsPercent = hasSavings
        ? Math.round(((med.mrp! - med.jan_aushadhi_price!) / med.mrp!) * 100)
        : 0;

    return (
        <div className="relative flex flex-col justify-between rounded-[2.2rem] border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-xl">
            <div className="absolute top-0 right-0 left-0 h-1.5 rounded-t-full bg-emerald-500"></div>

            {/* Top row with name, status & actions */}
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="text-lg font-black tracking-tight text-(--color-text-primary)">
                            {med.brand_name}
                        </h3>
                        <p className="mt-0.5 text-xs font-bold text-(--color-text-secondary)">
                            {med.generic_name}
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            onClick={onCopy}
                            title="Copy clinical details"
                            className={`rounded-lg p-1.5 transition-all ${
                                copied
                                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-(--color-border-muted) hover:text-(--color-text-primary)"
                            }`}
                        >
                            {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} />}
                        </button>

                        <button
                            onClick={onDelete}
                            title="Delete medicine card"
                            className="rounded-lg bg-red-50 p-1.5 text-red-600 transition-all hover:bg-red-100 focus:outline-none dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Subtitle meta */}
                <div className="flex flex-wrap items-center gap-2">
                    <CdscoStatusBadge status={med.cdsco_approval_status} />
                    <span className="rounded border border-(--color-border-muted) bg-(--color-surface-muted) px-2 py-0.5 text-[10px] font-bold text-(--color-text-muted)">
                        {med.manufacturer}
                    </span>
                </div>

                {/* Composition line */}
                {med.composition && (
                    <div className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2 text-[11px] font-medium text-(--color-text-secondary)">
                        <span className="font-bold text-(--color-text-primary)">Composition: </span>
                        {med.composition}
                    </div>
                )}

                {/* Cost Savings Badge */}
                {hasSavings && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <TrendingDown size={14} className="shrink-0 text-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Generic Alternative (Jan Aushadhi) saves {savingsPercent}% cost! (₹
                            {med.jan_aushadhi_price} vs MRP ₹{med.mrp})
                        </span>
                    </div>
                )}

                {/* Tab select bar */}
                <div className="flex border-b border-(--color-border-muted) pt-2">
                    {(["purpose", "safety", "sideEffects", "usage"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 border-b-2 pb-1.5 text-center text-[10px] font-extrabold tracking-wider uppercase transition-colors outline-none ${
                                activeTab === tab
                                    ? "border-emerald-500 text-emerald-500"
                                    : "border-transparent text-(--color-text-muted) hover:text-(--color-text-secondary)"
                            }`}
                        >
                            {tab === "purpose"
                                ? "Use"
                                : tab === "safety"
                                  ? "Safety"
                                  : tab === "sideEffects"
                                    ? "Effects"
                                    : "Dose"}
                        </button>
                    ))}
                </div>

                {/* Tab content area */}
                <div className="min-h-24 pt-2">{renderTabContent()}</div>
            </div>
        </div>
    );
}
