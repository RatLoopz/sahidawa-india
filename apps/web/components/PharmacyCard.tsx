"use client";

import { Clock } from "lucide-react";
import { getOpenNowStatus } from "@/lib/openingHours";

interface PharmacyStatusBadgeProps {
    operatingHours?: string | null;
    timezone?: string | null;
}

/**
 * Renders an Open / Closed / "Hours unavailable" badge based on the
 * pharmacy's OSM-syntax operatingHours, evaluated against the current time
 * in its timezone (see lib/openingHours.ts for the parsing rules).
 *
 * Locations with missing or unparseable hours fall back to a visible
 * "Hours unavailable" badge rather than rendering nothing (#2862).
 */
export function PharmacyStatusBadge({ operatingHours, timezone }: PharmacyStatusBadgeProps) {
    const { status } = getOpenNowStatus(operatingHours, timezone);

    if (status === "unavailable") {
        return (
            <span
                className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                aria-label="Hours unavailable"
            >
                <Clock size={7} />
                Hours unavailable
            </span>
        );
    }

    const open = status === "open";

    return (
        <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                open
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
            }`}
            aria-label={open ? "Currently open" : "Currently closed"}
        >
            <Clock size={7} />
            {open ? "Open" : "Closed"}
        </span>
    );
}
