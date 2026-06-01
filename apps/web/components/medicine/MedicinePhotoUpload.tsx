"use client";

import {
    useCallback,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent,
    type RefObject,
} from "react";
import { AlertCircle, Camera, CheckCircle, Upload, X } from "lucide-react";

import { useUpload } from "./useUpload";
import { validateMedicineFile, MAX_IMAGE_SIZE_BYTES } from "./validateMedicineFile";

export interface MedicinePhotoUploadProps {
    onUploadComplete: (secureUrl: string) => void;
    onError?: (error: string) => void;
    label?: string;
    disabled?: boolean;
}

interface UploadDropzoneProps {
    onFileSelected: (file: File) => void;
    disabled: boolean;
    label: string;
    inputId: string;
    inputRef: RefObject<HTMLInputElement | null>;
}

function UploadDropzone({
    onFileSelected,
    disabled,
    label,
    inputId,
    inputRef,
}: UploadDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);

    const openFilePicker = useCallback(() => {
        if (!disabled) {
            inputRef.current?.click();
        }
    }, [disabled, inputRef]);

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
        }
    };

    const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
        if (disabled) return;
        event.preventDefault();
        setIsDragOver(false);
        const file = event.dataTransfer.files[0];
        if (file) {
            onFileSelected(file);
        }
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) {
            onFileSelected(file);
        }
    };

    return (
        <div>
            <label htmlFor={inputId} className="sr-only">
                Upload medicine photo
            </label>
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                disabled={disabled}
                onChange={handleInputChange}
            />
            <button
                type="button"
                tabIndex={0}
                disabled={disabled}
                aria-label={`${label} — click or drag and drop`}
                aria-disabled={disabled}
                onClick={openFilePicker}
                onKeyDown={handleKeyDown}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    isDragOver
                        ? "border-blue-500 bg-blue-50/50"
                        : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40"
                }`}
            >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Upload className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-center">
                    <span className="block text-sm font-semibold text-slate-800">{label}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                        JPG, PNG, or WebP · max {MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB · tap to capture on mobile
                    </span>
                </span>
                <Camera className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
        </div>
    );
}

interface UploadProgressBarProps {
    progress: number;
}

function UploadProgressBar({ progress }: UploadProgressBarProps) {
    return (
        <div className="space-y-2">
            <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            >
                <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="text-center text-sm text-slate-600">{progress}%</p>
        </div>
    );
}

interface ImagePreviewProps {
    src: string;
    onRemove: () => void;
}

function ImagePreview({ src, onRemove }: ImagePreviewProps) {
    return (
        <div className="space-y-3">
            <img
                src={src}
                alt="Uploaded medicine packaging"
                className="max-h-64 w-full rounded-xl border border-slate-200 object-contain"
            />
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove uploaded photo"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                <X className="h-4 w-4" aria-hidden="true" />
                Remove / Re-upload
            </button>
        </div>
    );
}

function getLiveStatusText(
    validationError: string | null,
    state: ReturnType<typeof useUpload>["state"]
): string {
    if (validationError) {
        return `Upload failed: ${validationError}`;
    }

    switch (state.status) {
        case "uploading":
            return `Uploading… ${state.progress}%`;
        case "success":
            return "Upload complete";
        case "error":
            return `Upload failed: ${state.message}`;
        default:
            return "";
    }
}

export function MedicinePhotoUpload({
    onUploadComplete,
    onError,
    label = "Upload Medicine Photo",
    disabled = false,
}: MedicinePhotoUploadProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const { state, upload, reset, cancel } = useUpload(onUploadComplete);

    const isUploading = state.status === "uploading";
    const isDisabled = disabled || isUploading;

    const handleFileSelected = useCallback(
        (file: File) => {
            const result = validateMedicineFile(file);
            if (!result.valid) {
                setValidationError(result.error);
                onError?.(result.error);
                return;
            }

            setValidationError(null);
            void upload(file);
        },
        [onError, upload]
    );

    const handleTryAgain = () => {
        setValidationError(null);
        reset();
        inputRef.current?.click();
    };

    const handleReset = () => {
        setValidationError(null);
        reset();
    };

    const errorMessage = validationError ?? (state.status === "error" ? state.message : null);

    const liveStatusText = getLiveStatusText(validationError, state);

    return (
        <div className="space-y-4">
            <div aria-live="polite" className="sr-only">
                {liveStatusText}
            </div>

            {(state.status === "idle" || state.status === "error" || validationError) &&
                state.status !== "success" && (
                    <UploadDropzone
                        onFileSelected={handleFileSelected}
                        disabled={isDisabled}
                        label={label}
                        inputId={inputId}
                        inputRef={inputRef}
                    />
                )}

            {state.status === "uploading" && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-700">Uploading your photo…</p>
                    <UploadProgressBar progress={state.progress} />
                    <button
                        type="button"
                        onClick={cancel}
                        className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        Cancel upload
                    </button>
                </div>
            )}

            {state.status === "success" && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <CheckCircle className="h-4 w-4" aria-hidden="true" />
                        Upload complete
                    </div>
                    <ImagePreview src={state.secureUrl} onRemove={handleReset} />
                </div>
            )}

            {errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600"
                            aria-hidden="true"
                        />
                        <div className="flex-1 space-y-3">
                            <p className="text-sm text-red-800">{errorMessage}</p>
                            <button
                                type="button"
                                onClick={handleTryAgain}
                                aria-label="Try uploading again"
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
