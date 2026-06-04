"use client";

import { PageHeader } from "../components/PageHeader";
import { useState } from "react";
import { vaccineDatabase, VaccineKey, VACCINE_GLOBAL_DISCLAIMER } from "@/lib/vaccineData";

export default function VaccineHubPage() {
    const [selectedVaccine, setSelectedVaccine] = useState<VaccineKey | "">("");
    const [initialDate, setInitialDate] = useState<string>("");

    const vaccine = selectedVaccine ? vaccineDatabase[selectedVaccine] : null;

    // Safely converts tracking week offsets into an absolute calendar string representation
    const calculateMilestoneDate = (weeksOffset: number) => {
        if (!initialDate) return null;

        const reference = new Date(initialDate);
        if (isNaN(reference.getTime())) return null; // Edge-case syntax protection fallback

        const targetDate = new Date(reference.getTime());
        targetDate.setDate(targetDate.getDate() + weeksOffset * 7);

        return targetDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <>
            <PageHeader
                title="Vaccine Hub"
                subtitle="Immunization Tracker"
                backHref="/"
                variant="light"
            />
            <div className="min-h-screen bg-(--color-surface-muted) p-6 text-(--color-text-primary) transition-colors duration-200 md:p-10">
                {/* HEADER */}
                <div className="mx-auto mb-8 max-w-5xl border-b border-(--color-border-muted) pb-5">
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-emerald-600">
                        <span>💉</span> Vaccine Hub & Immunization Tracker
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-(--color-text-secondary)">
                        Explore vaccine schedules, safety information, and aftercare guidance for
                        better public health awareness.
                    </p>
                </div>

                {/* CONTROLS AREA (Dropdown + Optional Dynamic Date Tracker Grid) */}
                <div className="mx-auto mb-8 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
                    {/* SELECT DROPDOWN */}
                    <div>
                        <label className="mb-2 block text-xs font-bold tracking-wider text-emerald-800 uppercase">
                            Select Disease / Vaccine
                        </label>
                        <select
                            className="w-full rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) p-3 font-medium text-(--color-text-primary) shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={selectedVaccine}
                            onChange={(e) => {
                                setSelectedVaccine(e.target.value as VaccineKey);
                                setInitialDate(""); // Clear date tracking context when swapping vaccine targets
                            }}
                        >
                            <option value="">🔎 Choose a Vaccine Profile...</option>
                            {(Object.keys(vaccineDatabase) as VaccineKey[]).map((key) => (
                                <option key={key} value={key}>
                                    {vaccineDatabase[key].disease_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* TIME GENERATOR CONTROL */}
                    {vaccine && (
                        <div>
                            <label className="mb-2 block text-xs font-bold tracking-wider text-emerald-800 uppercase">
                                {vaccine.is_relative_to_birth
                                    ? "Child's Birth Date"
                                    : "First Dose Milestone Base Date"}
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-lg border border-(--color-border-muted) bg-(--color-surface-page) p-3 font-medium text-(--color-text-primary) shadow-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={initialDate}
                                onChange={(e) => setInitialDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* EMPTY STATE */}
                {!vaccine && (
                    <div className="mx-auto max-w-5xl rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-10 text-center shadow-sm">
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                            📅
                        </div>
                        <p className="text-lg font-semibold text-(--color-text-primary)">
                            No vaccine selected
                        </p>
                        <p className="mt-1 text-sm text-(--color-text-secondary)">
                            Choose a vaccine above to unlock tracking tools:
                        </p>
                        <ul className="mx-auto mt-4 max-w-sm space-y-2.5 rounded-lg border border-(--color-border-muted) bg-slate-50 p-4 text-left text-sm text-(--color-text-secondary) dark:text-blue-900">
                            <li className="flex items-center gap-2">
                                <span>📅</span> Dynamic projected immunization schedule
                            </li>
                            <li className="flex items-center gap-2">
                                <span>⚠️</span> Side effects split parameters (mild vs severe)
                            </li>
                            <li className="flex items-center gap-2">
                                <span>🩹</span> Clinical step-by-step aftercare instructions
                            </li>
                        </ul>
                    </div>
                )}

                {/* MAIN CONTENT CANVAS */}
                {vaccine && (
                    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* LEFT COLUMN: VACCINE DETAILS METADATA */}
                        <div className="flex h-fit flex-col justify-between rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-6 shadow-sm lg:sticky lg:top-6">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-(--color-text-primary)">
                                    {vaccine.disease_name}
                                </h2>
                                <span className="mt-2 inline-block rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                    {vaccine.vaccine_name}
                                </span>

                                <div className="mt-5 space-y-3 border-t border-(--color-border-muted) pt-4 text-sm text-(--color-text-secondary)">
                                    <p>
                                        <b className="font-semibold text-(--color-text-primary)">
                                            Target Groups:
                                        </b>{" "}
                                        {vaccine.target_groups.join(", ")}
                                    </p>
                                    <p>
                                        <b className="font-semibold text-(--color-text-primary)">
                                            Total Doses:
                                        </b>{" "}
                                        {vaccine.total_doses}
                                    </p>
                                    <p>
                                        <b className="font-semibold text-(--color-text-primary)">
                                            Effectiveness:
                                        </b>{" "}
                                        {vaccine.effectiveness}
                                    </p>
                                    <p>
                                        <b className="font-semibold text-(--color-text-primary)">
                                            Classification:
                                        </b>{" "}
                                        {vaccine.category}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 rounded-lg border border-t border-(--color-border-muted) bg-slate-50 p-3 pt-4 text-xs leading-relaxed text-(--color-text-secondary)">
                                <span className="mb-1 block font-bold text-(--color-text-secondary) not-italic dark:text-gray-900">
                                    About Disease:
                                </span>
                                <span className="italic dark:text-gray-900">
                                    {vaccine.disease_summary}
                                </span>
                            </div>
                        </div>

                        {/* MIDDLE & RIGHT COMBINED COLUMN: TIMELINE, SYMPTOMS & SAFETY INSIGHTS */}
                        <div className="space-y-6 lg:col-span-2">
                            <h3 className="flex items-center gap-1.5 text-lg font-bold text-(--color-text-primary)">
                                <span>📅</span> Immunization Schedule Layout
                            </h3>

                            {/* GENERATED DOSES RENDER LOOP */}
                            <div className="space-y-3">
                                {(vaccine.dosing_intervals_weeks || []).map((weeks, index) => {
                                    const dateString = calculateMilestoneDate(weeks);

                                    let labelHeader = "";
                                    if (vaccine.is_relative_to_birth) {
                                        labelHeader =
                                            weeks === 0
                                                ? "At Birth Administration"
                                                : `At ${weeks} Weeks of Age`;
                                    } else {
                                        labelHeader =
                                            index === 0
                                                ? "Initial Administration (Baseline)"
                                                : `Dose Step ${index + 1} (+${weeks} weeks later)`;
                                    }

                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center gap-4 rounded-xl border border-(--color-border-muted) bg-(--color-surface-page) p-4 transition-colors"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 font-bold text-emerald-800">
                                                {index + 1}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-(--color-text-primary) sm:text-base">
                                                    {labelHeader}
                                                </p>
                                                <p
                                                    className={`mt-0.5 text-xs sm:text-sm ${dateString ? "font-semibold text-emerald-700" : "mt-1 inline-block rounded border border-amber-100/50 bg-amber-50/50 px-2 py-0.5 font-medium text-amber-700"}`}
                                                >
                                                    {dateString
                                                        ? `🎯 Target Execution Date: ${dateString}`
                                                        : "⚠️ Select a date above to project scheduled timelines"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* SIDE EFFECTS CONDITIONAL ARRAYS GRID */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-4">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-amber-800 uppercase">
                                        <span>🟢</span> Common Post-Effects
                                    </h4>
                                    <ul className="mt-2.5 ml-5 list-disc space-y-1.5 text-xs font-medium text-amber-950 sm:text-sm">
                                        {vaccine.side_effects.common.map((effect, index) => (
                                            <li key={index}>{effect}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 p-4">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-rose-800 uppercase">
                                        <span>🛑</span> Severe Reactions
                                    </h4>
                                    <ul className="mt-2.5 ml-5 list-disc space-y-1.5 text-xs font-medium text-rose-950 sm:text-sm">
                                        {vaccine.side_effects.severe.map((effect, index) => (
                                            <li key={index}>{effect}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* AFTERCARE DATA FRAME */}
                            <div className="rounded-xl border border-sky-200/60 bg-sky-50 p-4">
                                <h4 className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-sky-800 uppercase">
                                    <span>🩹</span> Immediate Aftercare Guidance
                                </h4>
                                <p className="mt-2 text-xs leading-relaxed font-medium text-sky-950 sm:text-sm">
                                    {vaccine.aftercare_text}
                                </p>
                            </div>

                            {/* SYSTEM LEGAL DISCLAIMER FOOTER COMPONENT */}
                            <p className="mt-6 block border-t border-(--color-border-muted) pt-4 text-center text-[11px] leading-normal text-(--color-text-secondary) italic">
                                {VACCINE_GLOBAL_DISCLAIMER}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
