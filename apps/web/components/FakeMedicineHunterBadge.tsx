"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Tooltip } from "@/components/ui/Tooltip";

interface FakeMedicineHunterBadgeProps {
    /** Verified counterfeit-medicine report count for the signed-in user. */
    count: number;
}

export default function FakeMedicineHunterBadge({ count }: FakeMedicineHunterBadgeProps) {
    const t = useTranslations("Profile");

    return (
        <Tooltip content={t("fakeMedicineHunterTooltip")} position="top">
            <span
                role="img"
                aria-label={t("fakeMedicineHunterTooltip")}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400 px-3 py-1 text-xs font-bold text-amber-900 shadow-sm transition-transform hover:scale-[1.03] dark:border-amber-500/40 dark:from-amber-500/20 dark:via-yellow-500/20 dark:to-amber-600/20 dark:text-amber-200"
            >
                <ShieldCheck size={14} className="shrink-0" />
                {t("fakeMedicineHunterBadge")} · {count}
            </span>
        </Tooltip>
    );
}
