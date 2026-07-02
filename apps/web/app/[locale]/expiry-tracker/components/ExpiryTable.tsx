import { Calendar, Package, Pencil, Trash2 } from "lucide-react";

import { parseLocalDate } from "./dateUtils";
import type { ExpiryStatus, Medicine } from "./types";

interface ExpiryTableProps {
    t: (key: string, values?: Record<string, string>) => string;
    medicines: Medicine[];
    isLoaded: boolean;
    selectedIds: Set<string>;
    getExpiryStatus: (dateStr: string) => ExpiryStatus;
    onToggleSelect: (id: string) => void;
    onStartEdit: (medicine: Medicine) => void;
    onDelete: (id: string) => void;
}

export function ExpiryTable({
    t,
    medicines,
    isLoaded,
    selectedIds,
    getExpiryStatus,
    onToggleSelect,
    onStartEdit,
    onDelete,
}: ExpiryTableProps) {
    if (!isLoaded) {
        return (
            <div className="py-20 text-center opacity-50">
                <p className="animate-pulse">{t("loading")}</p>
            </div>
        );
    }

    if (medicines.length === 0) {
        return (
            <div className="rounded-3xl border-2 border-dashed border-(--color-border-muted) bg-(--color-surface-muted) py-20 text-center opacity-50">
                <Package size={48} className="mx-auto mb-2 opacity-50" />
                <p>{t("noMedicines")}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {medicines.map((medicine) => {
                const status = getExpiryStatus(medicine.expiryDate);
                return (
                    <div
                        key={medicine.id}
                        className="flex items-center justify-between rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-5 shadow-sm transition-all hover:border-emerald-500/50"
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedIds.has(medicine.id)}
                                onChange={() => onToggleSelect(medicine.id)}
                                aria-label={t("selectMedicine", {
                                    name: medicine.name,
                                })}
                                className="h-4 w-4 cursor-pointer accent-emerald-600"
                            />
                            <div className="space-y-1">
                                <h3 className="text-lg leading-tight font-bold">{medicine.name}</h3>
                                <div className="flex items-center gap-3 text-sm opacity-70">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} />{" "}
                                        {parseLocalDate(medicine.expiryDate).toLocaleDateString()}
                                    </span>
                                    {medicine.batchNumber && (
                                        <span className="flex items-center gap-1">
                                            <Package size={14} /> {medicine.batchNumber}
                                        </span>
                                    )}
                                </div>
                                {medicine.notes && (
                                    <p className="mt-2 border-l-2 border-emerald-500/30 pl-2 text-sm italic opacity-60">
                                        {medicine.notes}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span
                                className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold ${status.color}`}
                            >
                                {status.icon} {status.text}
                            </span>
                            <button
                                onClick={() => onStartEdit(medicine)}
                                className="rounded-full p-2 transition-colors hover:bg-emerald-500/10"
                            >
                                <Pencil size={18} className="text-emerald-500" />
                            </button>
                            <button
                                onClick={() => onDelete(medicine.id)}
                                className="rounded-full p-2 transition-colors hover:bg-red-500/10"
                            >
                                <Trash2 size={18} className="text-red-500" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
