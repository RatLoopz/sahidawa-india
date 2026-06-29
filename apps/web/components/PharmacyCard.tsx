"use client";

import { Clock } from "lucide-react";

/**
 * Parses "09:00 - 21:00" format and checks if current local time falls within.
 */
export function isPharmacyOpen(operatingHours: string): boolean {
    if (!operatingHours || typeof operatingHours !== 'string') return false;

    const match = operatingHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return false;

    const openH = parseInt(match[1], 10);
    const openM = parseInt(match[2], 10);
    const closeH = parseInt(match[3], 10);
    const closeM = parseInt(match[4], 10);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (openMinutes < closeMinutes) {
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

interface PharmacyStatusBadgeProps {
    operatingHours?: string;
}

/**
 * Renders Open/Closed badge based on current time vs operatingHours string.
 */
export function PharmacyStatusBadge({ operatingHours }: PharmacyStatusBadgeProps) {
    if (!operatingHours) return null;

    const open = isPharmacyOpen(operatingHours);

    return (
        <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                open
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
            aria-label={open ? "Currently open" : "Currently closed"}
        >
            <Clock size={7} />
            {open ? "Open" : "Closed"}
        </span>
    );
}
