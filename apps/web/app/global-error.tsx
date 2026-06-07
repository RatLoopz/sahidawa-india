"use client";

import { useEffect, useId } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { LiveMessage } from "@/components/ui/LiveMessage";

interface GlobalErrorProps {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const isDev = process.env.NODE_ENV === "development";
    const errorDescriptionId = useId();

    return (
        <html lang="en">
            <body>
                <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-slate-950 via-emerald-950 to-slate-900 p-6 text-white">
                    <LiveMessage
                        tone="critical"
                        describedBy={errorDescriptionId}
                        className="flex w-full max-w-md flex-col items-center text-center"
                    >
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                            <AlertTriangle size={36} className="text-emerald-400" />
                        </div>

                        <span className="mb-3 text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                            Critical Error
                        </span>

                        <h1 className="mb-3 text-3xl font-extrabold">Something went wrong</h1>

                        <p
                            id={errorDescriptionId}
                            className="mb-8 text-sm leading-relaxed text-slate-300"
                        >
                            SahiDawa ran into an unexpected problem. You can try reloading, or
                            return to the home screen.
                        </p>

                        {isDev && (error.message || error.digest) && (
                            <div className="mb-8 w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                                {error.message && (
                                    <p className="font-mono text-xs wrap-break-word text-slate-200">
                                        {error.message}
                                    </p>
                                )}
                                {error.digest && (
                                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                                        digest: {error.digest}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex w-full flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => unstable_retry()}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-bold text-white shadow-xl shadow-emerald-600/30 transition-colors hover:bg-emerald-700"
                            >
                                <RotateCw size={18} />
                                Try Again
                            </button>
                            <a
                                href="/"
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20"
                            >
                                <Home size={18} />
                                Go Home
                            </a>
                        </div>
                    </LiveMessage>
                </main>
            </body>
        </html>
    );
}
