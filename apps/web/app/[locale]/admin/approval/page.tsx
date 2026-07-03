"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { ADMIN_API_BASE } from "@/lib/adminApi";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    History,
    ImageOff,
    Loader2,
    Pill,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Store,
    X,
    XCircle,
    Activity,
    Database,
} from "lucide-react";
import { useSession } from "@/src/components/AuthProvider";
import { canMutateAdminData, getAdminRoleFromSession } from "@/lib/adminAuth";

type VerificationStatus = "pending" | "approved" | "rejected";

interface VerificationRequest {
    id: string;
    medicine_name: string;
    medicine_id: string | null;
    image_url: string | null;
    ocr_extracted_text: string | null;
    ocr_raw_response: Record<string, unknown> | null;
    status: VerificationStatus;
    submitted_by: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    medicines?: {
        brand_name: string;
        generic_name: string;
        manufacturer: string;
    } | null;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

export default function ApprovalQueuePage() {
    const { session, token, isLoading: authLoading } = useSession();
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [canMutate, setCanMutate] = useState(false);

    const notify = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const authHeaders = useCallback(
        () => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
        }),
        [token]
    );

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${ADMIN_API_BASE}/verifications`, {
                cache: "no-store",
                headers: authHeaders(),
            });
            if (res.status === 401) {
                setError("Sign in with an admin or moderator account to review verifications.");
                return;
            }
            if (res.status === 403) {
                setError("Your account does not have access to verification moderation.");
                return;
            }
            if (!res.ok) throw new Error("Failed to fetch verification requests");
            const data = await res.json();
            setRequests(data.requests ?? []);
        } catch {
            setError("Verification queue is unavailable. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => {
        if (authLoading) return;
        const role = getAdminRoleFromSession(session);
        setCanMutate(canMutateAdminData(role));
    }, [authLoading, session]);

    useEffect(() => {
        if (!authLoading) {
            fetchRequests();
        }
    }, [authLoading, fetchRequests]);

    const handleReview = async (
        requestId: string,
        status: "approved" | "rejected",
        reason?: string
    ) => {
        if (!canMutate) return;
        setActing(`${requestId}:${status}`);

        try {
            const res = await fetch(`${ADMIN_API_BASE}/verifications/${requestId}/review`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({ status, rejection_reason: reason }),
            });
            if (!res.ok) throw new Error("Failed to update request");

            setRequests((prev) => prev.filter((r) => r.id !== requestId));
            if (selectedRequest?.id === requestId) {
                setSelectedRequest(null);
            }
            setShowRejectForm(false);
            setRejectionReason("");
            notify(
                status === "approved"
                    ? "✓ Medicine verified and marked as approved."
                    : "✗ Request rejected and removed from queue.",
                status === "approved"
            );
        } catch {
            notify("Failed to update the request. Please try again.", false);
        } finally {
            setActing(null);
        }
    };

    const pendingCount = requests.length;

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
                    <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <AlertTriangle className="h-4 w-4 text-slate-400" />
                        Reports
                    </Link>
                    <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <Database className="h-4 w-4 text-slate-400" />
                        Medicine
                    </Link>
                    <Link
                        href="/admin/dashboard"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <History className="h-4 w-4 text-slate-400" />
                        Logs
                    </Link>
                    <Link
                        href="/admin/pharmacies/pending"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <Store className="h-4 w-4 text-slate-400" />
                        Pharmacies
                    </Link>
                    <Link
                        href="/admin/analytics"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                    >
                        <Activity className="h-4 w-4 text-slate-400" />
                        Analytics
                    </Link>
                    <div className="flex w-full items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-600">
                        <ShieldCheck className="h-4 w-4" />
                        Approvals
                    </div>
                </nav>
                <p className="px-1 text-xs text-slate-400">SahiDawa Admin v1.0</p>
            </aside>

            {/* Main content */}
            <main className="flex min-h-0 flex-1 flex-col">
                {/* Header */}
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">OCR Verification Queue</h1>
                        <p className="text-xs text-slate-400">
                            Review uploaded medicine images and approve or reject OCR verifications
                        </p>
                    </div>
                    <button
                        onClick={fetchRequests}
                        className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                        title="Refresh queue"
                        id="refresh-verifications-btn"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* Queue list panel */}
                    <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
                        {/* Stats bar */}
                        <div className="border-b border-slate-100 px-5 py-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                    Pending Queue
                                </span>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                    {pendingCount} pending
                                </span>
                            </div>
                        </div>

                        {/* Queue items */}
                        <div className="flex-1 overflow-y-auto">
                            {loading && (
                                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Loading queue…</span>
                                </div>
                            )}

                            {!loading && error && (
                                <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                                    <ShieldAlert className="mr-2 inline h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            {!loading && !error && requests.length === 0 && (
                                <div className="py-16 text-center text-slate-400">
                                    <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
                                    <p className="text-sm font-medium">Queue is clear!</p>
                                    <p className="mt-1 text-xs">
                                        No pending verification requests.
                                    </p>
                                </div>
                            )}

                            {!loading &&
                                !error &&
                                requests.map((req) => (
                                    <button
                                        key={req.id}
                                        id={`verification-item-${req.id}`}
                                        onClick={() => {
                                            setSelectedRequest(req);
                                            setShowRejectForm(false);
                                            setRejectionReason("");
                                        }}
                                        className={`w-full border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                                            selectedRequest?.id === req.id
                                                ? "border-l-4 border-l-blue-500 bg-blue-50/50"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 shrink-0 rounded-lg bg-amber-50 p-1.5">
                                                <Pill className="h-3.5 w-3.5 text-amber-500" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-slate-800">
                                                    {req.medicine_name}
                                                </p>
                                                {req.medicines && (
                                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                                        {req.medicines.generic_name}
                                                    </p>
                                                )}
                                                <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                                                    <Clock className="h-3 w-3" />
                                                    {timeAgo(req.created_at)}
                                                </div>
                                            </div>
                                            <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Detail / Review panel */}
                    <div className="flex flex-1 flex-col overflow-y-auto">
                        {!selectedRequest ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
                                <FileText className="h-14 w-14 text-slate-200" />
                                <p className="text-sm font-medium">Select a request to review</p>
                                <p className="text-xs">
                                    Click any item from the queue on the left.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col gap-6 p-8">
                                {/* Request header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">
                                            {selectedRequest.medicine_name}
                                        </h2>
                                        {selectedRequest.medicines && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {selectedRequest.medicines.generic_name} ·{" "}
                                                {selectedRequest.medicines.manufacturer}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            Request ID:{" "}
                                            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                                                {selectedRequest.id}
                                            </code>{" "}
                                            · Submitted {timeAgo(selectedRequest.created_at)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedRequest(null)}
                                        id="close-detail-btn"
                                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Image + OCR split pane */}
                                <div className="grid flex-1 grid-cols-2 gap-6">
                                    {/* Image panel */}
                                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <div className="border-b border-slate-100 px-5 py-3">
                                            <h3 className="text-sm font-semibold text-slate-700">
                                                Uploaded Image
                                            </h3>
                                        </div>
                                        <div className="flex min-h-64 items-center justify-center p-6">
                                            {selectedRequest.image_url ? (
                                                <img
                                                    src={selectedRequest.image_url}
                                                    alt={`Medicine image for ${selectedRequest.medicine_name}`}
                                                    className="max-h-96 max-w-full rounded-lg object-contain shadow-sm"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <ImageOff className="h-10 w-10" />
                                                    <p className="text-sm">No image available</p>
                                                    <p className="text-xs">
                                                        The submission did not include a stored
                                                        image URL.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* OCR data panel */}
                                    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        <div className="border-b border-slate-100 px-5 py-3">
                                            <h3 className="text-sm font-semibold text-slate-700">
                                                OCR Extracted Data
                                            </h3>
                                        </div>
                                        <div className="flex-1 overflow-auto p-5">
                                            {selectedRequest.ocr_extracted_text ? (
                                                <pre className="rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-700">
                                                    {selectedRequest.ocr_extracted_text}
                                                </pre>
                                            ) : (
                                                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                                    <FileText className="h-8 w-8" />
                                                    <p className="text-sm">No OCR text available</p>
                                                </div>
                                            )}

                                            {selectedRequest.ocr_raw_response && (
                                                <details className="mt-4">
                                                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                                                        Raw OCR response (JSON)
                                                    </summary>
                                                    <pre className="mt-2 rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-emerald-400">
                                                        {JSON.stringify(
                                                            selectedRequest.ocr_raw_response,
                                                            null,
                                                            2
                                                        )}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                {canMutate && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h3 className="mb-4 text-sm font-semibold text-slate-700">
                                            Review Decision
                                        </h3>

                                        {!showRejectForm ? (
                                            <div className="flex gap-3">
                                                <button
                                                    id={`approve-btn-${selectedRequest.id}`}
                                                    onClick={() =>
                                                        handleReview(selectedRequest.id, "approved")
                                                    }
                                                    disabled={Boolean(acting)}
                                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    {acting === `${selectedRequest.id}:approved` ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4" />
                                                    )}
                                                    Approve &amp; Verify Medicine
                                                </button>
                                                <button
                                                    id={`reject-btn-${selectedRequest.id}`}
                                                    onClick={() => setShowRejectForm(true)}
                                                    disabled={Boolean(acting)}
                                                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Reject Request
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <label className="block text-xs font-medium text-slate-600">
                                                    Rejection reason (optional)
                                                </label>
                                                <textarea
                                                    id="rejection-reason-input"
                                                    value={rejectionReason}
                                                    onChange={(e) =>
                                                        setRejectionReason(e.target.value)
                                                    }
                                                    placeholder="e.g. Image is blurry, OCR mismatch, packaging unclear…"
                                                    rows={3}
                                                    maxLength={500}
                                                    className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:ring-2 focus:ring-red-300 focus:outline-none"
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        id={`confirm-reject-btn-${selectedRequest.id}`}
                                                        onClick={() =>
                                                            handleReview(
                                                                selectedRequest.id,
                                                                "rejected",
                                                                rejectionReason || undefined
                                                            )
                                                        }
                                                        disabled={Boolean(acting)}
                                                        className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        {acting ===
                                                        `${selectedRequest.id}:rejected` ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <XCircle className="h-4 w-4" />
                                                        )}
                                                        Confirm Rejection
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowRejectForm(false);
                                                            setRejectionReason("");
                                                        }}
                                                        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!canMutate && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                                        <ShieldAlert className="mr-2 inline h-4 w-4" />
                                        You have read-only access. Only admins can approve or reject
                                        verifications.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Toast notification */}
            {toast && (
                <div
                    className={`fixed right-6 bottom-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-xl transition-all ${
                        toast.ok ? "bg-emerald-600" : "bg-red-600"
                    }`}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
