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
    ChildVaccinationTracker,
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

        const dtstamp = new Date();
        const formatICSDate = (d: Date) =>
            d.getFullYear().toString() +
            String(d.getMonth() + 1).padStart(2, "0") +
            String(d.getDate()).padStart(2, "0");

        const formatICSDateTime = (d: Date) =>
            d.getUTCFullYear().toString() +
            String(d.getUTCMonth() + 1).padStart(2, "0") +
            String(d.getUTCDate()).padStart(2, "0") +
            "T" +
            String(d.getUTCHours()).padStart(2, "0") +
            String(d.getUTCMinutes()).padStart(2, "0") +
            String(d.getUTCSeconds()).padStart(2, "0") +
            "Z";

        const events = vaccine.dosing_intervals_weeks
            .map((weeks, index) => {
                const [year, month, day] = initialDate.split("-").map(Number);
                const date = new Date(year, month - 1, day);
                date.setDate(date.getDate() + weeks * 7);

                const endDate = new Date(date.getTime());
                endDate.setDate(endDate.getDate() + 1);

                const uidKey = selectedVaccine || vaccine.disease_name.replace(/\s+/g, "-");

                return [
                    "BEGIN:VEVENT",
                    `UID:sahidawa-${uidKey}-${index}-${formatICSDateTime(dtstamp)}`,
                    `DTSTAMP:${formatICSDateTime(dtstamp)}`,
                    `SUMMARY:SahiDawa - ${vaccine.disease_name} Dose ${index + 1}`,
                    `DTSTART;VALUE=DATE:${formatICSDate(date)}`,
                    `DTEND;VALUE=DATE:${formatICSDate(endDate)}`,
                    "BEGIN:VALARM",
                    "ACTION:DISPLAY",
                    "DESCRIPTION:Reminder: Vaccine dose is due tomorrow.",
                    "TRIGGER:-P1D",
                    "END:VALARM",
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

                    <ChildVaccinationTracker />

                    {/* National Immunization Schedule Dynamic Timeline Tracker */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="mb-6 flex flex-col border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                            <div className="flex items-center space-x-2">
                                <Calendar className="h-6 w-6 text-emerald-600" />
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    National Immunization Schedule
                                </h2>
                            </div>
                            <span className="mt-2 inline-block max-w-md text-xs text-slate-400 italic sm:mt-0 sm:text-right dark:text-slate-500">
                                Source: India National Immunization Schedule, MoHFW.
                            </span>
                        </div>

                        {/* Responsive Stage Wise Accordion/List Grid */}
                        <div className="space-y-8">
                            {["Birth", "Infant", "Child", "Adolescent"].map((stageGroupName) => {
                                // Dynamic inline filtering based on structural file stages
                                const stageItems = [
                                    {
                                        id: "bcg",
                                        name: "BCG",
                                        dose: "Single dose",
                                        timing: "At birth",
                                        protection: "Severe childhood tuberculosis",
                                    },
                                    {
                                        id: "hepb-birth",
                                        name: "Hepatitis B Birth Dose",
                                        dose: "Birth dose",
                                        timing: "At birth, within 24 hours",
                                        protection: "Hepatitis B",
                                    },
                                    {
                                        id: "opv-0",
                                        name: "OPV-0",
                                        dose: "Birth dose",
                                        timing: "At birth, within first 15 days",
                                        protection: "Polio",
                                    },
                                    {
                                        id: "opv-1",
                                        name: "OPV-1",
                                        dose: "Dose 1",
                                        timing: "At 6 weeks",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "pentavalent-1",
                                        name: "Pentavalent-1",
                                        dose: "Dose 1",
                                        timing: "At 6 weeks",
                                        protection:
                                            "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "fipv-1",
                                        name: "fIPV-1",
                                        dose: "Fractional dose 1",
                                        timing: "At 6 weeks",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "rotavirus-1",
                                        name: "Rotavirus-1",
                                        dose: "Dose 1",
                                        timing: "At 6 weeks",
                                        protection: "Rotavirus diarrhoea",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "pcv-1",
                                        name: "PCV-1",
                                        dose: "Dose 1",
                                        timing: "At 6 weeks",
                                        protection: "Pneumococcal disease",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "opv-2",
                                        name: "OPV-2",
                                        dose: "Dose 2",
                                        timing: "At 10 weeks",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "pentavalent-2",
                                        name: "Pentavalent-2",
                                        dose: "Dose 2",
                                        timing: "At 10 weeks",
                                        protection:
                                            "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "rotavirus-2",
                                        name: "Rotavirus-2",
                                        dose: "Dose 2",
                                        timing: "At 10 weeks",
                                        protection: "Rotavirus diarrhoea",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "opv-3",
                                        name: "OPV-3",
                                        dose: "Dose 3",
                                        timing: "At 14 weeks",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "pentavalent-3",
                                        name: "Pentavalent-3",
                                        dose: "Dose 3",
                                        timing: "At 14 weeks",
                                        protection:
                                            "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "fipv-2",
                                        name: "fIPV-2",
                                        dose: "Fractional dose 2",
                                        timing: "At 14 weeks",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "rotavirus-3",
                                        name: "Rotavirus-3",
                                        dose: "Dose 3",
                                        timing: "At 14 weeks",
                                        protection: "Rotavirus diarrhoea",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "pcv-2",
                                        name: "PCV-2",
                                        dose: "Dose 2",
                                        timing: "At 14 weeks",
                                        protection: "Pneumococcal disease",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "mr-1",
                                        name: "MR-1",
                                        dose: "Dose 1",
                                        timing: "At 9 to 12 months",
                                        protection: "Measles and rubella",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "fipv-3",
                                        name: "fIPV-3",
                                        dose: "Fractional dose 3",
                                        timing: "At 9 completed months",
                                        protection: "Polio",
                                        stage: "Infant",
                                    },
                                    {
                                        id: "pcv-booster",
                                        name: "PCV Booster",
                                        dose: "Booster",
                                        timing: "At 9 to 12 months",
                                        protection: "Pneumococcal disease",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "je-1",
                                        name: "JE-1",
                                        dose: "Dose 1",
                                        timing: "At 9 to 12 months",
                                        protection: "Japanese encephalitis",
                                        stage: "Infant",
                                        area: true,
                                    },
                                    {
                                        id: "dpt-booster-1",
                                        name: "DPT Booster-1",
                                        dose: "Booster 1",
                                        timing: "At 16 to 24 months",
                                        protection: "Diphtheria, pertussis and tetanus",
                                        stage: "Child",
                                    },
                                    {
                                        id: "mr-2",
                                        name: "MR-2",
                                        dose: "Dose 2",
                                        timing: "At 16 to 24 months",
                                        protection: "Measles and rubella",
                                        stage: "Child",
                                    },
                                    {
                                        id: "opv-booster",
                                        name: "OPV Booster",
                                        dose: "Booster",
                                        timing: "At 16 to 24 months",
                                        protection: "Polio",
                                        stage: "Child",
                                    },
                                    {
                                        id: "je-2",
                                        name: "JE-2",
                                        dose: "Dose 2",
                                        timing: "At 16 to 24 months",
                                        protection: "Japanese encephalitis",
                                        stage: "Child",
                                        area: true,
                                    },
                                    {
                                        id: "dpt-booster-2",
                                        name: "DPT Booster-2",
                                        dose: "Booster 2",
                                        timing: "At 5 to 6 years",
                                        protection: "Diphtheria, pertussis and tetanus",
                                        stage: "Child",
                                    },
                                    {
                                        id: "td-10",
                                        name: "Td",
                                        dose: "10 year dose",
                                        timing: "At 10 years",
                                        protection: "Tetanus and diphtheria",
                                        stage: "Adolescent",
                                    },
                                    {
                                        id: "td-16",
                                        name: "Td",
                                        dose: "16 year dose",
                                        timing: "At 16 years",
                                        protection: "Tetanus and diphtheria",
                                        stage: "Adolescent",
                                    },
                                ].filter((v) => (v.stage || "Birth") === stageGroupName);

                                if (stageItems.length === 0) return null;

                                return (
                                    <div key={stageGroupName} className="space-y-4">
                                        <h3 className="border-l-4 border-emerald-500 pl-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
                                            {stageGroupName} Stage
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            {stageItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="relative flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:shadow-sm dark:border-slate-700/50 dark:bg-slate-900/30"
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                                {item.name}
                                                            </h4>
                                                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                                {item.dose}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                                                Protects:
                                                            </span>{" "}
                                                            {item.protection}
                                                        </p>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                            {item.timing}
                                                        </span>
                                                        {item.area && (
                                                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                                                Area Specific
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
