"use client";

/**
 * ReportWizard.tsx
 * 3-step wizard to report suspicious / fake medicines.
 * Tech: React Hook Form · Zod · @hookform/resolvers · Framer Motion · Tailwind CSS
 * Design: SahiDawa modern aesthetic — emerald accents, deep navy header, rounded corners
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence, Variants } from "framer-motion";

// ─── Cloudinary env ────────────────────────────────────────────────────────────
// ⚠️ SECURITY NOTE: These credentials use an "unsigned" Cloudinary upload preset.
// This means the upload goes directly from the browser to Cloudinary without
// server-side validation. Anyone who inspects the source code could extract these
// values and upload arbitrary files to the Cloudinary account.
// For production, migrate to a "signed" upload flow via a server-side API route
// (e.g. /api/upload) that signs each request with CLOUDINARY_API_SECRET.
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file

// ─── Input sanitisation ────────────────────────────────────────────────────────
/** Strip HTML/script tags and trim whitespace to prevent stored XSS. */
const sanitize = (v: string) => v.replace(/<[^>]*>/g, "").trim();

// ─── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  medicineName: z.string().transform(sanitize).pipe(z.string().min(2, "At least 2 characters required")),
  manufacturer: z.string().transform(sanitize).pipe(z.string().min(2, "At least 2 characters required")),
  description: z.string().transform(sanitize).pipe(z.string().min(20, "Please provide at least 20 characters")),
  images: z.array(z.string().url()).min(1, "At least one photo is required"),
  pharmacyName: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
  address: z.string().transform(sanitize).pipe(z.string().min(5, "Required")),
  city: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
  state: z.string().transform(sanitize).pipe(z.string().min(2, "Required")),
  pincode: z.string().transform(sanitize).pipe(z.string().regex(/^\d{6}$/, "Must be exactly 6 digits")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  medicineName: "", manufacturer: "", description: "",
  images: [],
  pharmacyName: "", address: "", city: "", state: "", pincode: "",
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
  preview: string;   // blob URL
  cloudUrl: string;  // Cloudinary secure_url
  name: string;
}

// ─── Animation variants ────────────────────────────────────────────────────────
const PAGE: Variants = {
  enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
  show: { x: 0, opacity: 1, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  exit: (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0, transition: { duration: 0.18 } }),
};

// ─── Tiny inline icons ─────────────────────────────────────────────────────────
const Icon = {
  Check: () => (
    <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
      <path d="M2 6.5l2.8 2.8L10 3.5" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Alert: () => (
    <svg viewBox="0 0 12 12" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M6 0a6 6 0 100 12A6 6 0 006 0zm0 8.5a.65.65 0 110 1.3.65.65 0 010-1.3zM5.35 3.8a.65.65 0 011.3 0v3a.65.65 0 01-1.3 0v-3z" />
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.5v2A1.5 1.5 0 004.5 17h11a1.5 1.5 0 001.5-1.5v-2M10 3v9m-3.5-3L10 3l3.5 3" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-2.5 h-2.5">
      <path strokeLinecap="round" d="M1 1l8 8M9 1L1 9" />
    </svg>
  ),
  Arrow: ({ left }: { left?: boolean }) => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"
      className="w-3.5 h-3.5 flex-shrink-0">
      {left
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 2L4 7l5 5" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M5 2l5 5-5 5" />}
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 7h11M8 2.5l4.5 4.5L8 11.5" />
    </svg>
  ),
  ShieldCheck: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
};

// ─── Field error ───────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.span
          initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-500 mt-1.5"
        >
          <Icon.Alert />{msg}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ─── Label ─────────────────────────────────────────────────────────────────────
function FL({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <label className="block text-sm font-bold text-slate-700 mb-2">
      {children}{req && <span className="ml-1.5 text-emerald-500">*</span>}
    </label>
  );
}

// ─── Base input classes ────────────────────────────────────────────────────────
const inp = (err?: boolean) =>
  `w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-800 font-medium
   placeholder-slate-400 outline-none transition-all duration-200
   focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500
   ${err ? "border-red-300 focus:border-red-400 focus:ring-red-500/10" : "border-slate-200 hover:border-slate-300"}`;

// ─── Step progress bar ─────────────────────────────────────────────────────────
function Progress({ current }: { current: number }) {
  const pct = ((current - 1) / 2) * 100;
  return (
    <div className="mb-8">
      {/* Bar */}
      <div className="relative h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
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
            <div key={s.n}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-bold
                transition-all duration-200 select-none
                ${done
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : active
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-400"}`}
            >
              {done
                ? <><Icon.Check />{s.code}</>
                : <><span className={active ? "text-emerald-400" : "text-slate-300"}>{s.n}</span>{s.code}</>}
            </div>
          );
        })}
        {/* Step label */}
        <span className="ml-auto self-center text-xs font-semibold text-slate-500 whitespace-nowrap">
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
  const { register, formState: { errors } } = useFormContext<FormValues>();
  return (
    <div className="space-y-5">
      <div>
        <FL req>Medicine Name</FL>
        <input {...register("medicineName")} placeholder="e.g. Augmentin 625 Duo"
          className={inp(!!errors.medicineName)} />
        <FieldError msg={errors.medicineName?.message} />
      </div>
      <div>
        <FL req>Manufacturer</FL>
        <input {...register("manufacturer")} placeholder="e.g. Cipla Ltd."
          className={inp(!!errors.manufacturer)} />
        <FieldError msg={errors.manufacturer?.message} />
      </div>
      <div>
        <FL req>Description of Concern</FL>
        <textarea {...register("description")} rows={4}
          placeholder="Describe unusual colour, smell, texture, packaging, reported side-effects…"
          className={`${inp(!!errors.description)} resize-none`} />
        <FieldError msg={errors.description?.message} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2
// ─────────────────────────────────────────────────────────────────────────────
function Step2({
  images, setImages,
}: {
  images: ImageEntry[];
  setImages: React.Dispatch<React.SetStateAction<ImageEntry[]>>;
}) {
  const { setValue, formState: { errors } } = useFormContext<FormValues>();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const imgErr = errors.images?.message as string | undefined;

  // Upload one file to Cloudinary
  const uploadOne = async (file: File): Promise<string> => {
    if (!CLOUD_NAME || !UPLOAD_PRESET)
      throw new Error("Cloudinary env vars missing — check .env.local");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: fd }
    );
    if (!res.ok) {
      const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(e.error?.message ?? `HTTP ${res.status}`);
    }
    return ((await res.json()) as { secure_url: string }).secure_url;
  };

  const processFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith("image/"));
    if (!imgs.length) { setUpErr("Only image files are accepted."); return; }
    const oversized = imgs.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setUpErr(`File${oversized.length > 1 ? "s" : ""} too large (max 10 MB): ${oversized.map(f => f.name).join(", ")}`);
      return;
    }
    setUpErr(null);
    setBusy(true);
    try {
      const entries: ImageEntry[] = await Promise.all(
        imgs.map(async (f) => ({
          preview: URL.createObjectURL(f),
          cloudUrl: await uploadOne(f),
          name: f.name,
        }))
      );
      const next = [...images, ...entries];
      setImages(next);
      setValue("images", next.map(i => i.cloudUrl), { shouldValidate: true });
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : "Upload failed. Please retry.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, setImages, setValue]);

  const remove = (idx: number) => {
    URL.revokeObjectURL(images[idx].preview);
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    setValue("images", next.map(i => i.cloudUrl), { shouldValidate: true });
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => !busy && ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); processFiles(Array.from(e.dataTransfer.files)); }}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
          py-12 px-6 text-center transition-all duration-200
          ${drag ? "border-emerald-500 bg-emerald-50 scale-[1.01]" : "border-slate-200 hover:border-emerald-300 bg-slate-50/50"}
          ${busy ? "cursor-wait" : "cursor-pointer"}`}
      >
        <input ref={ref} type="file" accept="image/*" multiple className="hidden"
          onChange={e => processFiles(Array.from(e.target.files ?? []))} disabled={busy} />

        {busy ? (
          <>
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-emerald-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Uploading to secure storage…</p>
          </>
        ) : (
          <>
            <span className="text-slate-400 bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-1"><Icon.Upload /></span>
            <div>
              <p className="text-base font-bold text-slate-700">
                Drop images or <span className="text-emerald-600 underline underline-offset-2">select files</span>
              </p>
              <p className="text-sm text-slate-500 mt-1 font-medium">JPG · PNG · WEBP &nbsp;·&nbsp; Multiple files OK</p>
            </div>
          </>
        )}
      </div>

      {/* Upload error */}
      <AnimatePresence>
        {upErr && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            <span className="mt-0.5"><Icon.Alert /></span>{upErr}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zod error (no images) */}
      {!upErr && <FieldError msg={imgErr} />}

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-2">
          <AnimatePresence>
            {images.map((img, idx) => (
              <motion.div key={img.cloudUrl}
                initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.18 }}
                className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                {/* Remove overlay */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100
                  transition-opacity flex items-center justify-center">
                  <button type="button" onClick={(e) => { e.stopPropagation(); remove(idx); }}
                    className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 shadow-md transition-all active:scale-95
                      flex items-center justify-center text-white" aria-label="Remove">
                    <Icon.X />
                  </button>
                </div>
                {/* Name bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 px-2 py-1.5
                  translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-[10px] text-white/90 font-medium truncate">{img.name}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {images.length === 0 && !busy && (
        <p className="text-center text-sm font-medium text-slate-400">
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
  const { register, formState: { errors } } = useFormContext<FormValues>();
  return (
    <div className="space-y-5">
      <div>
        <FL req>Pharmacy / Store Name</FL>
        <input {...register("pharmacyName")} placeholder="e.g. Apollo Pharmacy, MG Road"
          className={inp(!!errors.pharmacyName)} />
        <FieldError msg={errors.pharmacyName?.message} />
      </div>
      <div>
        <FL req>Street Address</FL>
        <input {...register("address")} placeholder="e.g. 45, Park Street, Near Bus Stand"
          className={inp(!!errors.address)} />
        <FieldError msg={errors.address?.message} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FL req>City</FL>
          <input {...register("city")} placeholder="Mumbai" className={inp(!!errors.city)} />
          <FieldError msg={errors.city?.message} />
        </div>
        <div>
          <FL req>State</FL>
          <input {...register("state")} placeholder="Maharashtra" className={inp(!!errors.state)} />
          <FieldError msg={errors.state?.message} />
        </div>
      </div>
      <div className="max-w-[160px]">
        <FL req>Pincode</FL>
        <input {...register("pincode")} placeholder="400001" maxLength={6}
          inputMode="numeric" className={inp(!!errors.pincode)} />
        <FieldError msg={errors.pincode?.message} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS
// ─────────────────────────────────────────────────────────────────────────────
function Success({ onReset }: { onReset: () => void }) {
  const ref = `RPT-${crypto.randomUUID().split("-")[0].toUpperCase()}`;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="py-12 flex flex-col items-center gap-6 text-center"
    >
      {/* Animated tick circle */}
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.12 }}
        className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100
          flex items-center justify-center shadow-inner"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-emerald-500">
          <path d="M4 12.5l5 5L20 7" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <div className="space-y-2">
        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Report Submitted</h3>
        <p className="text-base text-slate-500 font-medium max-w-sm leading-relaxed mx-auto">
          Your report has been securely received and will be reviewed by our
          pharmacovigilance team within 48 hours.
        </p>
      </div>

      {/* Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 shadow-sm w-full max-w-xs mx-auto">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Reference ID</p>
        <p className="text-lg font-bold text-slate-800 tracking-wide">{ref}</p>
      </div>

      <button type="button" onClick={onReset}
        className="mt-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-6 py-2.5 rounded-xl transition-colors duration-200 active:scale-95">
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

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach(i => URL.revokeObjectURL(i.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    mode: "onTouched",
  });
  const { trigger, handleSubmit, reset } = methods;

  // Navigation
  const next = async () => {
    if (!await trigger(STEP_KEYS[step])) return;
    setDir(1);
    setStep(s => s + 1);
  };
  const back = () => { setDir(-1); setStep(s => s - 1); };

  // Submit
  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      await new Promise<void>(r => setTimeout(r, 1600)); // simulate API
      console.log("🚨 Fake Medicine Report:", JSON.stringify(data, null, 2));
      setDone(true);
    } catch {
      setSubmitErr("Submission failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Full reset
  const handleReset = () => {
    images.forEach(i => URL.revokeObjectURL(i.preview));
    setImages([]);
    reset(EMPTY);
    setSubmitErr(null);
    setDone(false);
    setStep(1);
    setDir(1);
  };

  return (
    <FormProvider {...methods}>
      {/* Semantic form wrapper — enables Enter-to-submit and screen reader identification */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Card */}
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl
        shadow-xl shadow-slate-200/50 border border-slate-200
        overflow-hidden flex flex-col font-sans">

        {/* ── Header band ── */}
        <div className="bg-slate-900 px-8 pt-8 pb-7 relative overflow-hidden">
          {/* Decorative blur */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>

          {/* Top rule */}
          <div className="relative z-10 flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Icon.ShieldCheck />
            </div>
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">
              MedWatch Report
            </span>
          </div>
          <h2 className="relative z-10 text-3xl font-extrabold text-white tracking-tight leading-tight">
            {done ? "Report Received" : STEPS[step - 1].title}
          </h2>
          {!done && (
            <p className="relative z-10 text-base text-slate-400 font-medium mt-2">
              {step === 1 && "Identify the suspicious product"}
              {step === 2 && "Upload clear photos as evidence"}
              {step === 3 && "Where was the product purchased?"}
            </p>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-8 py-8 bg-white flex-1">
          {done ? (
            <Success onReset={handleReset} />
          ) : (
            <>
              <Progress current={step} />

              {/* Animated step content */}
              <div className="overflow-hidden min-h-[300px]">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div key={step} custom={dir}
                    variants={PAGE} initial="enter" animate="show" exit="exit"
                    className="pb-2"
                  >
                    {step === 1 && <Step1 />}
                    {step === 2 && <Step2 images={images} setImages={setImages} />}
                    {step === 3 && <Step3 />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Submit-level error */}
              <AnimatePresence>
                {submitErr && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 flex gap-3 items-start bg-red-50 border border-red-200
                      rounded-xl px-5 py-4 text-sm font-medium text-red-600 shadow-sm">
                    <span className="mt-0.5"><Icon.Alert /></span>
                    <span>{submitErr}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Nav buttons ── */}
              <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
                {/* Back */}
                <button type="button" onClick={back} disabled={step === 1 || submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
                    text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent
                    hover:border-slate-200 transition-all duration-200 active:scale-95
                    disabled:opacity-0 disabled:pointer-events-none">
                  <Icon.Arrow left />Back
                </button>

                {/* Mobile count */}
                <span className="text-xs font-bold text-slate-400 sm:hidden">{step}/{STEPS.length}</span>

                {/* Next / Submit */}
                {step < 3 ? (
                  <button type="button" onClick={next} disabled={submitting}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800
                      text-white font-bold text-sm px-7 py-3 rounded-xl
                      transition-all duration-200 active:scale-95 shadow-md shadow-slate-900/10
                      disabled:opacity-50 disabled:cursor-not-allowed">
                    Continue <Icon.Arrow />
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit(onSubmit)} disabled={submitting}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700
                      text-white font-bold text-sm px-7 py-3 rounded-xl
                      transition-all duration-200 active:scale-95
                      shadow-lg shadow-emerald-600/20
                      disabled:opacity-60 disabled:cursor-not-allowed border border-emerald-500">
                    {submitting ? (
                      <>
                        <span className="w-5 h-5 border-[3px] border-white/30 border-t-white
                          rounded-full animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>Submit Report <Icon.Send /></>
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
