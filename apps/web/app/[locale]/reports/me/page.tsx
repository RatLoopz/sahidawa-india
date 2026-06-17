"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    ImageOff,
    LogIn,
    MapPin,
    RefreshCw,
    ShieldCheck,
    XCircle,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import Card from "@/components/Card";
import LazyImage from "@/components/LazyImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { API_BASE } from "@/lib/api";
import { useSession } from "@/src/components/AuthProvider";

type ReportStatus = "pending" | "verified_fake" | "false_alarm";

// Only render images served from the upload destination used by ReportWizard
// (Cloudinary). Guards against rendering arbitrary URLs from a corrupted row,
// which would otherwise leak the viewer's IP to a third-party origin.
function isSafePhotoUrl(url: string | null): url is string {
    return url !== null && url.startsWith("https://res.cloudinary.com/");
}

interface MyReport {
    id: string;
    reported_brand_name: string | null;
    scanned_barcode: string | null;
    photo_url: string | null;
    district: string | null;
    status: ReportStatus;
    created_at: string;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

const STATUS_STYLES: Record<ReportStatus, { icon: typeof Clock; chip: string; dot: string }> = {
    pending: {
        icon: Clock,
        chip: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30",
        dot: "bg-amber-500",
    },
    verified_fake: {
        icon: ShieldCheck,
        chip: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30",
        dot: "bg-emerald-500",
    },
    false_alarm: {
        icon: XCircle,
        chip: "bg-(--color-surface-muted) text-(--color-text-secondary) border-(--color-border-muted)",
        dot: "bg-slate-400",
    },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
    const meta = STATUS_STYLES[status as ReportStatus] ?? STATUS_STYLES.pending;
    const Icon = meta.icon;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
        >
            <Icon size={12} />
            {label}
        </span>
    );
}

function ReportCard({
    report,
    statusLabel,
    districtLabel,
    submittedLabel,
    batchLabel,
    noPhotoLabel,
}: {
    report: MyReport;
    statusLabel: string;
    districtLabel: string;
    submittedLabel: string;
    batchLabel: string;
    noPhotoLabel: string;
}) {
    const title =
        report.reported_brand_name?.trim() || report.scanned_barcode || "Unnamed medicine";

    return (
        <Card className="flex flex-col overflow-hidden border-(--color-border-muted) bg-(--color-surface-page) shadow-sm sm:flex-row">
            <div className="flex h-40 shrink-0 items-center justify-center border-r border-(--color-border-muted) bg-(--color-surface-muted) sm:h-32 sm:w-32">
                {isSafePhotoUrl(report.photo_url) ? (
                    <LazyImage
                        src={report.photo_url}
                        alt={`Photo of reported medicine: ${title}`}
                        wrapperClassName="w-full h-full"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center text-(--color-text-muted)">
                        <ImageOff size={24} />
                        <span className="mt-1 text-[10px] font-medium tracking-wider uppercase">
                            {noPhotoLabel}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate font-bold text-(--color-text-primary)">{title}</h3>
                    <StatusBadge status={report.status} label={statusLabel} />
                </div>

                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-text-secondary)">
                    {report.district && (
                        <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-(--color-text-muted)" />
                            <dt className="sr-only">{districtLabel}</dt>
                            <dd>{report.district}</dd>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <Clock size={12} className="text-(--color-text-muted)" />
                        <dt className="sr-only">{submittedLabel}</dt>
                        <dd>{formatDate(report.created_at)}</dd>
                    </div>
                    {report.scanned_barcode && (
                        <div className="flex items-center gap-1">
                            <FileText size={12} className="text-(--color-text-muted)" />
                            <dt className="sr-only">{batchLabel}</dt>
                            <dd className="font-mono">{report.scanned_barcode}</dd>
                        </div>
                    )}
                </dl>
            </div>
        </Card>
    );
}

type LoadState =
    | { kind: "loading" }
    | { kind: "authError"; message: string }
    | { kind: "networkError"; message: string }
    | { kind: "ready"; reports: MyReport[] };

export default function MyReportsPage() {
    const t = useTranslations("MyReports");
    const { token, isLoading: authLoading } = useSession();
    const [state, setState] = useState<LoadState>({ kind: "loading" });

    const fetchMine = useCallback(async () => {
        if (!token) {
            setState({
                kind: "authError",
                message: t("auth_error_description"),
            });
            return;
        }

        setState({ kind: "loading" });

        try {
            const res = await fetch(`${API_BASE}/api/reports/mine`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401) {
                setState({
                    kind: "authError",
                    message: t("auth_error_expired"),
                });
                return;
            }

            if (!res.ok) {
                setState({
                    kind: "networkError",
                    message: `Could not load your reports (status ${res.status}).`,
                });
                return;
            }

            const json = (await res.json()) as { reports?: MyReport[] };
            setState({ kind: "ready", reports: json.reports ?? [] });
        } catch {
            setState({
                kind: "networkError",
                message: t("network_error_api_unreachable"),
            });
        }
    }, [t, token]);

    useEffect(() => {
        if (!authLoading) {
            fetchMine();
        }
    }, [authLoading, fetchMine]);

    const getStatusLabel = (status: ReportStatus): string => {
        switch (status) {
            case "pending":
                return t("status_pending_review");
            case "verified_fake":
                return t("status_verified_fake");
            case "false_alarm":
                return t("status_false_alarm");
            default:
                return t("status_pending_review");
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            <PageHeader
                title={t("header_title")}
                subtitle={t("header_subtitle")}
                backHref="/"
                variant="light"
            />

            <main className="container mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-(--color-text-primary)">
                            {t("page_title")}
                        </h1>
                        <p className="mt-0.5 text-sm text-(--color-text-secondary)">
                            {t("page_description")}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchMine}
                        disabled={state.kind === "loading"}
                        aria-label={t("refresh_button_aria_label")}
                        className="rounded-full border border-(--color-border-muted) bg-(--color-surface-page) p-2.5 text-(--color-text-secondary) shadow-sm transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary) disabled:opacity-50"
                    >
                        <RefreshCw
                            size={16}
                            className={state.kind === "loading" ? "animate-spin" : ""}
                        />
                    </button>
                </div>

                {state.kind === "loading" && (
                    <div className="flex flex-col gap-3" aria-label={t("loading_aria_label")}>
                        {[1, 2, 3].map((i) => (
                            <Card
                                key={i}
                                className="flex flex-col border-(--color-border-muted) bg-(--color-surface-page) sm:flex-row"
                            >
                                <Skeleton className="h-40 shrink-0 rounded-none bg-slate-200 sm:h-32 sm:w-32 dark:bg-slate-800" />
                                <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <Skeleton className="h-5 w-1/2 bg-slate-200 dark:bg-slate-800" />
                                        <Skeleton className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                        <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800" />
                                        <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {state.kind === "authError" && (
                    <EmptyState
                        icon={<LogIn size={26} className="text-amber-600" />}
                        title={t("auth_error_title")}
                        description={state.message}
                        actionLabel={t("auth_error_action")}
                        actionHref="/login"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "networkError" && (
                    <EmptyState
                        icon={<AlertTriangle size={26} className="text-rose-600" />}
                        title={t("network_error_title")}
                        description={state.message}
                        actionLabel={t("network_error_action")}
                        onAction={fetchMine}
                        className="border-rose-200 bg-(--color-surface-page)! dark:border-rose-950/40"
                    />
                )}

                {state.kind === "ready" && state.reports.length === 0 && (
                    <EmptyState
                        icon={<CheckCircle2 size={26} className="text-emerald-600" />}
                        title={t("empty_state_title")}
                        description={t("empty_state_description")}
                        actionLabel={t("empty_state_action")}
                        actionHref="/report"
                        className="border-(--color-border-muted) bg-(--color-surface-page)!"
                    />
                )}

                {state.kind === "ready" && state.reports.length > 0 && (
                    <section className="flex flex-col gap-3" aria-label="Your reports">
                        {state.reports.map((report) => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                statusLabel={getStatusLabel(report.status)}
                                districtLabel={t("report_card_district_label")}
                                submittedLabel={t("report_card_submitted_label")}
                                batchLabel={t("report_card_batch_label")}
                                noPhotoLabel={t("no_photo_label")}
                            />
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
