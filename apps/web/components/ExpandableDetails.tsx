"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { VerifiedMedicine } from "@/lib/api";
import { CopyButton } from "@/components/ui/CopyButton";

export function ExpandableDetails({ medicine }: { medicine: VerifiedMedicine }) {
    const [expanded, setExpanded] = useState(false);
    const tScan = useTranslations("Scan");
    const copyText = [
        `Brand: ${medicine.brand_name}`,
        `Generic: ${medicine.generic_name}`,
        `Manufacturer: ${medicine.manufacturer}`,
        `Batch: ${medicine.batch_number}`,
        medicine.dosage_form ? `Dosage Form: ${medicine.dosage_form}` : null,
        medicine.composition ? `Composition: ${medicine.composition}` : null,
    ]
        .filter(Boolean)
        .join("\n");

    return (
        <div className="w-full">
            <button
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-controls="medicine-details-panel"
                className="flex items-center gap-1 text-sm text-(--color-text-muted) transition-colors hover:text-(--color-text-primary)"
            >
                {expanded ? tScan("showLess") : tScan("showMoreDetails")}
                <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                />
            </button>

            {expanded && (
                <div id="medicine-details-panel" className="mt-3 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2">
                        <span className="text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                            Medicine Info
                        </span>
                        <CopyButton text={copyText} toastMessage="Medicine info copied!" />
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                {tScan("genericName")}
                            </span>
                            <span className="text-sm font-bold text-(--color-text-primary)">
                                {medicine.generic_name}
                            </span>
                        </div>
                        <div className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                {tScan("dosageForm")}
                            </span>
                            <span className="text-sm font-bold text-(--color-text-primary)">
                                {medicine.dosage_form ?? "N/A"}
                            </span>
                        </div>
                        <div className="col-span-2 rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3">
                            <span className="block text-[10px] font-bold tracking-wider text-(--color-text-muted) uppercase">
                                {tScan("composition")}
                            </span>
                            <span className="text-sm font-bold text-(--color-text-primary)">
                                {medicine.composition ?? "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
