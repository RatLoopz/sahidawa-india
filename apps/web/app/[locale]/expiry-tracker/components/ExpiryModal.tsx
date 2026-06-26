import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { X } from "lucide-react";
import { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ExpiryModalProps {
    isOpen: boolean;
    isVerifying: boolean;
    apiError: string | null;
    onClose: () => void;
    onScan: (scannedText: string) => void;
    onRetry: () => void;
}

export function ExpiryModal({
    isOpen,
    isVerifying,
    apiError,
    onClose,
    onScan,
    onRetry,
}: ExpiryModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    useFocusTrap(containerRef, isOpen);

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expiry-tracker-scanner-title"
        >
            <div className="relative flex h-[80vh] w-full max-w-2xl flex-col rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-2xl dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                    <h3
                        id="expiry-tracker-scanner-title"
                        className="text-xl font-bold text-(--color-text-primary)"
                    >
                        Scan Medicine Barcode
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <span className="sr-only">Close</span>
                        <X size={20} />
                    </button>
                </div>
                <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
                    <BarcodeScanner
                        onScan={onScan}
                        debounceMs={2500}
                        isVerifying={isVerifying}
                        apiError={apiError}
                        onRetry={onRetry}
                    />
                </div>
                <div className="mt-4 text-center text-sm text-(--color-text-secondary)">
                    Align the medicine barcode within the camera view to scan.
                </div>
            </div>
        </div>
    );
}
