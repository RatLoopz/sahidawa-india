"use client";

import { useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    Heart,
    MapPin,
    Phone,
    Shield,
    Star,
    Store,
    ShieldCheck,
    Hospital,
    Pill,
    Navigation,
    Share2,
    Check,
} from "lucide-react";

import type { HeatmapMode, Pharmacy } from "./PharmacyMap";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export interface PharmacyPanelHeatmapOption {
    id: HeatmapMode;
    label: string;
    description: string;
}

export interface PharmacyPanelsProps {
    pharmacies: Pharmacy[];
    isLoading: boolean;
    selectedPharmacyId: number | null;
    heatmapMode: HeatmapMode;
    heatmapOptions: PharmacyPanelHeatmapOption[];
    riskSummaryText: string;
    onSelectPharmacy: (pharmacyId: number) => void;
    onHeatmapModeChange: (mode: HeatmapMode) => void;
    className?: string;
}

function PharmacyPanelRow({
    pharmacy,
    isSelected,
    onSelect,
}: {
    pharmacy: Pharmacy;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-scroll the card into view smoothly when selected from a map marker click
    useEffect(() => {
        if (isSelected && cardRef.current) {
            cardRef.current.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
            });
        }
    }, [isSelected]);

    // ✅ FIXED: Proper template string token usage ($) and nested interface paths applied
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${pharmacy.coordinates.lat},${pharmacy.coordinates.lng}`;

    const [shareFeedback, setShareFeedback] = useState<"none" | "shared" | "copied">("none");

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();

        const shareData = {
            title: pharmacy.name,
            text: `${pharmacy.name}${pharmacy.address ? ` - ${pharmacy.address}` : ""}`,
            url: `https://www.google.com/maps/search/?api=1&query=${pharmacy.coordinates.lat},${pharmacy.coordinates.lng}`,
        };

        const fallbackCopy = async () => {
            const textToCopy = `${pharmacy.name}${
                pharmacy.address ? `\nAddress: ${pharmacy.address}` : ""
            }\nLocation: https://www.google.com/maps/search/?api=1&query=${
                pharmacy.coordinates.lat
            },${pharmacy.coordinates.lng}`;

            try {
                await navigator.clipboard.writeText(textToCopy);
                setShareFeedback("copied");
                setTimeout(() => setShareFeedback("none"), 2000);
            } catch (err) {
                console.error("Failed to copy text: ", err);
            }
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                setShareFeedback("shared");
                setTimeout(() => setShareFeedback("none"), 2000);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    await fallbackCopy();
                }
            }
        } else {
            await fallbackCopy();
        }
    };

    return (
        <article
            ref={cardRef}
            id={`pharmacy-card-${pharmacy.id}`}
            className={`rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md active:scale-[0.99] ${
                isSelected
                    ? "border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100/30 dark:border-emerald-900 dark:bg-emerald-950/20 dark:shadow-emerald-950/10"
                    : "border-(--color-border-muted) bg-(--color-surface-page) hover:border-(--color-text-muted) hover:shadow-sm"
            }`}
        >
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={isSelected}
                className="w-full text-left"
            >
                <div className="flex items-start gap-2.5">
                    <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${
                            pharmacy.isVerified
                                ? "bg-emerald-200 dark:bg-emerald-950/40"
                                : pharmacy.type === "govt"
                                  ? "bg-emerald-100 dark:bg-emerald-950/25"
                                  : "bg-blue-50 dark:bg-blue-950/30"
                        }`}
                        aria-hidden="true"
                    >
                        {pharmacy.isVerified ? (
                            <ShieldCheck size={18} className="text-emerald-700" />
                        ) : pharmacy.type === "govt" ? (
                            <Hospital size={18} className="text-emerald-600" />
                        ) : (
                            <Pill size={18} className="text-blue-600" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-semibold text-(--color-text-primary)">
                                {pharmacy.name}
                            </h3>
                            <div className="flex shrink-0 items-center gap-1">
                                {pharmacy.isVerified && (
                                    <span className="dark:text-emerald-450 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/30">
                                        <Shield size={7} />
                                        Verified
                                    </span>
                                )}
                                {pharmacy.rating > 0 && (
                                    <span className="flex items-center gap-0.5">
                                        <Star size={10} className="fill-amber-400 text-amber-400" />
                                        <span className="text-[11px] font-bold text-(--color-text-primary)">
                                            {pharmacy.rating}
                                        </span>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-0.5 flex items-center gap-1">
                            <MapPin size={8} className="shrink-0 text-(--color-text-muted)" />
                            <p className="truncate text-[10px] text-(--color-text-secondary)">
                                {pharmacy.address || "No precise address listed in OSM"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-2 ml-11 flex flex-wrap items-center gap-1.5">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            pharmacy.distance !== "—"
                                ? "bg-(--color-surface-muted) text-(--color-text-secondary)"
                                : "bg-(--color-surface-muted) text-(--color-text-muted)"
                        }`}
                    >
                        {pharmacy.distance !== "—" ? `${pharmacy.distance} away` : "Distance —"}
                    </span>

                    {/* Live reliability metadata badge */}
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                        Live from OSM
                    </span>
                </div>

                <div className="mt-1.5 ml-11 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-(--color-surface-muted) px-1.5 py-0.5 text-[9px] font-medium text-(--color-text-secondary)">
                        <Shield size={6} />
                        {pharmacy.status || "Status unknown"}
                    </span>
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            pharmacy.type === "govt"
                                ? "dark:text-emerald-450 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                        }`}
                    >
                        <Heart size={6} />
                        {pharmacy.type === "govt" ? "Jan Aushadhi" : "Private"}
                    </span>
                </div>
            </button>

            {/* Action Group Footer Buttons */}
            <div className="mt-3 ml-11 flex flex-wrap gap-2">
                <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                >
                    <Navigation size={9} className="fill-white" />
                    Directions
                </a>
                {pharmacy.phone && (
                    <a
                        href={`tel:${pharmacy.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-surface-muted) px-2.5 py-1 text-[11px] font-medium text-(--color-text-secondary) transition-colors hover:bg-(--color-border-muted) active:bg-(--color-border-muted)"
                    >
                        <Phone size={9} className="text-emerald-600" />
                        Call
                    </a>
                )}
                <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-(--color-surface-muted) px-2.5 py-1 text-[11px] font-medium text-(--color-text-secondary) transition-colors hover:bg-(--color-border-muted) active:bg-(--color-border-muted)"
                >
                    {shareFeedback === "copied" ? (
                        <>
                            <Check size={9} className="text-emerald-600" />
                            Copied!
                        </>
                    ) : shareFeedback === "shared" ? (
                        <>
                            <Check size={9} className="text-emerald-600" />
                            Shared!
                        </>
                    ) : (
                        <>
                            <Share2 size={9} className="text-emerald-600" />
                            Share
                        </>
                    )}
                </button>
            </div>
        </article>
    );
}

export default function PharmacyPanels({
    pharmacies,
    isLoading,
    selectedPharmacyId,
    heatmapMode,
    heatmapOptions,
    riskSummaryText,
    onSelectPharmacy,
    onHeatmapModeChange,
    className,
}: PharmacyPanelsProps) {
    const verifiedCount = pharmacies.filter((pharmacy) => pharmacy.isVerified).length;
    const govtCount = pharmacies.filter((pharmacy) => pharmacy.type === "govt").length;
    const liveCount = pharmacies.length;

    const subtitle = isLoading
        ? "Loading nearby verified stores…"
        : pharmacies.length === 0
          ? "Search this area to load nearby verified stores."
          : `${pharmacies.length} trusted options in view`;

    return (
        <section
            className={`flex h-full flex-col overflow-hidden rounded-[28px] border border-(--color-border-muted) bg-(--color-surface-page)/96 shadow-xl backdrop-blur-xl ${
                className || ""
            }`}
        >
            <div className="shrink-0 border-b border-(--color-border-muted) px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/30">
                        <Store size={18} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-(--color-text-primary)">
                            Nearby Pharmacies
                        </h2>
                        <p className="text-xs text-(--color-text-secondary)">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-b border-(--color-border-muted) px-5 py-4">
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: "Verified stores", value: verifiedCount },
                        { label: "Jan Aushadhi", value: govtCount },
                        { label: "Live options", value: liveCount },
                    ].map((item) => (
                        <article
                            key={item.label}
                            className="rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) p-3"
                        >
                            <p className="text-[10px] font-semibold tracking-[0.18em] text-(--color-text-muted) uppercase">
                                {item.label}
                            </p>
                            <p className="mt-1 text-xl font-black text-(--color-text-primary)">
                                {item.value}
                            </p>
                        </article>
                    ))}
                </div>
            </div>

            <div className="shrink-0 border-b border-(--color-border-muted) px-5 py-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-(--color-text-secondary)">
                    <AlertCircle size={12} className="text-red-500" />
                    Risk layers
                </div>
                <div className="grid gap-1">
                    {heatmapOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onHeatmapModeChange(option.id)}
                            title={option.description}
                            className={`rounded-xl px-3 py-2 text-left text-[11px] font-bold transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] ${
                                heatmapMode === option.id
                                    ? "bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900"
                                    : "bg-(--color-surface-muted) text-(--color-text-secondary) hover:bg-(--color-border-muted)"
                            }`}
                            aria-pressed={heatmapMode === option.id}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {riskSummaryText ? (
                    <p className="mt-2 text-[10px] leading-snug text-(--color-text-secondary)">
                        {riskSummaryText}
                    </p>
                ) : null}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        <div className="py-2 text-center">
                            <p className="text-sm font-bold text-(--color-text-secondary)">
                                Finding nearby pharmacies…
                            </p>
                            <p className="mt-1 mb-3 text-xs text-(--color-text-muted)">
                                Verified stores + OpenStreetMap
                            </p>
                        </div>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-3"
                            >
                                <div className="flex items-start gap-2.5">
                                    <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Skeleton className="h-4 w-1/2" />
                                            <Skeleton className="h-3 w-12 rounded-full" />
                                        </div>
                                        <Skeleton className="h-3 w-3/4" />
                                    </div>
                                </div>
                                <div className="mt-2 ml-11 flex flex-wrap items-center gap-2">
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : pharmacies.length === 0 ? (
                    <EmptyState
                        icon={<MapPin size={26} className="text-slate-400" />}
                        title="No pharmacies found"
                        description="Try panning the map and pressing “Search this area”"
                        className="border-none !bg-transparent p-6 shadow-none"
                    />
                ) : (
                    pharmacies.map((pharmacy) => (
                        <PharmacyPanelRow
                            key={pharmacy.id}
                            pharmacy={pharmacy}
                            isSelected={selectedPharmacyId === pharmacy.id}
                            onSelect={() => onSelectPharmacy(pharmacy.id)}
                        />
                    ))
                )}
            </div>
        </section>
    );
}
