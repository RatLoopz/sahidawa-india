"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
    HeartPulse,
    ArrowLeft,
    Loader2,
    Trash2,
    Eye,
    TrendingDown,
    AlertTriangle,
    ShieldAlert,
    Pill,
    MapPin,
    CheckCircle,
} from "lucide-react";
import {
    fetchWatchlist,
    updateWatchlistPreferences,
    removeFromWatchlist,
    type WatchlistItem,
} from "@/lib/api/watchlist";
import { toast } from "sonner";

const ACCESS_TOKEN_KEY = "sb-access-token";

export default function WatchlistPage() {
    const t = useTranslations("Watchlist");
    const router = useRouter();
    const params = useParams();
    const locale = Array.isArray(params.locale) ? params.locale[0] : params.locale || "en";

    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!storedToken) {
            toast.error("Please sign in to view your watchlist");
            router.push("/login");
            return;
        }
        setToken(storedToken);

        fetchWatchlist(storedToken)
            .then((res) => {
                setWatchlist(res.watchlist);
            })
            .catch((err) => {
                console.error("Failed to load watchlist:", err);
                toast.error(err.message || "Failed to load watchlist");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [router]);

    const handlePreferenceToggle = async (
        itemId: string,
        key: keyof Omit<
            WatchlistItem,
            "id" | "user_id" | "medicine_id" | "created_at" | "medicine"
        >,
        currentValue: boolean
    ) => {
        if (!token) return;

        setUpdatingItems((prev) => ({ ...prev, [itemId]: true }));
        try {
            const updatedValue = !currentValue;
            const res = await updateWatchlistPreferences(itemId, { [key]: updatedValue }, token);

            if (res.success) {
                setWatchlist((prev) =>
                    prev.map((item) =>
                        item.id === itemId ? { ...item, [key]: updatedValue } : item
                    )
                );
                toast.success(t("updateSuccess"));
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update preference");
        } finally {
            setUpdatingItems((prev) => ({ ...prev, [itemId]: false }));
        }
    };

    const handleRemove = async (itemId: string, brandName: string) => {
        if (!token) return;
        if (!confirm(t("removeConfirm"))) return;

        try {
            const res = await removeFromWatchlist(itemId, token);
            if (res.success) {
                setWatchlist((prev) => prev.filter((item) => item.id !== itemId));
                toast.success(`${brandName} ${t("removeSuccess")}`);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to remove medicine");
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-grow items-center justify-center bg-(--color-surface-muted) py-24">
                <div className="flex flex-col items-center gap-3 text-(--color-text-secondary)">
                    <Loader2
                        className="animate-spin text-emerald-600 dark:text-emerald-400"
                        size={36}
                    />
                    <p className="font-semibold">Loading watchlist...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow bg-(--color-surface-muted) px-4 py-8 text-(--color-text-primary) sm:px-6">
            <div className="mx-auto max-w-4xl">
                {/* Back Button */}
                <Link
                    href="/profile"
                    className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-(--color-text-secondary) transition-all hover:bg-(--color-surface-page) hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:hover:text-emerald-400"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Profile</span>
                </Link>

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400">
                        <HeartPulse size={30} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-(--color-text-primary) sm:text-3xl">
                            {t("title")}
                        </h1>
                        <p className="mt-1 text-sm text-(--color-text-secondary)">
                            {t("subtitle")}
                        </p>
                    </div>
                </div>

                {watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) px-6 py-16 text-center shadow-xs">
                        <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">
                            <HeartPulse size={48} className="stroke-1" />
                        </div>
                        <h2 className="text-xl font-bold text-(--color-text-primary)">
                            {t("emptyState")}
                        </h2>
                        <p className="mt-2 max-w-sm text-sm text-(--color-text-secondary)">
                            {t("searchHint")}
                        </p>
                        <Link
                            href="/"
                            className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                            Find Medicines
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {watchlist.map((item) => {
                            const med = item.medicine;
                            if (!med) return null;

                            const isRecall =
                                med.cdsco_approval_status === "recalled" ||
                                med.cdsco_approval_status === "banned";

                            return (
                                <div
                                    key={item.id}
                                    className="overflow-hidden rounded-3xl border border-(--color-border-muted) bg-(--color-surface-page) shadow-xs transition duration-200 hover:shadow-md"
                                >
                                    {/* Top Bar for Alert status */}
                                    {isRecall && (
                                        <div className="flex items-center gap-2 bg-red-500 px-6 py-2 text-xs font-bold text-white uppercase">
                                            <ShieldAlert size={14} />
                                            <span>CDSCO Alert: {med.cdsco_approval_status}</span>
                                        </div>
                                    )}

                                    <div className="p-6">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            {/* Medicine Info */}
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-extrabold text-(--color-text-primary)">
                                                    {med.brand_name}
                                                </h3>
                                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {med.generic_name}
                                                </p>
                                                <p className="text-xs text-(--color-text-secondary)">
                                                    {med.manufacturer}
                                                </p>
                                                <p className="pt-2 text-[10px] font-bold tracking-wide text-(--color-text-muted) uppercase">
                                                    {t("fields.savedDate")}:{" "}
                                                    {new Date(item.created_at).toLocaleDateString(
                                                        undefined,
                                                        {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric",
                                                        }
                                                    )}
                                                </p>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                                                <button
                                                    onClick={() =>
                                                        router.push(
                                                            `/${locale}?query=${encodeURIComponent(med.brand_name)}`
                                                        )
                                                    }
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2 text-xs font-bold text-(--color-text-secondary) transition hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                                                >
                                                    <Eye size={14} />
                                                    {t("buttons.viewDetails")}
                                                </button>
                                                <Link
                                                    href={`/calculator?medicineId=${med.id}`}
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2 text-xs font-bold text-(--color-text-secondary) transition hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                                                >
                                                    <Pill size={14} />
                                                    {t("buttons.viewAlternatives")}
                                                </Link>
                                                <button
                                                    onClick={() =>
                                                        handleRemove(item.id, med.brand_name)
                                                    }
                                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-transparent px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/20"
                                                >
                                                    <Trash2 size={14} />
                                                    {t("buttons.remove")}
                                                </button>
                                            </div>
                                        </div>

                                        <hr className="my-5 border-(--color-border-muted)" />

                                        {/* Preferences Section */}
                                        <div>
                                            <h4 className="mb-3 text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                                                {t("fields.notifications")}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {/* Price Changes */}
                                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 transition hover:border-emerald-500/30">
                                                    <input
                                                        type="checkbox"
                                                        disabled={updatingItems[item.id]}
                                                        checked={item.notify_price_change}
                                                        onChange={() =>
                                                            handlePreferenceToggle(
                                                                item.id,
                                                                "notify_price_change",
                                                                item.notify_price_change
                                                            )
                                                        }
                                                        className="mt-0.5 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <div>
                                                        <span className="block text-xs font-bold text-(--color-text-primary)">
                                                            {t("preferences.priceChange")}
                                                        </span>
                                                        <span className="block text-[10px] text-(--color-text-muted)">
                                                            Get alerted if MRP changes
                                                        </span>
                                                    </div>
                                                </label>

                                                {/* Recalls */}
                                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 transition hover:border-emerald-500/30">
                                                    <input
                                                        type="checkbox"
                                                        disabled={updatingItems[item.id]}
                                                        checked={item.notify_recall}
                                                        onChange={() =>
                                                            handlePreferenceToggle(
                                                                item.id,
                                                                "notify_recall",
                                                                item.notify_recall
                                                            )
                                                        }
                                                        className="mt-0.5 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <div>
                                                        <span className="block text-xs font-bold text-(--color-text-primary)">
                                                            {t("preferences.recall")}
                                                        </span>
                                                        <span className="block text-[10px] text-(--color-text-muted)">
                                                            CDSCO warnings & recall notices
                                                        </span>
                                                    </div>
                                                </label>

                                                {/* Alternatives */}
                                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 transition hover:border-emerald-500/30">
                                                    <input
                                                        type="checkbox"
                                                        disabled={updatingItems[item.id]}
                                                        checked={item.notify_new_alternative}
                                                        onChange={() =>
                                                            handlePreferenceToggle(
                                                                item.id,
                                                                "notify_new_alternative",
                                                                item.notify_new_alternative
                                                            )
                                                        }
                                                        className="mt-0.5 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <div>
                                                        <span className="block text-xs font-bold text-(--color-text-primary)">
                                                            {t("preferences.newAlternative")}
                                                        </span>
                                                        <span className="block text-[10px] text-(--color-text-muted)">
                                                            Lower-priced generic alternatives
                                                        </span>
                                                    </div>
                                                </label>

                                                {/* Stock Availability */}
                                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3 transition hover:border-emerald-500/30">
                                                    <input
                                                        type="checkbox"
                                                        disabled={updatingItems[item.id]}
                                                        checked={item.notify_stock_availability}
                                                        onChange={() =>
                                                            handlePreferenceToggle(
                                                                item.id,
                                                                "notify_stock_availability",
                                                                item.notify_stock_availability
                                                            )
                                                        }
                                                        className="mt-0.5 rounded border-(--color-border-muted) text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <div>
                                                        <span className="block text-xs font-bold text-(--color-text-primary)">
                                                            {t("preferences.stockAvailability")}
                                                        </span>
                                                        <span className="block text-[10px] text-(--color-text-muted)">
                                                            Availability in nearby pharmacies
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
