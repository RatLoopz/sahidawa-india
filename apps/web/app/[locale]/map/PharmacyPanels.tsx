"use client";

import { AlertCircle, Heart, Loader2, MapPin, Phone, Shield, Star, Store } from "lucide-react";

import type { HeatmapMode, Pharmacy } from "./PharmacyMap";

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
    return (
        <article
            className={`rounded-xl border p-3 transition-all duration-200 ${
                isSelected
                    ? "border-emerald-300 bg-emerald-50/60 shadow-md shadow-emerald-100/30"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"
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
                                ? "bg-emerald-200"
                                : pharmacy.type === "govt"
                                  ? "bg-emerald-100"
                                  : "bg-blue-50"
                        }`}
                        aria-hidden="true"
                    >
                        {pharmacy.isVerified ? "🛡️" : pharmacy.type === "govt" ? "🏥" : "💊"}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-800">
                                {pharmacy.name}
                            </h3>
                            {pharmacy.isVerified && (
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                    <Shield size={7} />
                                    Verified
                                </span>
                            )}
                            {pharmacy.rating > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5">
                                    <Star size={10} className="fill-amber-400 text-amber-400" />
                                    <span className="text-[11px] font-bold text-slate-700">
                                        {pharmacy.rating}
                                    </span>
                                </span>
                            )}
                        </div>

                        {pharmacy.address && (
                            <div className="mt-0.5 flex items-center gap-1">
                                <MapPin size={8} className="shrink-0 text-slate-300" />
                                <p className="truncate text-[10px] text-slate-400">
                                    {pharmacy.address}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 ml-11 flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            pharmacy.distance !== "—"
                                ? "bg-slate-50 text-slate-600"
                                : "bg-slate-50 text-slate-400"
                        }`}
                    >
                        {pharmacy.distance !== "—" ? `${pharmacy.distance} away` : "Distance —"}
                    </span>
                </div>

                <div className="mt-1.5 ml-11 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                        <Shield size={6} />
                        {pharmacy.status}
                    </span>
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            pharmacy.type === "govt"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                        }`}
                    >
                        <Heart size={6} />
                        {pharmacy.type === "govt" ? "Jan Aushadhi" : "Private"}
                    </span>
                </div>
            </button>

            {pharmacy.phone && (
                <div className="mt-2 ml-11">
                    <a
                        href={`tel:${pharmacy.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 active:bg-slate-200"
                    >
                        <Phone size={9} className="text-emerald-600" />
                        Call
                    </a>
                </div>
            )}
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
    const subtitle = isLoading
        ? "Loading nearby verified stores…"
        : pharmacies.length === 0
          ? "Search this area to load nearby verified stores."
          : `${pharmacies.length} trusted options in view`;

    return (
        <section
            className={`flex h-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/96 shadow-xl backdrop-blur-xl ${
                className || ""
            }`}
        >
            <div className="shrink-0 border-b border-slate-100/80 px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                        <Store size={18} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-800">Nearby Pharmacies</h2>
                        <p className="text-xs text-slate-400">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-b border-slate-100/80 px-5 py-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
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
                            className={`rounded-xl px-3 py-2 text-left text-[11px] font-bold transition-all ${
                                heatmapMode === option.id
                                    ? "bg-slate-900 text-white shadow-md"
                                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            }`}
                            aria-pressed={heatmapMode === option.id}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {riskSummaryText ? (
                    <p className="mt-2 text-[10px] leading-snug text-slate-400">
                        {riskSummaryText}
                    </p>
                ) : null}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {isLoading ? (
                    <div className="py-10 text-center">
                        <Loader2 size={26} className="mx-auto mb-3 animate-spin text-emerald-600" />
                        <p className="text-sm font-bold text-slate-400">
                            Finding nearby pharmacies…
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                            Verified stores + OpenStreetMap
                        </p>
                    </div>
                ) : pharmacies.length === 0 ? (
                    <div className="py-10 text-center">
                        <MapPin size={30} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-bold text-slate-400">No pharmacies found</p>
                        <p className="mt-1 text-xs text-slate-300">
                            Try panning the map and pressing &ldquo;Search this area&rdquo;
                        </p>
                    </div>
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
