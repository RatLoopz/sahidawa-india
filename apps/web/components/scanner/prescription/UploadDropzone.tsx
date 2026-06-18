import React from "react";
import { Upload } from "lucide-react";

interface UploadDropzoneProps {
    isDragOver: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function UploadDropzone({
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileChange,
    fileInputRef,
}: UploadDropzoneProps) {
    return (
        <button
            type="button"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
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
                onChange={onFileChange}
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
    );
}
