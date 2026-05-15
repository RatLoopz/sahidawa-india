"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Link } from "@/i18n/routing";

interface ErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function Error({ error, unstable_retry }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-sm p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <AlertTriangle size={32} className="text-emerald-600" />
        </div>

        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">
          Unexpected Error
        </span>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-3">
          Something went wrong
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          We hit a snag loading this page. Your data is safe — please try again, or head back to the home screen.
        </p>

        {isDev && (error.message || error.digest) && (
          <div className="w-full rounded-2xl bg-slate-100 border border-slate-200 p-3 mb-6 text-left">
            {error.message && (
              <p className="text-xs font-mono text-slate-700 break-words">
                {error.message}
              </p>
            )}
            {error.digest && (
              <p className="text-[10px] font-mono text-slate-500 mt-1">
                digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="w-full flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => unstable_retry()}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-full px-6 py-3 font-bold shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
          >
            <RotateCw size={18} />
            Try Again
          </button>
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-full px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home size={18} />
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
