"use client";

import { useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    Camera,
    CheckCircle,
    Loader2,
    Shield,
    Upload,
    XCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";

type VerificationVerdict = "GENUINE" | "SUSPICIOUS" | "LIKELY_FAKE";

type VerificationResult = {
    verdict: VerificationVerdict;
    confidence: number;
    matchedReference?: string;
    processingTimeMs: number;
    error?: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const verdictContent = {
    GENUINE: {
        badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
        ring: "ring-emerald-500/25",
        icon: CheckCircle,
        title: "Packaging matches genuine samples",
        description: "The submitted packaging shows a strong visual match to verified reference images.",
    },
    SUSPICIOUS: {
        badge: "bg-amber-500/15 text-amber-100 border-amber-500/40",
        ring: "ring-amber-500/25",
        icon: AlertTriangle,
        title: "Could not confirm authenticity",
        description: "The packaging is not clearly verified yet and should be reviewed manually.",
    },
    LIKELY_FAKE: {
        badge: "bg-rose-500/15 text-rose-100 border-rose-500/40",
        ring: "ring-rose-500/25",
        icon: XCircle,
        title: "Packaging does not match genuine samples",
        description: "The packaging differs significantly from the reference images and may be counterfeit.",
    },
} satisfies Record<VerificationVerdict, { badge: string; ring: string; icon: typeof CheckCircle; title: string; description: string }>;

function getConfidenceSegments(confidence: number) {
    const filled = Math.max(0, Math.min(10, Math.round(confidence / 10)));

    return Array.from({ length: 10 }, (_, index) => ({
        active: index < filled,
    }));
}

export default function ImageVerifyPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const handleFileSelection = (file: File | null) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setError("Please select a JPEG, PNG, or WebP image.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setError("The selected image exceeds the 10MB limit.");
            return;
        }

        setError(null);
        setResult(null);

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(URL.createObjectURL(file));
        setSelectedFile(file);
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            return;
        }

        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
            setError("Cloudinary credentials are missing. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your environment.");
            return;
        }

        setError(null);
        setResult(null);
        setIsUploading(true);

        try {
            const uploadFormData = new FormData();
            uploadFormData.append("file", selectedFile);
            uploadFormData.append("upload_preset", uploadPreset);
            uploadFormData.append("folder", "sahidawa/submissions");
            uploadFormData.append("quality", "auto");
            uploadFormData.append("fetch_format", "auto");

            const uploadResponse = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                {
                    method: "POST",
                    body: uploadFormData,
                }
            );

            const uploadData = (await uploadResponse.json()) as {
                secure_url?: string;
                error?: {
                    message?: string;
                };
            };

            if (!uploadResponse.ok || !uploadData.secure_url) {
                throw new Error(uploadData.error?.message || "Cloudinary upload failed.");
            }

            setIsUploading(false);
            setIsAnalyzing(true);

            const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
            const verifyResponse = await fetch(`${apiBase}/api/image-verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cloudinaryUrl: uploadData.secure_url,
                    medicineName: selectedFile.name,
                }),
            });

            const verifyData = (await verifyResponse.json()) as {
                success?: boolean;
                data?: VerificationResult;
                error?: string;
            };

            if (!verifyResponse.ok || !verifyData.success || !verifyData.data) {
                throw new Error(verifyData.error || "Analysis request failed.");
            }

            setResult(verifyData.data);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unable to verify this image right now.";
            setError(message);
        } finally {
            setIsUploading(false);
            setIsAnalyzing(false);
        }
    };

    const currentVerdict = result?.verdict;
    const verdictMeta = currentVerdict ? verdictContent[currentVerdict] : null;

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50">
            <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-20 pt-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                            <Shield className="h-4 w-4" />
                            Medicine Packaging Verification
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Visual packaging analysis for quick authenticity checks
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                            Upload a captured packaging image, let Cloudinary optimize it, and compare the result against authenticated reference images using the ML pipeline.
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                        Back to home
                    </Link>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/40 sm:p-6">
                        <div
                            className={`rounded-2xl border-2 border-dashed p-5 transition sm:p-6 ${dragActive ? "border-emerald-400 bg-emerald-500/5" : "border-slate-700 bg-slate-950/60"}`}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragActive(true);
                            }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragActive(false);
                                handleFileSelection(event.dataTransfer.files[0] ?? null);
                            }}
                        >
                            <div className="flex flex-col gap-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-100">Upload or capture packaging</p>
                                        <p className="mt-1 text-sm text-slate-300">
                                            Supports JPEG, PNG, and WebP up to 10MB.
                                        </p>
                                    </div>
                                    <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200">
                                        Mobile-ready
                                    </div>
                                </div>

                                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-8 text-center">
                                    <Upload className="mb-3 h-10 w-10 text-emerald-200" />
                                    <span className="text-base font-semibold text-white">Click to upload</span>
                                    <span className="mt-1 text-sm text-slate-300">or drag and drop an image here</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="sr-only"
                                        onChange={(event) => {
                                            handleFileSelection(event.target.files?.[0] ?? null);
                                        }}
                                    />
                                </label>

                                <div className="flex flex-wrap gap-3">
                                    <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white sm:flex-initial">
                                        <Camera className="h-4 w-4" />
                                        <span>Use camera</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="sr-only"
                                            onChange={(event) => {
                                                handleFileSelection(event.target.files?.[0] ?? null);
                                            }}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={!selectedFile || isUploading || isAnalyzing}
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 sm:flex-initial"
                                    >
                                        {isUploading || isAnalyzing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {isUploading ? "Uploading" : "Analyzing"}
                                            </>
                                        ) : (
                                            <>
                                                <Shield className="h-4 w-4" />
                                                Verify packaging
                                            </>
                                        )}
                                    </button>
                                </div>

                                {error ? (
                                    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                        {error}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {previewUrl ? (
                            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                <p className="mb-3 text-sm font-semibold text-slate-100">Selected image preview</p>
                                <img
                                    src={previewUrl}
                                    alt="Packaging preview"
                                    className="max-h-80 w-full rounded-xl object-contain"
                                />
                                <p className="mt-3 text-sm text-slate-300">
                                    {selectedFile?.name} · {Math.round((selectedFile?.size ?? 0) / 1024)} KB
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-200">Result summary</p>
                                    <p className="mt-1 text-sm text-slate-300">
                                        Visual comparison results are shown after the ML service returns its verdict.
                                    </p>
                                </div>
                                <Shield className="h-8 w-8 text-emerald-200" />
                            </div>

                            {result ? (
                                <div className="mt-5 space-y-4">
                                    <div className={`rounded-2xl border px-4 py-4 ${verdictMeta?.badge ?? "bg-slate-800/80 text-slate-100 border-slate-700"}`}>
                                        <div className="flex items-center gap-3">
                                            {verdictMeta ? (
                                                <verdictMeta.icon className="h-6 w-6" />
                                            ) : (
                                                <Shield className="h-6 w-6" />
                                            )}
                                            <div>
                                                <p className="text-sm font-semibold">{result.verdict}</p>
                                                <p className="text-sm text-slate-100/90">{verdictMeta?.title}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-200">{verdictMeta?.description}</p>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                        <div className="flex items-center justify-between text-sm text-slate-200">
                                            <span>Confidence</span>
                                            <span className="font-semibold">{result.confidence.toFixed(2)}%</span>
                                        </div>
                                        <div className="mt-3 grid grid-cols-10 gap-2">
                                            {getConfidenceSegments(result.confidence).map((segment, index) => (
                                                <div
                                                    key={`${index}-${segment.active}`}
                                                    className={`h-3 rounded-full ${segment.active ? (result.verdict === "GENUINE" ? "bg-emerald-400" : result.verdict === "SUSPICIOUS" ? "bg-amber-400" : "bg-rose-400") : "bg-slate-800"}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                                            <p className="text-slate-400">Best match</p>
                                            <p className="mt-1 font-semibold">
                                                {result.matchedReference ?? "No reference selected"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                                            <p className="text-slate-400">Processing time</p>
                                            <p className="mt-1 font-semibold">{result.processingTimeMs} ms</p>
                                        </div>
                                    </div>

                                    {result.error ? (
                                        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                            {result.error}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-300">
                                    Upload an image and press <span className="font-semibold text-white">Verify packaging</span> to see the final verdict here.
                                </div>
                            )}
                        </div>

                        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
                            <p className="text-sm font-semibold text-white">How the analysis works</p>
                            <ul className="mt-3 space-y-3 text-sm text-slate-300">
                                <li>• The uploaded photo is optimized through Cloudinary and sent to the API proxy.</li>
                                <li>• The ML service downloads the image and compares it against reference packaging in <span className="font-semibold text-slate-100">data/seeds/medicines</span>.</li>
                                <li>• Results are returned as <span className="font-semibold text-emerald-200">GENUINE</span>, <span className="font-semibold text-amber-200">SUSPICIOUS</span>, or <span className="font-semibold text-rose-200">LIKELY_FAKE</span>.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
