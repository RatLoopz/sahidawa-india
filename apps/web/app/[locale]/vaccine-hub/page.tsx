"use client";

import { PageHeader } from "../components/PageHeader";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { vaccineDatabase, VaccineKey, VACCINE_GLOBAL_DISCLAIMER } from "@/lib/vaccineData";
import {
    VaccineSelector,
    DoseSchedule,
    VaccineDetails,
    SafetyInfo,
    AftercareGuidance,
    DateInitializer,
} from "@/components/vaccine";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen, Syringe, Calendar, AlertTriangle, HeartPulse } from "lucide-react";

const STORAGE_KEYS = {
    selectedVaccine: "vaccine-hub-selected-vaccine",
    initialDate: "vaccine-hub-initial-date",
};

export default function VaccineHubPage() {
    const t = useTranslations("vaccineHub");
    const [selectedVaccine, setSelectedVaccine] = useState<VaccineKey | "">("");
    const [initialDate, setInitialDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    const vaccine = selectedVaccine ? vaccineDatabase[selectedVaccine] : null;

    // Load from localStorage on mount
    useEffect(() => {
        const savedVaccine = localStorage.getItem(STORAGE_KEYS.selectedVaccine);
        const savedDate = localStorage.getItem(STORAGE_KEYS.initialDate);

        if (savedVaccine && Object.keys(vaccineDatabase).includes(savedVaccine)) {
            setSelectedVaccine(savedVaccine as VaccineKey);
        }

        if (savedDate) {
            setInitialDate(savedDate);
        }

        setIsLoading(false);
    }, []);

    // Persist vaccine selection to localStorage
    const handleVaccineChange = (vaccine: VaccineKey | "") => {
        setSelectedVaccine(vaccine);
        if (vaccine) {
            localStorage.setItem(STORAGE_KEYS.selectedVaccine, vaccine);
        } else {
            localStorage.removeItem(STORAGE_KEYS.selectedVaccine);
        }
        setInitialDate(""); // Clear date when switching vaccines
        localStorage.removeItem(STORAGE_KEYS.initialDate);
    };

    // Persist date to localStorage
    const handleDateChange = (date: string) => {
        setInitialDate(date);
        if (date) {
            localStorage.setItem(STORAGE_KEYS.initialDate, date);
        } else {
            localStorage.removeItem(STORAGE_KEYS.initialDate);
        }
    };

    if (isLoading) {
        return (
            <>
                <PageHeader
                    title={t("pageHeaderTitle")}
                    subtitle={t("pageHeaderSubtitle")}
                    backHref="/"
                    variant="light"
                />
                <div className="min-h-screen bg-(--color-surface-muted) p-6 md:p-10 dark:bg-slate-900">
                    <div className="mx-auto max-w-6xl animate-pulse space-y-6">
                        <div className="h-32 rounded-lg bg-(--color-border-muted)" />
                        <div className="h-64 rounded-lg bg-(--color-border-muted)" />
                    </div>
                </div>
            </>
        );
    }

    const exportToCalendar = () => {
        if (!vaccine || !initialDate) return;

        const events = vaccine.dosing_intervals_weeks
            .map((weeks, index) => {
                const date = new Date(initialDate);
                date.setDate(date.getDate() + weeks * 7);

                const endDate = new Date(date);
                endDate.setDate(endDate.getDate() + 1);

                const formatICSDate = (d: Date) =>
                    d.getFullYear().toString() +
                    String(d.getMonth() + 1).padStart(2, "0") +
                    String(d.getDate()).padStart(2, "0");

                return [
                    "BEGIN:VEVENT",
                    `SUMMARY:SahiDawa - ${vaccine.disease_name} Dose ${index + 1}`,
                    `DTSTART;VALUE=DATE:${formatICSDate(date)}`,
                    `DTEND;VALUE=DATE:${formatICSDate(endDate)}`,
                    "END:VEVENT",
                ].join("\r\n");
            })
            .join("\r\n");

        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//SahiDawa//Vaccine Hub//EN",
            "CALSCALE:GREGORIAN",
            events,
            "END:VCALENDAR",
        ].join("\r\n");

        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "vaccine-schedule.ics";

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    };

    return (
        <>
            <PageHeader
                title={t("pageHeaderTitle")}
                subtitle={t("pageHeaderSubtitle")}
                backHref="/"
                variant="light"
            />

            <div className="min-h-screen bg-(--color-surface-muted) p-4 transition-colors duration-200 sm:p-6 md:p-10 dark:bg-slate-900">
                <div className="mx-auto max-w-7xl space-y-8">
                    {/* Hero Section */}
                    <div className="space-y-2 text-center">
                        <h1 className="text-3xl font-bold text-(--color-text-primary) sm:text-4xl dark:text-white">
                            <Syringe className="mr-2 inline h-8 w-8 shrink-0 text-emerald-600" />{" "}
                            {t("title")}
                        </h1>
                        <p className="mx-auto max-w-2xl text-(--color-text-secondary)">
                            {t("subtitle")}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 dark:border-slate-700 dark:bg-slate-800">
                        <div>
                            <VaccineSelector
                                value={selectedVaccine}
                                onChange={handleVaccineChange}
                            />
                        </div>

                        {vaccine && (
                            <div>
                                <DateInitializer
                                    vaccine={vaccine}
                                    value={initialDate}
                                    onChange={handleDateChange}
                                />
                            </div>
                        )}
                    </div>

                    {/* Empty State */}
                    {!vaccine && (
                        <div className="py-12">
                            <EmptyState
                                icon={<BookOpen size={32} className="text-emerald-600" />}
                                title={t("noVaccineSelected")}
                                description={t("chooseVaccinePrompt")}
                                className="mx-auto max-w-md"
                            />

                            <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                                        <Calendar className="h-6 w-6 text-emerald-700" />
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-(--color-text-primary)">
                                        {t("featureSchedule")}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                                        <AlertTriangle className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-(--color-text-primary)">
                                        {t("featureSideEffects")}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
                                        <HeartPulse className="h-6 w-6 text-sky-600" />
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-(--color-text-primary)">
                                        {t("featureAftercare")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    {vaccine && (
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {/* Left Column - Sticky Details */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-20 space-y-6">
                                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                        <VaccineDetails vaccine={vaccine} />
                                    </div>
                                </div>
                            </div>

                            {/* Right Columns - Scrollable Content */}
                            <div className="space-y-6 lg:col-span-2">
                                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <div className="mb-4 flex justify-end">
                                        <button
                                            onClick={exportToCalendar}
                                            disabled={!initialDate}
                                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Export to Calendar
                                        </button>
                                    </div>

                                    <DoseSchedule vaccine={vaccine} initialDate={initialDate} />
                                </div>

                                {/* Safety Info */}
                                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <SafetyInfo vaccine={vaccine} />
                                </div>

                                {/* Aftercare Guidance */}
                                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                    <AftercareGuidance vaccine={vaccine} />
                                </div>

                                {/* Disclaimer */}
                                <div className="border-t border-slate-200 pt-6 text-center dark:border-slate-700">
                                    <p className="text-xs text-(--color-text-muted) italic dark:text-slate-400">
                                        {VACCINE_GLOBAL_DISCLAIMER}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
