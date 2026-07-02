"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
    ShieldCheck,
    Pill,
    Utensils,
    AlertTriangle,
    AlertCircle,
    Clock,
    Coffee,
    Apple,
    Droplets,
    Wine,
    Baby,
    User,
    Users,
    Package,
    HeartPulse,
    Info,
    ChevronLeft,
    Syringe,
    FlaskConical,
    UtensilsCrossed,
    BanIcon,
    CheckCircle2,
    NotepadText,
    TriangleAlert,
    Refrigerator,
} from "lucide-react";
import { type MedicineSafetyProfile, type AgeGroup } from "./MedicineSafetyData";
import { fetchSafetyProfile } from "@/lib/medicineSafetyService";

// ── Props ─────────────────────────────────────────────────────────────────────
type MedicineSafetyPanelProps = {
    searchQuery: string;
    onClose?: () => void;
};

type TabType = "sideEffects" | "dosage" | "diet";
type AgeGroupKey = AgeGroup["group"];

// ── Lucide icon resolver for dietary cue icon names ───────────────────────────
function DietIcon({ name, className }: { name: string; className?: string }) {
    const cls = className ?? "h-4 w-4";
    switch (name) {
        case "Droplets":
            return <Droplets className={cls} />;
        case "UtensilsCrossed":
            return <UtensilsCrossed className={cls} />;
        case "Wine":
            return <Wine className={cls} />;
        case "Apple":
            return <Apple className={cls} />;
        case "Clock":
            return <Clock className={cls} />;
        case "Coffee":
            return <Coffee className={cls} />;
        case "MilkOff":
            return <BanIcon className={cls} />;
        case "Milk":
            return <FlaskConical className={cls} />;
        case "Pill":
            return <Pill className={cls} />;
        case "Refrigerator":
            return <Refrigerator className={cls} />;
        default:
            return <Info className={cls} />;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MedicineSafetyPanel({ searchQuery, onClose }: MedicineSafetyPanelProps) {
    const t = useTranslations("medicineSafety");
    const [profile, setProfile] = useState<MedicineSafetyProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("sideEffects");
    const [ageGroup, setAgeGroup] = useState<AgeGroupKey>("adults");

    useEffect(() => {
        if (!searchQuery) return;

        let cancelled = false;
        setIsLoading(true);
        setProfile(null);

        fetchSafetyProfile(searchQuery).then((result) => {
            if (!cancelled) {
                setProfile(result);
                setIsLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [searchQuery]);

    if (isLoading) {
        return (
            <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <ShieldCheck className="h-4 w-4 animate-pulse text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Loading safety data…
                    </span>
                </div>
                <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
            </div>
        );
    }

    if (!profile) return null;

    const commonEffects = profile.sideEffects.filter((e) => e.severity === "common");
    const severeEffects = profile.sideEffects.filter((e) => e.severity === "severe");
    const dosageInfo = profile.ageBasedDosage.find((d) => d.group === ageGroup);

    const AGE_GROUPS: { key: AgeGroupKey; label: string; Icon: React.ElementType }[] = [
        { key: "children", label: t("dosage.tabs.kids"), Icon: Baby },
        { key: "adults", label: t("dosage.tabs.adults"), Icon: User },
        { key: "elderly", label: t("dosage.tabs.elderly"), Icon: Users },
    ];

    const TABS: { key: TabType; label: string; Icon: React.ElementType }[] = [
        { key: "sideEffects", label: t("tabs.sideEffects"), Icon: AlertTriangle },
        { key: "dosage", label: t("tabs.dosage"), Icon: Syringe },
        { key: "diet", label: t("tabs.dietaryIntake"), Icon: Utensils },
    ];

    return (
        <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {/* Header bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t("guideTitle")}
                    </h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {profile.genericName}
                </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                {TABS.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 border-b-2 px-3 pt-2.5 pb-2 font-medium transition-colors ${
                            activeTab === key
                                ? "border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[140px] p-4 text-xs">
                {/* Side Effects */}
                {activeTab === "sideEffects" && (
                    <div className="space-y-3">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
                            <div className="mb-2 flex items-center gap-1.5">
                                <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span className="font-semibold text-amber-700 dark:text-amber-300">
                                    {t("sideEffects.standardSymptoms")}
                                </span>
                            </div>
                            <ul className="space-y-1 pl-1">
                                {commonEffects.map((effect) => (
                                    <li
                                        key={effect.name}
                                        className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300"
                                    >
                                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
                                        <span>
                                            {effect.name}
                                            {effect.frequency !== "common" && (
                                                <span className="ml-1 text-slate-400 dark:text-slate-500">
                                                    ({effect.frequency})
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {severeEffects.length > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-900/10">
                                <div className="mb-2 flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                    <span className="font-semibold text-red-700 dark:text-red-300">
                                        {t("sideEffects.severeRedFlags")}
                                    </span>
                                </div>
                                <ul className="space-y-1 pl-1">
                                    {severeEffects.map((effect) => (
                                        <li key={effect.name} className="flex items-start gap-1.5">
                                            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-red-500 dark:text-red-400" />
                                            <span className="font-medium text-red-700 dark:text-red-300">
                                                {effect.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Dosage */}
                {activeTab === "dosage" && (
                    <div className="space-y-3">
                        <div className="flex gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                            {AGE_GROUPS.map(({ key, label, Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setAgeGroup(key)}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition-all ${
                                        ageGroup === key
                                            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {dosageInfo ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                        {dosageInfo.label}
                                    </span>
                                    <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                        <Clock className="h-2.5 w-2.5" />
                                        {dosageInfo.ageRange}
                                    </span>
                                </div>

                                <div className="mb-1.5 flex items-start gap-2">
                                    <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    <p className="text-slate-700 dark:text-slate-200">
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                            {t("dosage.doseLabel")}{" "}
                                        </span>
                                        {dosageInfo.dose}
                                    </p>
                                </div>

                                <div className="mb-2.5 flex items-start gap-2">
                                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    <p className="text-slate-700 dark:text-slate-200">
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                            {t("dosage.frequencyLabel")}{" "}
                                        </span>
                                        {dosageInfo.frequency}
                                    </p>
                                </div>

                                {dosageInfo.notes.length > 0 && (
                                    <div className="mb-2 rounded-md border border-blue-100 bg-blue-50 p-2 dark:border-blue-800/40 dark:bg-blue-900/10">
                                        <div className="mb-1 flex items-center gap-1.5">
                                            <NotepadText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                                                {t("dosage.notesHeading")}
                                            </span>
                                        </div>
                                        <ul className="space-y-0.5 pl-1">
                                            {dosageInfo.notes.map((note) => (
                                                <li
                                                    key={note}
                                                    className="flex items-start gap-1.5 text-blue-700 dark:text-blue-300"
                                                >
                                                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400" />
                                                    {note}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {dosageInfo.warnings.length > 0 && (
                                    <div className="rounded-md border border-red-100 bg-red-50 p-2 dark:border-red-800/40 dark:bg-red-900/10">
                                        <div className="mb-1 flex items-center gap-1.5">
                                            <TriangleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                            <span className="font-semibold text-red-700 dark:text-red-300">
                                                {t("dosage.warningsHeading")}
                                            </span>
                                        </div>
                                        <ul className="space-y-0.5 pl-1">
                                            {dosageInfo.warnings.map((w) => (
                                                <li
                                                    key={w}
                                                    className="flex items-start gap-1.5 text-red-700 dark:text-red-300"
                                                >
                                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500 dark:text-red-400" />
                                                    {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-500 dark:text-slate-400">
                                {t("noDosageInfo")}
                            </p>
                        )}
                    </div>
                )}

                {/* Dietary Intake */}
                {activeTab === "diet" && (
                    <div className="space-y-2">
                        {profile.dietaryCues.map((rule) => {
                            const isAvoid = rule.type === "avoid";
                            const isRequired = rule.type === "required";

                            const wrapCls = isAvoid
                                ? "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10"
                                : isRequired
                                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/10"
                                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800";

                            const iconCls = isAvoid
                                ? "text-red-500 dark:text-red-400"
                                : isRequired
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-slate-500 dark:text-slate-400";

                            const labelCls = isAvoid
                                ? "text-red-700 dark:text-red-300"
                                : isRequired
                                  ? "text-emerald-800 dark:text-emerald-300"
                                  : "text-slate-700 dark:text-slate-300";

                            const textCls = isAvoid
                                ? "text-red-600 dark:text-red-300"
                                : isRequired
                                  ? "text-emerald-700 dark:text-emerald-200"
                                  : "text-slate-600 dark:text-slate-400";

                            return (
                                <div
                                    key={rule.label}
                                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${wrapCls}`}
                                >
                                    <div className={`mt-0.5 shrink-0 ${iconCls}`}>
                                        <DietIcon name={rule.icon} className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span
                                            className={`block text-[11px] font-bold tracking-wide uppercase ${labelCls}`}
                                        >
                                            {rule.label}
                                        </span>
                                        <span className={`leading-snug ${textCls}`}>
                                            {rule.instruction}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800/40 dark:bg-blue-900/10">
                            <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
                            <div>
                                <span className="block text-[11px] font-bold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                                    {t("dietary.storageHeading")}
                                </span>
                                <span className="leading-snug text-blue-600 dark:text-blue-300">
                                    {profile.storageNote}
                                </span>
                            </div>
                        </div>

                        {profile.pregnancyCategory && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-purple-200 bg-purple-50 p-2.5 dark:border-purple-800/40 dark:bg-purple-900/10">
                                <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />
                                <div>
                                    <span className="block text-[11px] font-bold tracking-wide text-purple-700 uppercase dark:text-purple-300">
                                        {t("dietary.pregnancyHeading")}
                                    </span>
                                    <span className="leading-snug text-purple-600 dark:text-purple-300">
                                        {profile.pregnancyCategory}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer: Disclaimer + Close button */}
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                    {t("disclaimer")}
                </div>

                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 active:scale-95 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:text-white"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        {t("closeButton")}
                    </button>
                </div>
            </div>
        </div>
    );
}
