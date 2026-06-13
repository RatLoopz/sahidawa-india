"use client";

import {
    ChildVaccinationScheduleItem,
    NATIONAL_IMMUNIZATION_SCHEDULE,
    NATIONAL_IMMUNIZATION_SOURCE,
    VaccinationStatus,
    generateChildVaccinationSchedule,
    getTodayDateInput,
    validateChildDateOfBirth,
} from "@/lib/childVaccinationSchedule";
import { supabase } from "@/lib/supabase";
import {
    AlertCircle,
    Baby,
    CalendarDays,
    CheckCircle2,
    Circle,
    Clock,
    Download,
} from "lucide-react";
import { useFormatter } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

interface ChildTrackerState {
    childName: string;
    dateOfBirth: string;
    completedDoseIds: string[];
}

const EMPTY_TRACKER_STATE: ChildTrackerState = {
    childName: "",
    dateOfBirth: "",
    completedDoseIds: [],
};

const CHILD_NAME_MAX_LENGTH = 80;
const VALID_DOSE_IDS = new Set(NATIONAL_IMMUNIZATION_SCHEDULE.map((item) => item.id));
const TRACKER_STORAGE_KEY = "vaccine-hub-child-tracker-v1";

type SyncContext =
    | { status: "loading" }
    | { status: "local" }
    | { status: "cloud"; userId: string; profileId: string | null };

interface CloudChildProfile {
    id: string;
    name: string;
    date_of_birth: string;
}

interface CloudCompletedVaccination {
    dose_id: string;
}

const TRACKER_COPY = {
    childTrackerTitle: "Child Vaccination Tracker",
    childTrackerSubtitle:
        "Enter a child profile to generate a personalized National Immunization Schedule timeline with completion tracking.",
    childReminderButton: "Download reminders",
    childNameLabel: "Child name",
    childNamePlaceholder: "Enter child name",
    childDobLabel: "Date of birth",
    childDefaultName: "Child",
    childDobPrompt: "Enter a date of birth to generate the personalized vaccination timeline.",
    childDobFutureError: "Date of birth cannot be in the future.",
    childDobInvalidError: "Enter a valid date of birth.",
    childProfileSummary: "Child profile",
    scheduleSourceLabel: "Schedule basis",
    childTimelineHeading: "Personalized timeline",
    whereApplicableBadge: "Where applicable",
    dueDateLabel: "Due date",
    officialTimingLabel: "Official timing",
    completedStatus: "Completed",
    dueStatus: "Due",
    overdueStatus: "Overdue",
    upcomingStatus: "Upcoming",
    markCompleteButton: "Mark completed",
} as const;

const STATUS_STYLES: Record<
    VaccinationStatus,
    {
        badge: string;
        border: string;
        icon: string;
    }
> = {
    completed: {
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100",
        border: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
        icon: "text-emerald-600 dark:text-emerald-300",
    },
    due: {
        badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-100",
        border: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30",
        icon: "text-sky-600 dark:text-sky-300",
    },
    overdue: {
        badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-100",
        border: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
        icon: "text-rose-600 dark:text-rose-300",
    },
    upcoming: {
        badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
        border: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
        icon: "text-slate-500 dark:text-slate-300",
    },
};

export function ChildVaccinationTracker() {
    const format = useFormatter();
    const nameInputId = useId();
    const dobInputId = useId();
    const todayDateInput = useMemo(() => getTodayDateInput(), []);
    const [tracker, setTracker] = useState<ChildTrackerState>(EMPTY_TRACKER_STATE);
    const [syncContext, setSyncContext] = useState<SyncContext>({ status: "loading" });
    const hasUserEditedRef = useRef(false);
    const profileSyncSignatureRef = useRef<string | null>(null);
    const cloudCompletedDoseIdsRef = useRef<Set<string>>(new Set());

    const dobValidation = validateChildDateOfBirth(tracker.dateOfBirth, todayDateInput);
    const schedule = useMemo(
        () =>
            dobValidation.isValid
                ? generateChildVaccinationSchedule(
                      tracker.dateOfBirth,
                      todayDateInput,
                      tracker.completedDoseIds
                  )
                : [],
        [dobValidation.isValid, todayDateInput, tracker.completedDoseIds, tracker.dateOfBirth]
    );
    const statusCounts = useMemo(() => getStatusCounts(schedule), [schedule]);
    const childDisplayName = tracker.childName.trim() || TRACKER_COPY.childDefaultName;
    const cloudUserId = syncContext.status === "cloud" ? syncContext.userId : null;
    const cloudProfileId = syncContext.status === "cloud" ? syncContext.profileId : null;

    const validationMessage =
        !dobValidation.isValid && dobValidation.reason !== "missing"
            ? getDobValidationMessage(dobValidation.reason)
            : null;

    useEffect(() => {
        let isActive = true;

        const loadTrackerState = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                const userId = session?.user?.id;

                if (!isActive) return;

                if (!userId) {
                    if (!hasUserEditedRef.current) {
                        setTracker(readLocalTrackerState());
                    }
                    setSyncContext({ status: "local" });
                    return;
                }

                setSyncContext({ status: "cloud", userId, profileId: null });

                const { data: profile, error: profileError } = await supabase
                    .from("child_profiles")
                    .select("id,name,date_of_birth")
                    .eq("user_id", userId)
                    .maybeSingle();

                if (!isActive || profileError || !profile) return;

                const typedProfile = profile as CloudChildProfile;
                const { data: completedRows, error: completedError } = await supabase
                    .from("child_completed_vaccinations")
                    .select("dose_id")
                    .eq("child_profile_id", typedProfile.id);

                if (!isActive || completedError) return;

                const completedDoseIds = normalizeCompletedDoseIds(
                    ((completedRows ?? []) as CloudCompletedVaccination[]).map((row) => row.dose_id)
                );

                profileSyncSignatureRef.current = getProfileSyncSignature({
                    childName: typedProfile.name,
                    dateOfBirth: typedProfile.date_of_birth,
                });
                cloudCompletedDoseIdsRef.current = new Set(completedDoseIds);
                if (!hasUserEditedRef.current) {
                    setTracker({
                        childName: typedProfile.name,
                        dateOfBirth: typedProfile.date_of_birth,
                        completedDoseIds,
                    });
                }
                setSyncContext({ status: "cloud", userId, profileId: typedProfile.id });
            } catch {
                if (!isActive) return;

                if (!hasUserEditedRef.current) {
                    setTracker(readLocalTrackerState());
                }
                setSyncContext({ status: "local" });
            }
        };

        loadTrackerState();

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        if (syncContext.status !== "local") return;

        writeLocalTrackerState(tracker);
    }, [syncContext.status, tracker]);

    useEffect(() => {
        if (!cloudUserId || !dobValidation.isValid) return;

        const profileState = {
            user_id: cloudUserId,
            name: childDisplayName,
            date_of_birth: tracker.dateOfBirth,
        };
        const signature = getProfileSyncSignature({
            childName: profileState.name,
            dateOfBirth: profileState.date_of_birth,
        });

        if (profileSyncSignatureRef.current === signature) return;

        let isActive = true;

        const syncProfile = async () => {
            const { data, error } = await supabase
                .from("child_profiles")
                .upsert(profileState, { onConflict: "user_id" })
                .select("id,name,date_of_birth")
                .single();

            if (!isActive || error || !data) return;

            const profile = data as CloudChildProfile;
            profileSyncSignatureRef.current = signature;
            setSyncContext((current) =>
                current.status === "cloud" ? { ...current, profileId: profile.id } : current
            );
        };

        syncProfile();

        return () => {
            isActive = false;
        };
    }, [childDisplayName, cloudUserId, dobValidation.isValid, tracker.dateOfBirth]);

    useEffect(() => {
        if (!cloudProfileId) return;

        const nextCompletedDoseIds = new Set(normalizeCompletedDoseIds(tracker.completedDoseIds));
        const previousCompletedDoseIds = cloudCompletedDoseIdsRef.current;
        const addedDoseIds = Array.from(nextCompletedDoseIds).filter(
            (doseId) => !previousCompletedDoseIds.has(doseId)
        );
        const removedDoseIds = Array.from(previousCompletedDoseIds).filter(
            (doseId) => !nextCompletedDoseIds.has(doseId)
        );

        if (!addedDoseIds.length && !removedDoseIds.length) return;

        cloudCompletedDoseIdsRef.current = nextCompletedDoseIds;

        const syncCompletedDoseIds = async () => {
            await Promise.all([
                ...addedDoseIds.map((doseId) =>
                    supabase.from("child_completed_vaccinations").insert({
                        child_profile_id: cloudProfileId,
                        dose_id: doseId,
                    })
                ),
                ...removedDoseIds.map((doseId) =>
                    supabase
                        .from("child_completed_vaccinations")
                        .delete()
                        .eq("child_profile_id", cloudProfileId)
                        .eq("dose_id", doseId)
                ),
            ]);
        };

        syncCompletedDoseIds();
    }, [cloudProfileId, tracker.completedDoseIds]);

    const handleNameChange = (childName: string) => {
        hasUserEditedRef.current = true;
        setTracker((current) => ({
            ...current,
            childName: childName.slice(0, CHILD_NAME_MAX_LENGTH),
        }));
    };

    const handleDateOfBirthChange = (dateOfBirth: string) => {
        hasUserEditedRef.current = true;
        setTracker((current) => ({
            ...current,
            dateOfBirth,
            completedDoseIds: dateOfBirth === current.dateOfBirth ? current.completedDoseIds : [],
        }));
    };

    const toggleDose = (doseId: string) => {
        hasUserEditedRef.current = true;
        setTracker((current) => {
            const completed = new Set(current.completedDoseIds);

            if (completed.has(doseId)) {
                completed.delete(doseId);
            } else {
                completed.add(doseId);
            }

            return {
                ...current,
                completedDoseIds: Array.from(completed).filter((id) => VALID_DOSE_IDS.has(id)),
            };
        });
    };

    const downloadCalendarReminders = () => {
        if (!schedule.length) return;

        const childSlug = childDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "child";
        const filename = `sahidawa-${childSlug}-vaccination-schedule.ics`;
        const blob = new Blob([createCalendarFile(childDisplayName, schedule)], {
            type: "text/calendar;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <Baby size={22} aria-hidden="true" />
                        <h2 className="text-xl font-bold text-(--color-text-primary)">
                            {TRACKER_COPY.childTrackerTitle}
                        </h2>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-(--color-text-secondary)">
                        {TRACKER_COPY.childTrackerSubtitle}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={downloadCalendarReminders}
                    disabled={!schedule.length}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Download size={16} aria-hidden="true" />
                    {TRACKER_COPY.childReminderButton}
                </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="space-y-2">
                    <label
                        htmlFor={nameInputId}
                        className="block text-xs font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300"
                    >
                        {TRACKER_COPY.childNameLabel}
                    </label>
                    <input
                        id={nameInputId}
                        type="text"
                        value={tracker.childName}
                        maxLength={CHILD_NAME_MAX_LENGTH}
                        onChange={(event) => handleNameChange(event.target.value)}
                        placeholder={TRACKER_COPY.childNamePlaceholder}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-inset dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-700"
                    />
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor={dobInputId}
                        className="block text-xs font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300"
                    >
                        {TRACKER_COPY.childDobLabel}
                    </label>
                    <input
                        id={dobInputId}
                        type="date"
                        value={tracker.dateOfBirth}
                        max={todayDateInput}
                        onChange={(event) => handleDateOfBirthChange(event.target.value)}
                        aria-invalid={validationMessage ? "true" : "false"}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-(--color-text-primary) shadow-sm transition-all outline-none hover:bg-(--color-surface-muted) focus:ring-2 focus:ring-emerald-500 focus:ring-inset dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-700"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-80">
                    <TrackerMetric
                        label={TRACKER_COPY.completedStatus}
                        value={statusCounts.completed}
                    />
                    <TrackerMetric label={TRACKER_COPY.dueStatus} value={statusCounts.due} />
                    <TrackerMetric
                        label={TRACKER_COPY.overdueStatus}
                        value={statusCounts.overdue}
                    />
                    <TrackerMetric
                        label={TRACKER_COPY.upcomingStatus}
                        value={statusCounts.upcoming}
                    />
                </div>
            </div>

            {validationMessage && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{validationMessage}</span>
                    </p>
                </div>
            )}

            {!tracker.dateOfBirth && (
                <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-(--color-surface-muted) p-4 text-sm text-(--color-text-secondary) dark:border-slate-700 dark:bg-slate-900">
                    <p className="flex items-start gap-2">
                        <CalendarDays
                            size={16}
                            className="mt-0.5 shrink-0 text-emerald-600"
                            aria-hidden="true"
                        />
                        <span>{TRACKER_COPY.childDobPrompt}</span>
                    </p>
                </div>
            )}

            {schedule.length > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <aside className="rounded-lg border border-slate-200 bg-(--color-surface-muted) p-4 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                            {TRACKER_COPY.childProfileSummary}
                        </p>
                        <p className="mt-2 text-lg font-bold [overflow-wrap:anywhere] break-words text-(--color-text-primary)">
                            {childDisplayName}
                        </p>
                        <dl className="mt-4 space-y-3 text-sm">
                            <div>
                                <dt className="text-(--color-text-muted)">
                                    {TRACKER_COPY.childDobLabel}
                                </dt>
                                <dd className="font-semibold text-(--color-text-primary)">
                                    {formatDateForDisplay(tracker.dateOfBirth, format)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-(--color-text-muted)">
                                    {TRACKER_COPY.scheduleSourceLabel}
                                </dt>
                                <dd className="font-medium text-(--color-text-secondary)">
                                    {NATIONAL_IMMUNIZATION_SOURCE}
                                </dd>
                            </div>
                        </dl>
                    </aside>

                    <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Clock size={18} className="text-emerald-600" aria-hidden="true" />
                                <h3 className="text-lg font-bold text-(--color-text-primary)">
                                    {TRACKER_COPY.childTimelineHeading}
                                </h3>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                                {formatDoseCount(schedule.length)}
                            </span>
                        </div>

                        <ol className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                            {schedule.map((item) => (
                                <li key={item.id}>
                                    <ScheduleTimelineItem
                                        item={item}
                                        format={format}
                                        onToggle={() => toggleDose(item.id)}
                                    />
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
        </section>
    );
}

function readLocalTrackerState(): ChildTrackerState {
    if (typeof window === "undefined") return EMPTY_TRACKER_STATE;

    try {
        const stored = window.localStorage.getItem(TRACKER_STORAGE_KEY);

        if (!stored) return EMPTY_TRACKER_STATE;

        const parsed = JSON.parse(stored) as Partial<ChildTrackerState>;

        return {
            childName:
                typeof parsed.childName === "string"
                    ? parsed.childName.slice(0, CHILD_NAME_MAX_LENGTH)
                    : "",
            dateOfBirth: typeof parsed.dateOfBirth === "string" ? parsed.dateOfBirth : "",
            completedDoseIds: Array.isArray(parsed.completedDoseIds)
                ? normalizeCompletedDoseIds(parsed.completedDoseIds)
                : [],
        };
    } catch {
        return EMPTY_TRACKER_STATE;
    }
}

function writeLocalTrackerState(state: ChildTrackerState) {
    if (typeof window === "undefined") return;

    const normalizedState = {
        ...state,
        completedDoseIds: normalizeCompletedDoseIds(state.completedDoseIds),
    };

    if (
        !normalizedState.childName &&
        !normalizedState.dateOfBirth &&
        !normalizedState.completedDoseIds.length
    ) {
        window.localStorage.removeItem(TRACKER_STORAGE_KEY);
        return;
    }

    window.localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(normalizedState));
}

function normalizeCompletedDoseIds(doseIds: unknown[]): string[] {
    return Array.from(
        new Set(
            doseIds.filter((id): id is string => typeof id === "string" && VALID_DOSE_IDS.has(id))
        )
    );
}

function getProfileSyncSignature(state: Pick<ChildTrackerState, "childName" | "dateOfBirth">) {
    return `${state.childName}\n${state.dateOfBirth}`;
}

function ScheduleTimelineItem({
    item,
    format,
    onToggle,
}: {
    item: ChildVaccinationScheduleItem;
    format: ReturnType<typeof useFormatter>;
    onToggle: () => void;
}) {
    const styles = STATUS_STYLES[item.status];
    const isCompleted = item.status === "completed";

    return (
        <article
            className={`rounded-lg border p-4 transition-colors ${styles.border}`}
            aria-label={`${item.vaccineName} ${item.doseLabel}`}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${styles.badge}`}
                        >
                            {getStatusLabel(item.status)}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                            {item.stage}
                        </span>
                        {item.isAreaSpecific && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-100">
                                {TRACKER_COPY.whereApplicableBadge}
                            </span>
                        )}
                    </div>

                    <div className="mt-3">
                        <h4 className="text-base font-bold text-(--color-text-primary)">
                            {item.vaccineName}
                        </h4>
                        <p className="mt-1 text-sm font-medium text-(--color-text-secondary)">
                            {item.doseLabel} - {item.protectsAgainst}
                        </p>
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                                {TRACKER_COPY.dueDateLabel}
                            </dt>
                            <dd className="mt-1 flex items-center gap-2 font-semibold text-(--color-text-primary)">
                                <CalendarDays
                                    size={15}
                                    className={styles.icon}
                                    aria-hidden="true"
                                />
                                {formatDateForDisplay(item.dueDate, format)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                                {TRACKER_COPY.officialTimingLabel}
                            </dt>
                            <dd className="mt-1 font-semibold text-(--color-text-primary)">
                                {item.dueWindowEndDate
                                    ? `${formatDateForDisplay(item.dueDate, format)} - ${formatDateForDisplay(item.dueWindowEndDate, format)}`
                                    : item.timingLabel}
                            </dd>
                        </div>
                    </dl>

                    {item.notes && (
                        <p className="mt-3 text-xs leading-5 text-(--color-text-muted)">
                            {item.notes}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    aria-pressed={isCompleted}
                    aria-label={
                        isCompleted
                            ? `Mark ${item.vaccineName} due`
                            : `Mark ${item.vaccineName} completed`
                    }
                    className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        isCompleted
                            ? "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                >
                    {isCompleted ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                    ) : (
                        <Circle size={16} aria-hidden="true" />
                    )}
                    {isCompleted ? TRACKER_COPY.completedStatus : TRACKER_COPY.markCompleteButton}
                </button>
            </div>
        </article>
    );
}

function TrackerMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-(--color-surface-muted) px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-lg font-bold text-(--color-text-primary)">{value}</p>
            <p className="text-[11px] font-semibold tracking-wide text-(--color-text-muted) uppercase">
                {label}
            </p>
        </div>
    );
}

function getStatusCounts(schedule: ChildVaccinationScheduleItem[]) {
    return schedule.reduce(
        (counts, item) => {
            counts[item.status] += 1;

            return counts;
        },
        {
            completed: 0,
            due: 0,
            overdue: 0,
            upcoming: 0,
        } satisfies Record<VaccinationStatus, number>
    );
}

function getStatusLabel(status: VaccinationStatus) {
    switch (status) {
        case "completed":
            return TRACKER_COPY.completedStatus;
        case "due":
            return TRACKER_COPY.dueStatus;
        case "overdue":
            return TRACKER_COPY.overdueStatus;
        case "upcoming":
            return TRACKER_COPY.upcomingStatus;
    }
}

function getDobValidationMessage(reason: "invalid" | "future") {
    return reason === "future"
        ? TRACKER_COPY.childDobFutureError
        : TRACKER_COPY.childDobInvalidError;
}

function formatDoseCount(count: number): string {
    return count === 1 ? "1 dose" : `${count} doses`;
}

function formatDateForDisplay(dateInput: string, format: ReturnType<typeof useFormatter>): string {
    const [year, month, day] = dateInput.split("-").map(Number);

    return format.dateTime(new Date(year, month - 1, day), {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function createCalendarFile(childName: string, schedule: ChildVaccinationScheduleItem[]): string {
    const dtstamp = formatICSDateTime(new Date());
    const events = schedule
        .filter((item) => item.status !== "completed")
        .map((item) => {
            const endDate = addOneCalendarDay(item.dueDate);

            return [
                "BEGIN:VEVENT",
                `UID:sahidawa-child-${item.id}-${item.dueDate}`,
                `DTSTAMP:${dtstamp}`,
                `SUMMARY:${escapeICSText(`${item.vaccineName} due for ${childName}`)}`,
                `DESCRIPTION:${escapeICSText(`${item.doseLabel}. ${item.timingLabel}. ${item.protectsAgainst}.`)}`,
                `DTSTART;VALUE=DATE:${formatICSDate(item.dueDate)}`,
                `DTEND;VALUE=DATE:${formatICSDate(endDate)}`,
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                `DESCRIPTION:${escapeICSText(`${item.vaccineName} is due tomorrow.`)}`,
                "TRIGGER:-P1D",
                "END:VALARM",
                "END:VEVENT",
            ].join("\r\n");
        })
        .join("\r\n");

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SahiDawa//Child Vaccination Tracker//EN",
        "CALSCALE:GREGORIAN",
        events,
        "END:VCALENDAR",
    ].join("\r\n");
}

function addOneCalendarDay(dateInput: string): string {
    const [year, month, day] = dateInput.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function formatICSDate(dateInput: string): string {
    return dateInput.replace(/-/g, "");
}

function formatICSDateTime(date: Date): string {
    return (
        date.getUTCFullYear().toString() +
        String(date.getUTCMonth() + 1).padStart(2, "0") +
        String(date.getUTCDate()).padStart(2, "0") +
        "T" +
        String(date.getUTCHours()).padStart(2, "0") +
        String(date.getUTCMinutes()).padStart(2, "0") +
        String(date.getUTCSeconds()).padStart(2, "0") +
        "Z"
    );
}

function escapeICSText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
}
