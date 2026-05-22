"use client";

import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    ImageOff,
    Loader2,
    LogIn,
    MapPin,
    RefreshCw,
    ShieldCheck,
    XCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../../components/PageHeader";
import Card from "@/components/Card";
import LazyImage from "@/components/LazyImage";

// `NEXT_PUBLIC_API_URL` must be the bare API origin with no path suffix
// (e.g. `https://api.example.com`). The reports router is mounted at
// `/reports` in apps/api/src/index.ts (no `/api/v1` prefix), so this page
// appends `/reports/mine` itself. Sibling pages may append different paths.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

function getToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("sb-access-token") ?? "";
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

const STATUS_META: Record<
    ReportStatus,
    { label: string; icon: typeof Clock; chip: string; dot: string }
> = {
    pending: {
        label: "Pending Review",
        icon: Clock,
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
    },
    verified_fake: {
        label: "Verified Fake",
        icon: ShieldCheck,
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
    },
    false_alarm: {
        label: "False Alarm",
        icon: XCircle,
        chip: "bg-slate-100 text-slate-600 border-slate-200",
        dot: "bg-slate-400",
    },
};

// Accepts `string` rather than `ReportStatus` so an unexpected status from
// the API (a future migration adds a new value, a corrupted row) renders a
// neutral badge instead of crashing the page with `Cannot read property of undefined`.
function StatusBadge({ status }: { status: string }) {
    const meta = STATUS_META[status as ReportStatus] ?? STATUS_META.pending;
    const Icon = meta.icon;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
        >
            <Icon size={12} />
            {meta.label}
        </span>
    );
}

function ReportCard({ report }: { report: MyReport }) {
    const title =
        report.reported_brand_name?.trim() || report.scanned_barcode || "Unnamed medicine";

    return (
        <Card className="flex flex-col sm:flex-row">
            <div className="flex h-40 shrink-0 items-center justify-center bg-slate-100 sm:h-32 sm:w-32">
                {isSafePhotoUrl(report.photo_url) ? (
                    <LazyImage
                        src={report.photo_url}
                        alt={`Photo of reported medicine: ${title}`}
                        wrapperClassName="w-full h-full"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center text-slate-400">
                        <ImageOff size={24} />
                        <span className="mt-1 text-[10px] font-medium tracking-wider uppercase">
                            No photo
                        </span>
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate font-bold text-slate-900">{title}</h3>
                    <StatusBadge status={report.status} />
                </div>

                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {report.district && (
                        <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            <dt className="sr-only">District</dt>
                            <dd>{report.district}</dd>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <Clock size={12} className="text-slate-400" />
                        <dt className="sr-only">Submitted</dt>
                        <dd>{formatDate(report.created_at)}</dd>
                    </div>
                    {report.scanned_barcode && (
                        <div className="flex items-center gap-1">
                            <FileText size={12} className="text-slate-400" />
                            <dt className="sr-only">Batch</dt>
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
    const [state, setState] = useState<LoadState>({ kind: "loading" });

    const fetchMine = useCallback(async () => {
        setState({ kind: "loading" });

        const token = getToken();
        if (!token) {
            setState({
                kind: "authError",
                message: "Please sign in to view the reports you have filed.",
            });
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/reports/mine`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401) {
                setState({
                    kind: "authError",
                    message: "Your session has expired. Please sign in again.",
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
                message: "Cannot reach the API. Is the backend server running on port 4000?",
            });
        }
    }, []);

    useEffect(() => {
        fetchMine();
    }, [fetchMine]);

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
            <PageHeader
                title="My Reports"
                subtitle="Status of reports you have filed"
                backHref="/"
                variant="light"
            />

            <main className="container mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                            My Reports
                        </h1>
                        <p className="mt-0.5 text-sm text-slate-500">
                            Track what happened to the counterfeit medicines you reported.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchMine}
                        disabled={state.kind === "loading"}
                        aria-label="Refresh reports"
                        className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                        <RefreshCw
                            size={16}
                            className={state.kind === "loading" ? "animate-spin" : ""}
                        />
                    </button>
                </div>

                {state.kind === "loading" && (
                    <div
                        className="flex items-center justify-center py-20 text-slate-400"
                        role="status"
                        aria-live="polite"
                    >
                        <Loader2 size={20} className="mr-2 animate-spin" />
                        <span className="text-sm font-medium">Loading your reports…</span>
                    </div>
                )}

                {state.kind === "authError" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                            <LogIn size={26} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">Sign in required</h2>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            {state.message}
                        </p>
                        <Link
                            href="/login"
                            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            Go to Login
                        </Link>
                    </div>
                )}

                {state.kind === "networkError" && (
                    <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                            <AlertTriangle size={22} />
                        </div>
                        <p className="text-sm font-medium text-slate-700">{state.message}</p>
                        <button
                            type="button"
                            onClick={fetchMine}
                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            <RefreshCw size={14} /> Try again
                        </button>
                    </div>
                )}

                {state.kind === "ready" && state.reports.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 size={26} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">
                            You haven&apos;t filed any reports yet
                        </h2>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            Spotted a suspicious or counterfeit medicine? Reporting it helps protect
                            your community.
                        </p>
                        <Link
                            href="/report"
                            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                            File your first report
                        </Link>
                    </div>
                )}

                {state.kind === "ready" && state.reports.length > 0 && (
                    <section className="flex flex-col gap-3" aria-label="Your reports">
                        {state.reports.map((report) => (
                            <ReportCard key={report.id} report={report} />
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
