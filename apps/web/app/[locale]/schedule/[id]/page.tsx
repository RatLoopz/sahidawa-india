"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { AlertTriangle, LogIn, Pill, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "../../components/PageHeader";
import Card from "@/components/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    fetchSchedule,
    fetchAdherenceStats,
    deleteSchedule,
    updateSchedule,
    type Schedule,
    type AdherenceStats,
} from "@/lib/scheduleApi";
import { useSession } from "@/src/components/AuthProvider";
import { formatTime } from "@/lib/medicineDateUtils";

type LoadState =
    | { kind: "loading" }
    | { kind: "authError" }
    | { kind: "networkError"; message: string }
    | { kind: "notFound" }
    | { kind: "ready"; schedule: Schedule; stats: AdherenceStats | null };

export default function ScheduleDetailPage() {
    const t = useTranslations("scheduleDetail");
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { token, isLoading: authLoading } = useSession();
    const [state, setState] = useState<LoadState>({ kind: "loading" });
    const [deleting, setDeleting] = useState(false);

    const fetchData = useCallback(async () => {
        if (!token) {
            setState({ kind: "authError" });
            return;
        }

        setState({ kind: "loading" });

        try {
            const schedule = await fetchSchedule(params.id);
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 6);

            const from = weekAgo.toISOString().split("T")[0];
            const to = today.toISOString().split("T")[0];

            const { stats } = await fetchAdherenceStats(params.id, from, to);
            setState({ kind: "ready", schedule, stats });
        } catch (err) {
            if (err instanceof Error && err.message === "Failed to fetch schedule") {
                setState({ kind: "notFound" });
            } else {
                setState({
                    kind: "networkError",
                    message: t("networkErrorMessage"),
                });
            }
        }
    }, [params.id, token]);

    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [authLoading, fetchData]);

    const handleToggleActive = async () => {
        if (state.kind !== "ready") return;
        try {
            const updated = await updateSchedule(state.schedule.id, {
                is_active: !state.schedule.is_active,
            });
            setState({ ...state, schedule: updated });
        } catch {
            // silently fail
        }
    };

    const handleDelete = async () => {
        if (!confirm(t("deleteConfirm"))) return;
        setDeleting(true);
        try {
            await deleteSchedule(state.kind === "ready" ? state.schedule.id : params.id);
            router.push("/schedule");
        } catch {
            setDeleting(false);
        }
    };

    function formatDate(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    return (
        <div className="flex min-h-screen flex-col bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            <PageHeader
                title={t("pageTitle")}
                subtitle={t("pageSubtitle")}
                backHref="/schedule"
                variant="light"
            />

            <main className="container mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:px-6 md:py-10">
                {state.kind === "loading" && (
                    <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                        <div className="p-6">
                            <Skeleton className="mb-3 h-6 w-1/2 bg-slate-200 dark:bg-slate-800" />
                            <Skeleton className="mb-2 h-4 w-3/4 bg-slate-200 dark:bg-slate-800" />
                            <Skeleton className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800" />
                        </div>
                    </Card>
                )}

                {state.kind === "authError" && (
                    <EmptyState
                        icon={<LogIn size={26} className="text-amber-600" />}
                        title={t("authErrorTitle")}
                        description={t("authErrorDescription")}
                        actionLabel={t("authErrorAction")}
                        actionHref="/login"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "networkError" && (
                    <EmptyState
                        icon={<AlertTriangle size={26} className="text-rose-600" />}
                        title={t("networkErrorTitle")}
                        description={state.message}
                        actionLabel={t("networkErrorAction")}
                        onAction={fetchData}
                        className="border-rose-200 bg-(--color-surface-page)! dark:border-rose-950/40"
                    />
                )}

                {state.kind === "notFound" && (
                    <EmptyState
                        icon={<Pill size={26} className="text-slate-400" />}
                        title={t("notFoundTitle")}
                        description={t("notFoundDescription")}
                        actionLabel={t("notFoundAction")}
                        actionHref="/schedule"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "ready" && (
                    <div className="flex flex-col gap-4">
                        <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-black text-(--color-text-primary)">
                                            {state.schedule.medicine_name}
                                        </h2>
                                        <p className="mt-0.5 text-sm text-(--color-text-secondary)">
                                            {state.schedule.dosage}
                                        </p>
                                    </div>
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                            state.schedule.is_active
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                : "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400"
                                        }`}
                                    >
                                        {state.schedule.is_active
                                            ? t("statusActive")
                                            : t("statusPaused")}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-(--color-text-muted)">
                                            {t("frequencyLabel")}
                                        </span>
                                        <p className="mt-0.5 font-semibold text-(--color-text-primary)">
                                            {t("frequencyValue", {
                                                count: state.schedule.frequency,
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-(--color-text-muted)">
                                            {t("timesLabel")}
                                        </span>
                                        <p className="mt-0.5 font-semibold text-(--color-text-primary)">
                                            {(state.schedule.times as string[])
                                                .map(formatTime)
                                                .join(", ")}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-(--color-text-muted)">
                                            {t("startDateLabel")}
                                        </span>
                                        <p className="mt-0.5 font-semibold text-(--color-text-primary)">
                                            {formatDate(state.schedule.start_date)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-(--color-text-muted)">
                                            {t("endDateLabel")}
                                        </span>
                                        <p className="mt-0.5 font-semibold text-(--color-text-primary)">
                                            {state.schedule.end_date
                                                ? formatDate(state.schedule.end_date)
                                                : t("ongoing")}
                                        </p>
                                    </div>
                                    {state.schedule.notes && (
                                        <div className="col-span-2">
                                            <span className="font-medium text-(--color-text-muted)">
                                                {t("notesLabel")}
                                            </span>
                                            <p className="mt-0.5 font-semibold text-(--color-text-primary)">
                                                {state.schedule.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 flex items-center gap-3 border-t border-(--color-border-muted) pt-4">
                                    <button
                                        type="button"
                                        onClick={handleToggleActive}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border-muted) px-3 py-2 text-sm font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)"
                                    >
                                        {state.schedule.is_active ? t("pause") : t("resume")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:hover:bg-rose-950/30"
                                    >
                                        <Trash2 size={14} />
                                        {deleting ? t("deleting") : t("delete")}
                                    </button>
                                </div>
                            </div>
                        </Card>

                        {state.stats && (
                            <Card className="border-(--color-border-muted) bg-(--color-surface-page)">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-bold text-(--color-text-primary)">
                                        {t("adherenceTitle")}
                                    </h3>

                                    <div className="mb-4 flex items-center gap-4">
                                        <div className="flex flex-col items-center">
                                            <span
                                                className={`text-3xl font-black ${
                                                    state.stats.adherence_percent >= 80
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : state.stats.adherence_percent >= 50
                                                          ? "text-amber-600 dark:text-amber-400"
                                                          : "text-rose-600 dark:text-rose-400"
                                                }`}
                                            >
                                                {state.stats.adherence_percent}%
                                            </span>
                                            <span className="text-xs text-(--color-text-muted)">
                                                {t("adherenceLabel")}
                                            </span>
                                        </div>
                                        <div className="flex flex-1 gap-4">
                                            <div className="flex flex-col items-center rounded-lg bg-(--color-surface-muted) px-3 py-2">
                                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                    {state.stats.taken}
                                                </span>
                                                <span className="text-xs text-(--color-text-muted)">
                                                    {t("statTaken")}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center rounded-lg bg-(--color-surface-muted) px-3 py-2">
                                                <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                                                    {state.stats.skipped}
                                                </span>
                                                <span className="text-xs text-(--color-text-muted)">
                                                    {t("statSkipped")}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center rounded-lg bg-(--color-surface-muted) px-3 py-2">
                                                <span className="text-lg font-bold text-(--color-text-primary)">
                                                    {state.stats.expected_doses}
                                                </span>
                                                <span className="text-xs text-(--color-text-muted)">
                                                    {t("statExpected")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-surface-muted)">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                state.stats.adherence_percent >= 80
                                                    ? "bg-emerald-500"
                                                    : state.stats.adherence_percent >= 50
                                                      ? "bg-amber-500"
                                                      : "bg-rose-500"
                                            }`}
                                            style={{
                                                width: `${state.stats.adherence_percent}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
