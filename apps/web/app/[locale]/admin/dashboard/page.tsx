"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    Database,
    History,
    Search,
    CheckCircle,
    XCircle,
    RefreshCw,
    Loader2,
    ShieldAlert,
    Plus,
    Clock,
    Pill,
    FileText,
} from "lucide-react";
import { LiveMessage } from "@/components/ui/LiveMessage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1/admin";

type ReportStatus = "pending" | "verified_fake" | "false_alarm";
type MedicineStatus = "approved" | "recalled" | "banned";
type Tab = "reports" | "medicine" | "logs";

interface Report {
    id: string;
    reported_brand_name: string | null;
    district: string | null;
    status: ReportStatus;
    created_at: string;
    scanned_barcode: string | null;
    medicines?: { brand_name: string; generic_name: string } | null;
}

interface Medicine {
    id: string;
    brand_name: string;
    generic_name: string;
    manufacturer: string;
    barcode_id: string;
    cdsco_approval_status: MedicineStatus;
}

interface AuditEntry {
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    details: string;
    created_at: string;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

function getToken(): string {
    if (globalThis.window === undefined) return "";
    return localStorage.getItem("sb-access-token") ?? "";
}

export default function AdminDashboard() {
    const [tab, setTab] = useState<Tab>("reports");
    const [reports, setReports] = useState<Report[]>([]);
    const [resolved, setResolved] = useState<(Report & { resolvedStatus: ReportStatus })[]>([]);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [auditLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [newMed, setNewMed] = useState<Omit<Medicine, "id">>({
        brand_name: "",
        generic_name: "",
        manufacturer: "",
        barcode_id: "",
        cdsco_approval_status: "approved",
    });
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const notify = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const authHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
    });

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setAuthError(null);
        try {
            const res = await fetch(`${API_BASE}/reports`, { headers: authHeaders() });
            if (res.status === 401) {
                setAuthError("Not authenticated — please sign in as an admin.");
                return;
            }
            if (res.status === 403) {
                setAuthError("Access denied — admin or moderator role required.");
                return;
            }
            const json = await res.json();
            setReports(json.reports ?? []);
        } catch {
            setAuthError("Cannot reach the API. Is the backend server running on port 4000?");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMedicines = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/medicines`, { headers: authHeaders() });
            if (res.ok) setMedicines(await res.json());
        } catch {
            /* silently fail, table will be empty */
        }
    }, []);

    useEffect(() => {
        fetchReports();
        fetchMedicines();
    }, [fetchReports, fetchMedicines]);

    const handleReportAction = async (reportId: string, status: ReportStatus) => {
        setActing(reportId + status);
        try {
            const res = await fetch(`${API_BASE}/reports/${reportId}/status`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error("API Request Failed");
            const target = reports.find((r) => r.id === reportId);
            if (target) setResolved((prev) => [...prev, { ...target, resolvedStatus: status }]);
            setReports((prev) => prev.filter((r) => r.id !== reportId));
            notify(
                status === "verified_fake"
                    ? "⚠️ Marked as Verified Fake"
                    : "✅ Marked as False Alarm",
                status !== "verified_fake"
            );
        } catch {
            notify("❌ Failed to update report", false);
        } finally {
            setActing(null);
        }
    };

    const handleAddMedicine = async () => {
        if (!newMed.brand_name || !newMed.generic_name) return;
        try {
            const res = await fetch(`${API_BASE}/medicines`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(newMed),
            });
            if (!res.ok) throw new Error("API Request Failed");
            const created = await res.json();
            setMedicines((prev) => [...prev, created]);
            setNewMed({
                brand_name: "",
                generic_name: "",
                manufacturer: "",
                barcode_id: "",
                cdsco_approval_status: "approved",
            });
            setShowForm(false);
            notify("✅ Medicine added");
        } catch {
            notify("❌ Failed to add medicine", false);
        }
    };

    const pendingCount = reports.length;
    const resolvedCount = resolved.length;
    const districtCount = new Set(reports.map((r) => r.district).filter(Boolean)).size;

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            {/* Sidebar */}
            <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 px-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                        S
                    </div>
                    <span className="font-bold text-slate-800">
                        SahiDawa <span className="text-blue-600">Admin</span>
                    </span>
                </div>
                <nav className="flex flex-1 flex-col gap-0.5">
                    <NavItem
                        icon={AlertTriangle}
                        label="Reports"
                        active={tab === "reports"}
                        onClick={() => setTab("reports")}
                    />
                    <NavItem
                        icon={Database}
                        label="Medicine Master"
                        active={tab === "medicine"}
                        onClick={() => setTab("medicine")}
                    />
                    <NavItem
                        icon={History}
                        label="Audit Logs"
                        active={tab === "logs"}
                        onClick={() => setTab("logs")}
                    />
                </nav>
                <p className="px-1 text-xs text-slate-400">SahiDawa Admin v1.0</p>
            </aside>

            {/* Main */}
            <main className="flex min-h-0 flex-1 flex-col">
                {/* Header */}
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Moderation Dashboard</h1>
                        <p className="text-xs text-slate-400">
                            Manage community-reported counterfeit medicines
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/en/login"
                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            Sign In
                        </Link>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-56 rounded-full border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={fetchReports}
                            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard
                            label="Pending"
                            value={pendingCount}
                            icon={AlertTriangle}
                            color="text-amber-500"
                            bg="bg-amber-50"
                        />
                        <StatCard
                            label="Resolved"
                            value={resolvedCount}
                            icon={CheckCircle}
                            color="text-green-500"
                            bg="bg-green-50"
                        />
                        <StatCard
                            label="Districts Affected"
                            value={districtCount}
                            icon={ShieldAlert}
                            color="text-purple-500"
                            bg="bg-purple-50"
                        />
                    </div>

                    {/* Reports Tab */}
                    {tab === "reports" && (
                        <>
                            <ReportsTable
                                reports={reports}
                                loading={loading}
                                authError={authError}
                                acting={acting}
                                onAction={handleReportAction}
                            />
                            {resolved.length > 0 && <ResolvedTable resolved={resolved} />}
                        </>
                    )}

                    {/* Medicine Master Tab */}
                    {tab === "medicine" && (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                <h2 className="font-semibold text-slate-800">Medicine Master</h2>
                                <button
                                    onClick={() => setShowForm((v) => !v)}
                                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Medicine
                                </button>
                            </div>

                            {showForm && (
                                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                                    <div className="mb-3 grid grid-cols-2 gap-3">
                                        {(
                                            [
                                                "brand_name",
                                                "generic_name",
                                                "manufacturer",
                                                "barcode_id",
                                            ] as const
                                        ).map((field) => (
                                            <input
                                                key={field}
                                                placeholder={field
                                                    .replaceAll("_", " ")
                                                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                                                value={newMed[field]}
                                                onChange={(e) =>
                                                    setNewMed((p) => ({
                                                        ...p,
                                                        [field]: e.target.value,
                                                    }))
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                                            />
                                        ))}
                                        <select
                                            value={newMed.cdsco_approval_status}
                                            onChange={(e) =>
                                                setNewMed((p) => ({
                                                    ...p,
                                                    cdsco_approval_status: e.target
                                                        .value as MedicineStatus,
                                                }))
                                            }
                                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                                        >
                                            <option value="approved">Approved</option>
                                            <option value="recalled">Recalled</option>
                                            <option value="banned">Banned</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddMedicine}
                                            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setShowForm(false)}
                                            className="rounded-lg bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                                        <th className="px-6 py-3">Brand</th>
                                        <th className="px-6 py-3">Generic</th>
                                        <th className="px-6 py-3">Manufacturer</th>
                                        <th className="px-6 py-3">Barcode</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {medicines.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-6 py-10 text-center text-sm text-slate-400"
                                            >
                                                No medicines found.
                                            </td>
                                        </tr>
                                    )}
                                    {medicines.map((m) => (
                                        <tr
                                            key={m.id}
                                            className="transition-colors hover:bg-slate-50/60"
                                        >
                                            <td className="flex items-center gap-2 px-6 py-3 font-medium text-slate-800">
                                                <Pill className="h-3.5 w-3.5 text-blue-400" />
                                                {m.brand_name}
                                            </td>
                                            <td className="px-6 py-3 text-sm text-slate-600">
                                                {m.generic_name}
                                            </td>
                                            <td className="px-6 py-3 text-sm text-slate-500">
                                                {m.manufacturer}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
                                                    {m.barcode_id || "—"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <StatusBadge status={m.cdsco_approval_status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Audit Logs Tab */}
                    {tab === "logs" && (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-6 py-4">
                                <h2 className="font-semibold text-slate-800">Audit Log</h2>
                                <p className="mt-0.5 text-xs text-slate-400">
                                    Every administrative action is recorded here
                                </p>
                            </div>
                            {auditLogs.length === 0 ? (
                                <div className="py-16 text-center text-sm text-slate-400">
                                    No audit entries yet.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {auditLogs.map((log) => {
                                        const isVerify = log.action.includes("VERIFIED_FAKE");
                                        const isAlarm = log.action.includes("FALSE_ALARM");
                                        const isCreate = log.action.includes("CREATE");
                                        const getIconBg = () => {
                                            if (isVerify) return "bg-red-50 text-red-500";
                                            if (isAlarm) return "bg-green-50 text-green-500";
                                            if (isCreate) return "bg-blue-50 text-blue-500";
                                            return "bg-slate-100 text-slate-400";
                                        };
                                        const getIcon = () => {
                                            if (isCreate) return <Database className="h-4 w-4" />;
                                            if (isVerify) return <XCircle className="h-4 w-4" />;
                                            if (isAlarm) return <CheckCircle className="h-4 w-4" />;
                                            return <FileText className="h-4 w-4" />;
                                        };
                                        return (
                                            <div
                                                key={log.id}
                                                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60"
                                            >
                                                <div
                                                    className={`mt-0.5 shrink-0 rounded-xl p-2 ${getIconBg()}`}
                                                >
                                                    {getIcon()}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {log.details}
                                                    </p>
                                                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                                                        {log.target_type} · {log.target_id}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                                                    <Clock className="h-3 w-3" />
                                                    {timeAgo(log.created_at)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {toast && (
                <LiveMessage
                    tone={toast.ok ? "polite" : "critical"}
                    className={`fixed right-6 bottom-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-xl ${toast.ok ? "bg-green-600" : "bg-red-600"}`}
                >
                    {toast.msg}
                </LiveMessage>
            )}
        </div>
    );
}

function NavItem({
    icon: Icon,
    label,
    active,
    onClick,
}: Readonly<{ icon: any; label: string; active: boolean; onClick: () => void }>) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${active ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
        >
            <Icon className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
            {label}
        </button>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
}: Readonly<{ label: string; value: number; icon: any; color: string; bg: string }>) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex rounded-xl p-2.5 ${bg} ${color} mb-3`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="mb-1 text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );
}

function StatusBadge({ status }: Readonly<{ status: MedicineStatus }>) {
    const styles: Record<MedicineStatus, string> = {
        approved: "bg-green-50 text-green-600",
        recalled: "bg-amber-50 text-amber-600",
        banned: "bg-red-50 text-red-600",
    };
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

function ReportsTable({
    reports,
    loading,
    authError,
    acting,
    onAction,
}: Readonly<{
    reports: Report[];
    loading: boolean;
    authError: string | null;
    acting: string | null;
    onAction: (id: string, s: ReportStatus) => void;
}>) {
    const authErrorMessageId = useId();

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="font-semibold text-slate-800">Pending Reports</h2>
                <span className="text-xs text-slate-400">{reports.length} pending</span>
            </div>

            {authError && (
                <LiveMessage
                    tone="critical"
                    describedBy={authErrorMessageId}
                    className="mx-6 my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600"
                >
                    <div id={authErrorMessageId} className="mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        {authError}
                    </div>

                    <Link
                        href="/en/login"
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                        Go to Login
                    </Link>
                </LiveMessage>
            )}

            {loading && !authError && (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading reports…
                </div>
            )}

            {!loading && !authError && reports.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                    <CheckCircle className="mx-auto mb-2 h-10 w-10 text-green-400" />
                    <p className="text-sm">No pending reports</p>
                </div>
            )}

            {!loading && !authError && reports.length > 0 && (
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                            <th className="px-6 py-3">Medicine</th>
                            <th className="px-6 py-3">District</th>
                            <th className="px-6 py-3">Barcode</th>
                            <th className="px-6 py-3">Reported</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {reports.map((r) => (
                            <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    {r.reported_brand_name ?? r.medicines?.brand_name ?? "—"}
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-600">
                                    {r.district ?? "—"}
                                </td>
                                <td className="px-6 py-3">
                                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
                                        {r.scanned_barcode ?? "N/A"}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-400">
                                    {timeAgo(r.created_at)}
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex gap-2">
                                        <ActionBtn
                                            label="Mark Fake"
                                            icon={XCircle}
                                            color="red"
                                            loading={acting === r.id + "verified_fake"}
                                            disabled={!!acting?.startsWith(r.id)}
                                            onClick={() => onAction(r.id, "verified_fake")}
                                        />
                                        <ActionBtn
                                            label="False Alarm"
                                            icon={CheckCircle}
                                            color="green"
                                            loading={acting === r.id + "false_alarm"}
                                            disabled={!!acting?.startsWith(r.id)}
                                            onClick={() => onAction(r.id, "false_alarm")}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function ResolvedTable({
    resolved,
}: Readonly<{ resolved: (Report & { resolvedStatus: ReportStatus })[] }>) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="font-semibold text-slate-800">Resolved</h2>
                <span className="text-xs text-slate-400">{resolved.length} resolved</span>
            </div>
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        <th className="px-6 py-3">Medicine</th>
                        <th className="px-6 py-3">District</th>
                        <th className="px-6 py-3">Decision</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {resolved.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50/60">
                            <td className="px-6 py-3 font-medium text-slate-700">
                                {r.reported_brand_name ?? "—"}
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-600">
                                {r.district ?? "—"}
                            </td>
                            <td className="px-6 py-3">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.resolvedStatus === "verified_fake" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
                                >
                                    {r.resolvedStatus === "verified_fake" ? (
                                        <>
                                            <XCircle className="h-3.5 w-3.5" /> Verified Fake
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-3.5 w-3.5" /> False Alarm
                                        </>
                                    )}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ActionBtn({
    label,
    icon: Icon,
    color,
    loading,
    disabled,
    onClick,
}: Readonly<{
    label: string;
    icon: any;
    color: "red" | "green";
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}>) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${color === "red" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
        >
            {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Icon className="h-3.5 w-3.5" />
            )}
            {label}
        </button>
    );
}
