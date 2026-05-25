"use client";

import { useEffect, useId } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Link } from "@/i18n/routing";
import { LiveMessage } from "@/components/ui/LiveMessage";

interface ErrorProps {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}

export default function Error({ error, unstable_retry }: ErrorProps) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const isDev = process.env.NODE_ENV === "development";
    const errorDescriptionId = useId();

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <LiveMessage
                tone="critical"
                describedBy={errorDescriptionId}
                className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
            >
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <AlertTriangle size={32} className="text-emerald-600" />
                </div>

                <span className="mb-2 text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
                    Unexpected Error
                </span>

                <h1 className="mb-3 text-2xl font-extrabold text-slate-900">
                    Something went wrong
                </h1>

                <p id={errorDescriptionId} className="mb-6 text-sm leading-relaxed text-slate-600">
                    We hit a snag loading this page. Your data is safe — please try again, or head
                    back to the home screen.
                </p>

                {isDev && (error.message || error.digest) && (
                    <div className="mb-6 w-full rounded-2xl border border-slate-200 bg-slate-100 p-3 text-left">
                        {error.message && (
                            <p className="font-mono text-xs wrap-break-word text-slate-700">
                                {error.message}
                            </p>
                        )}
                        {error.digest && (
                            <p className="mt-1 font-mono text-[10px] text-slate-500">
                                digest: {error.digest}
                            </p>
                        )}
                    </div>
                )}

                <div className="flex w-full flex-col gap-3 sm:flex-row">
                    <button
                        onClick={() => unstable_retry()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-bold text-white shadow-xl shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
                    >
                        <RotateCw size={18} />
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Home size={18} />
                        Go Home
                    </Link>
                </div>
            </LiveMessage>
        </main>
    );
}
