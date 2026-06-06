"use client";

/**
 * ReportWizard.tsx
 * 3-step wizard to report suspicious / fake medicines.
 * Tech: React Hook Form · Zod · @hookform/resolvers · Framer Motion · Tailwind CSS
 * Design: SahiDawa modern aesthetic — emerald accents, deep navy header, rounded corners
 */

import React, { useState, useRef, useCallback, useEffect, useId } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    submitReport,
    geocodePincode,
    analyzeMedicineImage,
    type MedicineImageAnalysis,
} from "@/lib/api";
import { preprocessMedicineImage } from "@/lib/imageEnhancer";
import LazyImage from "@/components/LazyImage";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { MedicinePhotoUpload } from "@/components/medicine";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { toast } from "sonner";

// ─── Cloudinary env ────────────────────────────────────────────────────────────
// Uploads are now securely routed through our backend API (/api/upload),
// eliminating the need to expose unsigned presets or API keys in the client.

// ─── Constants ─────────────────────────────────────────────────────────────────
const WEBP_FILE_EXTENSION = ".webp";

// ─── Input sanitisation ────────────────────────────────────────────────────────
/** Strip HTML/script tags and trim whitespace to prevent stored XSS. */
const sanitize = (v: string) => v.replace(/[<>]/g, "").trim();

const renameFileForMimeType = (fileName: string, mimeType: string) => {
    if (mimeType !== "image/webp" || fileName.toLowerCase().endsWith(WEBP_FILE_EXTENSION)) {
        return fileName;
    }

    return fileName.replace(/\.[^.]+$/, "") + WEBP_FILE_EXTENSION;
};

// ─── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
    medicineName: z
        .string()
        .transform(sanitize)
        .pipe(z.string().min(2, "At least 2 characters required")),
    manufacturer: z
        .string()
        .transform(sanitize)
        .pipe(z.string().min(2, "At least 2 characters required")),
    description: z
        .string()
        .transform(sanitize)
        .pipe(z.string().min(20, "Please provide at least 20 characters")),
    images: z.array(z.string().url()).min(1, "At least one photo is required"),
    pharmacyName: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
    address: z.string().transform(sanitize).pipe(z.string().min(5, "Required")),
    city: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
    state: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
    pincode: z
        .string()
        .transform(sanitize)
        .pipe(z.string().regex(/^\d{6}$/, "Must be exactly 6 digits")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
    medicineName: "",
    manufacturer: "",
    description: "",
    images: [],
    pharmacyName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
};

// ─── Per-step field keys ────────────────────────────────────────────────────────
const STEP_KEYS: Record<number, (keyof FormValues)[]> = {
    1: ["medicineName", "manufacturer", "description"],
    2: ["images"],
    3: ["pharmacyName", "address", "city", "state", "pincode"],
};

const STEPS = [
    { n: 1, title: "Medicine Details", code: "MED" },
    { n: 2, title: "Photo Evidence", code: "IMG" },
    { n: 3, title: "Location & Submit", code: "LOC" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ImageEntry {
    preview: string; // blob URL of the original user file
    cloudUrl: string; // Cloudinary secure_url from enhanced file
    name: string;
    analysis?: MedicineImageAnalysis | UnavailableImageAnalysis;
}

interface UnavailableImageAnalysis {
    isFake: false;
    confidence: 0;
    verdict: "unavailable";
    details: string;
}

type ImageAnalysisState = ImageEntry["analysis"];

const analysisText: Record<NonNullable<ImageAnalysisState>["verdict"], string> = {
    likely_genuine: "Likely genuine",
    suspicious: "Suspicious",
    likely_fake: "Likely fake",
    unavailable: "Analysis unavailable",
};

const analysisTone: Record<NonNullable<ImageAnalysisState>["verdict"], string> = {
    likely_genuine:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300",
    suspicious:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300",
    likely_fake:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/20 dark:text-red-300",
    unavailable:
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
};

const unavailableAnalysis = (error: unknown): UnavailableImageAnalysis => ({
    isFake: false,
    confidence: 0,
    verdict: "unavailable",
    details:
        error instanceof Error
            ? error.message
            : "Image analysis could not be completed. Your report can still be submitted.",
});

// ─── Animation variants ────────────────────────────────────────────────────────
const PAGE: Variants = {
    enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
    show: {
        x: 0,
        opacity: 1,
        transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
    exit: (d: number) => ({
        x: d > 0 ? -48 : 48,
        opacity: 0,
        transition: { duration: 0.18 },
    }),
};

// ─── Tiny inline icons ─────────────────────────────────────────────────────────
const Icon = {
    Check: () => (
        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path
                d="M2 6.5l2.8 2.8L10 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    ),
    Alert: () => (
        <svg viewBox="0 0 12 12" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
            <path d="M6 0a6 6 0 100 12A6 6 0 006 0zm0 8.5a.65.65 0 110 1.3.65.65 0 010-1.3zM5.35 3.8a.65.65 0 011.3 0v3a.65.65 0 01-1.3 0v-3z" />
        </svg>
    ),
    Upload: () => (
        <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            className="h-8 w-8"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.5v2A1.5 1.5 0 004.5 17h11a1.5 1.5 0 001.5-1.5v-2M10 3v9m-3.5-3L10 3l3.5 3"
            />
        </svg>
    ),
    X: () => (
        <svg
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-2.5 w-2.5"
        >
            <path strokeLinecap="round" d="M1 1l8 8M9 1L1 9" />
        </svg>
    ),
    Arrow: ({ left }: { left?: boolean }) => (
        <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-3.5 w-3.5 flex-shrink-0"
        >
            {left ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 2L4 7l5 5" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 2l5 5-5 5" />
            )}
        </svg>
    ),
    Send: () => (
        <svg
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 7h11M8 2.5l4.5 4.5L8 11.5" />
        </svg>
    ),
    ShieldCheck: () => (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-5 w-5"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        </svg>
    ),
};

// ─── Field error ───────────────────────────────────────────────────────────────
function FieldError({ messageId, msg }: { messageId: string; msg?: string }) {
    return (
        <AnimatePresence>
            {msg && (
                <motion.span
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <LiveMessage
                        as="span"
                        tone="critical"
                        id={messageId}
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-500"
                    >
                        <Icon.Alert />
                        {msg}
                    </LiveMessage>
                </motion.span>
            )}
        </AnimatePresence>
    );
}

// ─── Label ─────────────────────────────────────────────────────────────────────
function FL({ children, req }: { children: React.ReactNode; req?: boolean }) {
    return (
        <label className="mb-2 block text-sm font-bold text-(--color-text-primary)">
            {children}
            {req && <span className="ml-1.5 text-emerald-500">*</span>}
        </label>
    );
}

// ─── Base input classes ────────────────────────────────────────────────────────
const inp = (err?: boolean) =>
    `w-full bg-(--color-surface-muted) border border-(--color-border-muted) rounded-xl px-4 py-3 text-(--color-text-primary) font-medium
   placeholder-(--color-text-muted) outline-none transition-all duration-200
   focus:bg-(--color-surface-page) focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500
   ${err ? "border-red-300 focus:border-red-400 focus:ring-red-500/10" : "hover:border-slate-350 dark:hover:border-slate-600"}`;

// ─── Step progress bar ─────────────────────────────────────────────────────────
function Progress({ current }: { current: number }) {
    const pct = ((current - 1) / 2) * 100;
    return (
        <div className="mb-8">
            {/* Bar */}
            <div className="relative mb-6 h-1.5 overflow-hidden rounded-full bg-(--color-surface-muted)">
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
            </div>

            {/* Step chips */}
            <div className="flex gap-2.5">
                {STEPS.map((s) => {
                    const done = current > s.n;
                    const active = current === s.n;
                    return (
                        <div
                            key={s.n}
                            className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-all duration-200 select-none ${
                                done
                                    ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                                    : active
                                      ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-surface-page)"
                                      : "border-(--color-border-muted) bg-(--color-surface-page) text-(--color-text-muted)"
                            }`}
                        >
                            {done ? (
                                <>
                                    <Icon.Check />
                                    {s.code}
                                </>
                            ) : (
                                <>
                                    <span
                                        className={
                                            active
                                                ? "text-emerald-400"
                                                : "text-(--color-text-muted)"
                                        }
                                    >
                                        {s.n}
                                    </span>
                                    {s.code}
                                </>
                            )}
                        </div>
                    );
                })}
                {/* Step label */}
                <span className="ml-auto self-center text-xs font-semibold whitespace-nowrap text-(--color-text-secondary)">
                    {current}/{STEPS.length} — {STEPS[current - 1].title}
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1
// ─────────────────────────────────────────────────────────────────────────────
function Step1() {
    const {
        register,
        formState: { errors },
    } = useFormContext<FormValues>();
    const medicineNameErrorId = useId();
    const manufacturerErrorId = useId();
    const descriptionErrorId = useId();

    return (
        <div className="space-y-5">
            <div>
                <FL req>Medicine Name</FL>
                <input
                    {...register("medicineName")}
                    placeholder="e.g. Augmentin 625 Duo"
                    className={inp(!!errors.medicineName)}
                    aria-invalid={errors.medicineName ? "true" : undefined}
                    aria-describedby={errors.medicineName ? medicineNameErrorId : undefined}
                />
                <FieldError messageId={medicineNameErrorId} msg={errors.medicineName?.message} />
            </div>
            <div>
                <FL req>Manufacturer</FL>
                <input
                    {...register("manufacturer")}
                    placeholder="e.g. Cipla Ltd."
                    className={inp(!!errors.manufacturer)}
                    aria-invalid={errors.manufacturer ? "true" : undefined}
                    aria-describedby={errors.manufacturer ? manufacturerErrorId : undefined}
                />
                <FieldError messageId={manufacturerErrorId} msg={errors.manufacturer?.message} />
            </div>
            <div>
                <FL req>Description of Concern</FL>
                <textarea
                    {...register("description")}
                    rows={4}
                    placeholder="Describe unusual colour, smell, texture, packaging, reported side-effects…"
                    className={`${inp(!!errors.description)} resize-none`}
                    aria-invalid={errors.description ? "true" : undefined}
                    aria-describedby={errors.description ? descriptionErrorId : undefined}
                />
                <FieldError messageId={descriptionErrorId} msg={errors.description?.message} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2
// ─────────────────────────────────────────────────────────────────────────────
function Step2({
    images,
    setImages,
}: {
    images: ImageEntry[];
    setImages: React.Dispatch<React.SetStateAction<ImageEntry[]>>;
}) {
    const {
        setValue,
        formState: { errors },
    } = useFormContext<FormValues>();
    const [busy, setBusy] = useState(false);
    const [upErr, setUpErr] = useState<string | null>(null);
    const uploadErrorId = useId();
    const imageErrorId = useId();

    const imgErr = errors.images?.message as string | undefined;

    const handleUploadComplete = (url: string) => {
        setUpErr(null);

        // Update state and form value synchronously so validation passes instantly
        const next = [
            ...images,
            {
                preview: url,
                cloudUrl: url,
                name: `Photo #${images.length + 1}`,
            },
        ];
        setImages(next);
        setValue(
            "images",
            next.map((i) => i.cloudUrl),
            { shouldValidate: true }
        );

        // Run AI analysis asynchronously in the background
        setBusy(true);
        void analyzeMedicineImage(url)
            .then((analysis) => {
                setImages((currentImages) =>
                    currentImages.map((img) => (img.cloudUrl === url ? { ...img, analysis } : img))
                );
            })
            .catch((err) => {
                const analysis = unavailableAnalysis(err);
                setImages((currentImages) =>
                    currentImages.map((img) => (img.cloudUrl === url ? { ...img, analysis } : img))
                );
            })
            .finally(() => {
                setBusy(false);
            });
    };

    const remove = (idx: number) => {
        const next = images.filter((_, i) => i !== idx);
        setImages(next);
        setValue(
            "images",
            next.map((i) => i.cloudUrl),
            { shouldValidate: true }
        );
    };

    return (
        <div className="space-y-5">
            {/* Reusable MedicinePhotoUpload component */}
            <MedicinePhotoUpload
                key={images.length}
                onUploadComplete={handleUploadComplete}
                onError={(err) => setUpErr(err)}
                label={
                    images.length > 0 ? "Upload another medicine photo" : "Upload medicine photo"
                }
                disabled={busy}
            />

            {/* Upload error */}
            <AnimatePresence>
                {upErr && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <LiveMessage
                            tone="critical"
                            id={uploadErrorId}
                            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400"
                        >
                            <span className="mt-0.5">
                                <Icon.Alert />
                            </span>
                            {upErr}
                        </LiveMessage>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Zod error (no images) */}
            {!upErr && <FieldError messageId={imageErrorId} msg={imgErr} />}

            {/* Thumbnail grid */}
            {images.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-4 sm:grid-cols-4">
                    <AnimatePresence>
                        {images.map((img, idx) => (
                            <motion.div
                                key={img.cloudUrl}
                                initial={{ opacity: 0, scale: 0.88 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.88 }}
                                transition={{ duration: 0.18 }}
                                className="group relative aspect-square overflow-hidden rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) shadow-sm"
                            >
                                <LazyImage
                                    src={img.preview}
                                    alt={img.name}
                                    wrapperClassName="w-full h-full"
                                    className="h-full w-full object-cover"
                                />
                                {/* Remove overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            remove(idx);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-all hover:bg-red-600 active:scale-95"
                                        aria-label="Remove"
                                    >
                                        <Icon.X />
                                    </button>
                                </div>
                                {/* Name bar */}
                                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-slate-900/80 px-2 py-1.5 transition-transform group-hover:translate-y-0">
                                    <p className="truncate text-[10px] font-medium text-white/90">
                                        {img.name}
                                    </p>
                                </div>
                                {img.analysis && (
                                    <span
                                        className={`absolute top-2 left-2 rounded-full border px-2 py-1 text-[10px] font-bold shadow-sm ${analysisTone[img.analysis.verdict]}`}
                                    >
                                        {analysisText[img.analysis.verdict]}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {images.some((img) => img.analysis) && (
                <div className="space-y-2">
                    {images.map((img) =>
                        img.analysis ? (
                            <div
                                key={`${img.cloudUrl}-analysis`}
                                className={`rounded-xl border px-4 py-3 text-sm font-medium ${analysisTone[img.analysis.verdict]}`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{analysisText[img.analysis.verdict]}</span>
                                    {img.analysis.verdict !== "unavailable" && (
                                        <span>
                                            {Math.round(img.analysis.confidence * 100)}% confidence
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed">
                                    {img.analysis.details}
                                </p>
                            </div>
                        ) : null
                    )}
                </div>
            )}

            {images.length === 0 && !busy && (
                <p className="text-center text-sm font-medium text-(--color-text-muted)">
                    Minimum 1 image required
                </p>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3
// ─────────────────────────────────────────────────────────────────────────────
function Step3() {
    const {
        register,
        formState: { errors },
    } = useFormContext<FormValues>();
    const pharmacyNameErrorId = useId();
    const addressErrorId = useId();
    const cityErrorId = useId();
    const stateErrorId = useId();
    const pincodeErrorId = useId();

    return (
        <div className="space-y-5">
            <div>
                <FL req>Pharmacy / Store Name</FL>
                <input
                    {...register("pharmacyName")}
                    placeholder="e.g. Apollo Pharmacy, MG Road"
                    className={inp(!!errors.pharmacyName)}
                    aria-invalid={errors.pharmacyName ? "true" : undefined}
                    aria-describedby={errors.pharmacyName ? pharmacyNameErrorId : undefined}
                />
                <FieldError messageId={pharmacyNameErrorId} msg={errors.pharmacyName?.message} />
            </div>
            <div>
                <FL req>Street Address</FL>
                <input
                    {...register("address")}
                    placeholder="e.g. 45, Park Street, Near Bus Stand"
                    className={inp(!!errors.address)}
                    aria-invalid={errors.address ? "true" : undefined}
                    aria-describedby={errors.address ? addressErrorId : undefined}
                />
                <FieldError messageId={addressErrorId} msg={errors.address?.message} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <FL req>City</FL>
                    <input
                        {...register("city")}
                        placeholder="Mumbai"
                        className={inp(!!errors.city)}
                        aria-invalid={errors.city ? "true" : undefined}
                        aria-describedby={errors.city ? cityErrorId : undefined}
                    />
                    <FieldError messageId={cityErrorId} msg={errors.city?.message} />
                </div>
                <div>
                    <FL req>State</FL>
                    <input
                        {...register("state")}
                        placeholder="Maharashtra"
                        className={inp(!!errors.state)}
                        aria-invalid={errors.state ? "true" : undefined}
                        aria-describedby={errors.state ? stateErrorId : undefined}
                    />
                    <FieldError messageId={stateErrorId} msg={errors.state?.message} />
                </div>
            </div>
            <div className="max-w-[160px]">
                <FL req>Pincode</FL>
                <input
                    {...register("pincode")}
                    placeholder="400001"
                    maxLength={6}
                    inputMode="numeric"
                    className={inp(!!errors.pincode)}
                    aria-invalid={errors.pincode ? "true" : undefined}
                    aria-describedby={errors.pincode ? pincodeErrorId : undefined}
                />
                <FieldError messageId={pincodeErrorId} msg={errors.pincode?.message} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS
// ─────────────────────────────────────────────────────────────────────────────
function Success({ onReset, reportId }: { onReset: () => void; reportId: string | null }) {
    const ref = reportId ? `RPT-${reportId.slice(0, 8).toUpperCase()}` : "RPT-PENDING";
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col items-center gap-6 py-12 text-center"
        >
            {/* Animated tick circle */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 22,
                    delay: 0.12,
                }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-100 bg-emerald-50 shadow-inner"
            >
                <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-emerald-500">
                    <path
                        d="M4 12.5l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </motion.div>

            <div className="space-y-2">
                <h3 className="text-2xl font-extrabold tracking-tight text-(--color-text-primary)">
                    Report Submitted
                </h3>
                <p className="mx-auto max-w-sm text-base leading-relaxed font-medium text-(--color-text-secondary)">
                    Your report has been securely received and will be reviewed by our
                    pharmacovigilance team within 48 hours.
                </p>
            </div>

            {/* Reference */}
            <div className="mx-auto w-full max-w-xs rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-6 py-4 shadow-sm">
                <p className="mb-1 text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                    Reference ID
                </p>
                <p className="text-lg font-bold tracking-wide text-(--color-text-primary)">{ref}</p>
            </div>

            <button
                type="button"
                onClick={onReset}
                className="mt-2 rounded-xl bg-emerald-50 px-6 py-2.5 text-sm font-bold text-emerald-600 transition-colors duration-200 hover:bg-emerald-100 hover:text-emerald-700 active:scale-95"
            >
                Submit another report
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportWizard() {
    const [step, setStep] = useState(1);
    const [dir, setDir] = useState(1);
    const [images, setImages] = useState<ImageEntry[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitErr, setSubmitErr] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [reportId, setReportId] = useState<string | null>(null);
    const submitErrorId = useId();

    // Cleanup blob URLs on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            images.forEach((i) => URL.revokeObjectURL(i.preview));
        };
    }, []);

    const methods = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: EMPTY,
        mode: "onTouched",
    });
    const { trigger, handleSubmit, reset } = methods;

    // Navigation
    const next = async () => {
        if (!(await trigger(STEP_KEYS[step]))) return;
        setDir(1);
        setStep((s) => s + 1);
    };
    const back = () => {
        setDir(-1);
        setStep((s) => s - 1);
    };

    // Submit
    const onSubmit = async (data: FormValues) => {
        setSubmitting(true);
        setSubmitErr(null);
        try {
            let token: string | undefined = undefined;
            if (typeof window !== "undefined") {
                try {
                    const supabase = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();
                    token = session?.access_token;
                } catch (err) {
                    // ignore if supabase is not configured
                }
            }
            const geo = await geocodePincode(data.pincode);
            const { report } = await submitReport({ ...data, ...(geo ?? {}) }, token);
            setReportId(report.id);
            setDone(true);
        } catch (e) {
            const errorMsg =
                e instanceof Error
                    ? e.message
                    : "Submission failed. Please check your connection and try again.";
            setSubmitErr(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Full reset
    const handleReset = () => {
        images.forEach((i) => URL.revokeObjectURL(i.preview));
        setImages([]);
        reset(EMPTY);
        setSubmitErr(null);
        setDone(false);
        setReportId(null);
        setStep(1);
        setDir(1);
    };

    return (
        <FormProvider {...methods}>
            {/* Semantic form wrapper — enables Enter-to-submit and screen reader identification */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Card */}
                <div className="mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-(--color-border-muted) bg-(--color-surface-page) font-sans shadow-xl dark:shadow-none">
                    {/* ── Header band ── */}
                    <div className="relative overflow-hidden bg-slate-900 px-8 pt-8 pb-7">
                        {/* Decorative blur */}
                        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl"></div>

                        {/* Top rule */}
                        <div className="relative z-10 mb-4 flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                                <Icon.ShieldCheck />
                            </div>
                            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                                MedWatch Report
                            </span>
                        </div>
                        <h2 className="relative z-10 text-3xl leading-tight font-extrabold tracking-tight text-white">
                            {done ? "Report Received" : STEPS[step - 1].title}
                        </h2>
                        {!done && (
                            <p className="relative z-10 mt-2 text-base font-medium text-slate-400">
                                {step === 1 && "Identify the suspicious product"}
                                {step === 2 && "Upload clear photos as evidence"}
                                {step === 3 && "Where was the product purchased?"}
                            </p>
                        )}
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 bg-(--color-surface-page) px-8 py-8">
                        {done ? (
                            <Success onReset={handleReset} reportId={reportId} />
                        ) : (
                            <>
                                <Progress current={step} />

                                {/* Animated step content */}
                                <div className="min-h-[300px] overflow-hidden">
                                    <AnimatePresence mode="wait" custom={dir}>
                                        <motion.div
                                            key={step}
                                            custom={dir}
                                            variants={PAGE}
                                            initial="enter"
                                            animate="show"
                                            exit="exit"
                                            className="pb-2"
                                        >
                                            {step === 1 && <Step1 />}
                                            {step === 2 && (
                                                <Step2 images={images} setImages={setImages} />
                                            )}
                                            {step === 3 && <Step3 />}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Submit-level error */}
                                <AnimatePresence>
                                    {submitErr && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <LiveMessage
                                                tone="critical"
                                                id={submitErrorId}
                                                className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 shadow-sm"
                                            >
                                                <span className="mt-0.5">
                                                    <Icon.Alert />
                                                </span>
                                                <span>{submitErr}</span>
                                            </LiveMessage>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* ── Nav buttons ── */}
                                <div className="mt-10 flex items-center justify-between border-t border-(--color-border-muted) pt-6">
                                    {/* Back */}
                                    <button
                                        type="button"
                                        onClick={back}
                                        disabled={step === 1 || submitting}
                                        className="flex items-center gap-2 rounded-xl border border-transparent px-5 py-2.5 text-sm font-bold text-(--color-text-secondary) transition-all duration-200 hover:border-(--color-border-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text-primary) active:scale-95 disabled:pointer-events-none disabled:opacity-0"
                                    >
                                        <Icon.Arrow left />
                                        Back
                                    </button>

                                    {/* Mobile count */}
                                    <span className="text-xs font-bold text-(--color-text-muted) sm:hidden">
                                        {step}/{STEPS.length}
                                    </span>

                                    {/* Next / Submit */}
                                    {step < 3 ? (
                                        <button
                                            type="button"
                                            onClick={next}
                                            disabled={submitting}
                                            className="flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition-all duration-200 hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:shadow-none dark:hover:bg-slate-200"
                                        >
                                            Continue <Icon.Arrow />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleSubmit(onSubmit)}
                                            disabled={submitting}
                                            className="flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {submitting ? (
                                                <>
                                                    <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                                                    Submitting…
                                                </>
                                            ) : (
                                                <>
                                                    Submit Report <Icon.Send />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}
