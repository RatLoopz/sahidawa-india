"use client";

import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    LogIn,
    Pill,
    Plus,
    RefreshCw,
    XCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import Card from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchTodaySummary, logDose, type TodaySchedule } from "@/lib/scheduleApi";
import { useSession } from "@/src/components/AuthProvider";

function formatTime(time: string): string {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

function DoseStatus({ status }: { status: string }) {
    if (status === "taken") {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
                Taken
            </span>
        );
    }
    if (status === "skipped") {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <XCircle size={14} />
                Skipped
            </span>
        );
    }
    if (status === "pending") {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Clock size={14} />
                Pending
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
            Upcoming
        </span>
    );
}

function DoseButton({
    scheduleId,
    logDate,
    time,
    currentStatus,
    onStatusChange,
}: {
    scheduleId: string;
    logDate: string;
    time: string;
    currentStatus: string | undefined;
    onStatusChange: (time: string, status: "taken" | "skipped") => void;
}) {
    const [loading, setLoading] = useState(false);

    const handleAction = async (status: "taken" | "skipped") => {
        setLoading(true);
        try {
            await logDose(scheduleId, {
                log_date: logDate,
                log_time: time,
                status,
            });
            onStatusChange(time, status);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    if (currentStatus === "taken") {
        return (
            <button
                type="button"
                onClick={() => handleAction("skipped")}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            >
                <CheckCircle2 size={12} />
                Taken
            </button>
        );
    }

    return (
        <div className="flex gap-1">
            <button
                type="button"
                onClick={() => handleAction("taken")}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
                <CheckCircle2 size={12} />
                Take
            </button>
            <button
                type="button"
                onClick={() => handleAction("skipped")}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-200 disabled:opacity-50 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
            >
                <XCircle size={12} />
                Skip
            </button>
        </div>
    );
}

type LoadState =
    | { kind: "loading" }
    | { kind: "authError" }
    | { kind: "networkError"; message: string }
    | { kind: "ready"; data: TodaySchedule[]; date: string };

export default function SchedulePage() {
    const { token, isLoading: authLoading } = useSession();
    const [state, setState] = useState<LoadState>({ kind: "loading" });
    const [doseStatus, setDoseStatus] = useState<Record<string, string>>({});

    const fetchData = useCallback(async () => {
        if (!token) {
            setState({ kind: "authError" });
            return;
        }

        setState({ kind: "loading" });

        try {
            const summary = await fetchTodaySummary();
            const statusMap: Record<string, string> = {};
            for (const s of summary.schedules) {
                for (const d of s.doses) {
                    if (d.status === "taken" || d.status === "skipped") {
                        statusMap[`${s.id}-${d.time}`] = d.status;
                    }
                }
            }
            setDoseStatus(statusMap);
            setState({ kind: "ready", data: summary.schedules, date: summary.date });
        } catch {
            setState({
                kind: "networkError",
                message: "Cannot reach the API. Is the backend server running on port 4000?",
            });
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading, fetchData]);

    const handleDoseChange = (scheduleId: string, time: string, status: "taken" | "skipped") => {
        setDoseStatus((prev) => ({ ...prev, [`${scheduleId}-${time}`]: status }));
    };

    return (
        <div className="flex min-h-screen flex-col bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            <PageHeader
                title="Medicine Schedule"
                subtitle="Track your daily medications"
                backHref="/"
                variant="light"
            />

            <main className="container mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-(--color-text-primary)">
                            My Medicines
                        </h1>
                        <p className="mt-0.5 text-sm text-(--color-text-secondary)">
                            Track your daily dose schedule and adherence.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={fetchData}
                            disabled={state.kind === "loading"}
                            aria-label="Refresh"
                            className="rounded-full border border-(--color-border-muted) bg-(--color-surface-page) p-2.5 text-(--color-text-secondary) shadow-sm transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary) disabled:opacity-50"
                        >
                            <RefreshCw
                                size={16}
                                className={state.kind === "loading" ? "animate-spin" : ""}
                            />
                        </button>
                        <Link
                            href="/schedule/new"
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                            <Plus size={16} />
                            Add Medicine
                        </Link>
                    </div>
                </div>

                {state.kind === "loading" && (
                    <div className="flex flex-col gap-3" aria-label="Loading">
                        {[1, 2].map((i) => (
                            <Card
                                key={i}
                                className="border-(--color-border-muted) bg-(--color-surface-page)"
                            >
                                <div className="p-4">
                                    <Skeleton className="mb-2 h-5 w-1/3 bg-slate-200 dark:bg-slate-800" />
                                    <Skeleton className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800" />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {state.kind === "authError" && (
                    <EmptyState
                        icon={<LogIn size={26} className="text-amber-600" />}
                        title="Sign in required"
                        description="Please sign in to set up medicine reminders."
                        actionLabel="Go to Login"
                        actionHref="/login"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "networkError" && (
                    <EmptyState
                        icon={<AlertTriangle size={26} className="text-rose-600" />}
                        title="Connection Error"
                        description={state.message}
                        actionLabel="Try again"
                        onAction={fetchData}
                        className="border-rose-200 bg-(--color-surface-page)! dark:border-rose-950/40"
                    />
                )}

                {state.kind === "ready" && state.data.length === 0 && (
                    <EmptyState
                        icon={<Pill size={26} className="text-emerald-600" />}
                        title="No medicines tracked yet"
                        description="Add your first medicine to start tracking doses and getting reminders."
                        actionLabel="Add Medicine"
                        actionHref="/schedule/new"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "ready" && state.data.length > 0 && (
                    <>
                        <div className="mb-4 flex items-center gap-2">
                            <Clock size={16} className="text-(--color-text-muted)" />
                            <span className="text-sm font-medium text-(--color-text-secondary)">
                                Today &mdash;{" "}
                                {new Date(state.date).toLocaleDateString(undefined, {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </span>
                        </div>

                        <section className="flex flex-col gap-3" aria-label="Today's schedule">
                            {state.data.map((schedule) => {
                                const completed = schedule.doses.every(
                                    (d) =>
                                        (doseStatus[`${schedule.id}-${d.time}`] ?? d.status) ===
                                        "taken"
                                );
                                return (
                                    <Card
                                        key={schedule.id}
                                        className={`border-l-4 bg-(--color-surface-page) ${
                                            completed
                                                ? "border-l-emerald-500"
                                                : "border-l-amber-500"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between p-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="truncate font-bold text-(--color-text-primary)">
                                                        {schedule.medicine_name}
                                                    </h3>
                                                    {completed && (
                                                        <CheckCircle2
                                                            size={16}
                                                            className="shrink-0 text-emerald-500"
                                                        />
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-sm text-(--color-text-secondary)">
                                                    {schedule.dosage}
                                                </p>
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {schedule.doses.map((dose) => {
                                                        const effectiveStatus =
                                                            doseStatus[
                                                                `${schedule.id}-${dose.time}`
                                                            ] ?? dose.status;
                                                        return (
                                                            <div
                                                                key={dose.time}
                                                                className="flex items-center justify-between gap-2 rounded-lg bg-(--color-surface-muted) px-3 py-2"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono text-sm font-bold text-(--color-text-primary)">
                                                                        {formatTime(dose.time)}
                                                                    </span>
                                                                    <DoseStatus
                                                                        status={effectiveStatus}
                                                                    />
                                                                </div>
                                                                <DoseButton
                                                                    scheduleId={schedule.id}
                                                                    logDate={state.date}
                                                                    time={dose.time}
                                                                    currentStatus={effectiveStatus}
                                                                    onStatusChange={(
                                                                        time,
                                                                        status
                                                                    ) =>
                                                                        handleDoseChange(
                                                                            schedule.id,
                                                                            time,
                                                                            status
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
