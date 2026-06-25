"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { HeartPulse, Loader2, Check } from "lucide-react";
import {
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlistByMedicineId,
} from "@/lib/api/watchlist";
import { toast } from "sonner";

const ACCESS_TOKEN_KEY = "sb-access-token";

interface SaveWatchlistButtonProps {
    medicineId: string;
    variant?: "full" | "compact" | "icon-only";
    className?: string;
}

export default function SaveWatchlistButton({
    medicineId,
    variant = "full",
    className = "",
}: SaveWatchlistButtonProps) {
    const t = useTranslations("Watchlist");
    const router = useRouter();

    const [isSaved, setIsSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        if (!medicineId) {
            setIsLoading(false);
            return;
        }

        const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!storedToken) {
            setIsLoading(false);
            return;
        }
        setToken(storedToken);

        fetchWatchlist(storedToken)
            .then((res) => {
                const found = res.watchlist.some((item) => item.medicine_id === medicineId);
                setIsSaved(found);
            })
            .catch((err) => {
                console.error("Error loading watch status:", err);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [medicineId]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!token) {
            toast.info("Please sign in to save medicines to your watchlist");
            router.push("/login");
            return;
        }

        setIsActionLoading(true);
        try {
            if (isSaved) {
                const res = await removeFromWatchlistByMedicineId(medicineId, token);
                if (res.success) {
                    setIsSaved(false);
                    toast.success(t("removeSuccess"));
                }
            } else {
                const res = await addToWatchlist({ medicine_id: medicineId }, token);
                if (res.success) {
                    setIsSaved(true);
                    toast.success(t("addSuccess"));
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) {
        if (variant === "icon-only") {
            return (
                <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-(--color-surface-muted) text-(--color-text-muted) ${className}`}
                >
                    <Loader2 size={16} className="animate-spin" />
                </div>
            );
        }
        return (
            <button
                disabled
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-4 py-3 text-xs font-bold text-(--color-text-muted) transition-all ${className}`}
            >
                <Loader2 size={14} className="animate-spin" />
                <span>{t("buttons.saving")}</span>
            </button>
        );
    }

    if (variant === "icon-only") {
        return (
            <button
                type="button"
                onClick={handleToggle}
                disabled={isActionLoading}
                aria-label={isSaved ? t("buttons.saved") : t("buttons.saveMedicine")}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all focus:outline-hidden ${
                    isSaved
                        ? "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400"
                        : "bg-(--color-surface-muted) text-(--color-text-muted) hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/10"
                } ${className}`}
            >
                {isActionLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    <HeartPulse size={18} fill={isSaved ? "currentColor" : "none"} />
                )}
            </button>
        );
    }

    if (variant === "compact") {
        return (
            <button
                type="button"
                onClick={handleToggle}
                disabled={isActionLoading}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all focus:outline-hidden ${
                    isSaved
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : "border-(--color-border-muted) bg-(--color-surface-muted) text-(--color-text-secondary) hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                } ${className}`}
            >
                {isActionLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : isSaved ? (
                    <Check size={14} className="stroke-[3]" />
                ) : (
                    <HeartPulse size={14} />
                )}
                <span>{isSaved ? t("buttons.saved") : t("buttons.saveMedicine")}</span>
            </button>
        );
    }

    // Default Full variant
    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={isActionLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black transition-all focus:outline-hidden ${
                isSaved
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-emerald-600 text-white shadow-lg hover:bg-emerald-500"
            } ${className}`}
        >
            {isActionLoading ? (
                <Loader2 size={16} className="animate-spin" />
            ) : isSaved ? (
                <Check size={16} className="stroke-[3]" />
            ) : (
                <HeartPulse size={16} />
            )}
            <span>{isSaved ? t("buttons.saved") : t("buttons.saveMedicine")}</span>
        </button>
    );
}
