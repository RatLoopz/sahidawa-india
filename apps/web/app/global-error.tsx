"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import "./[locale]/globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-900 text-white p-6">
          <div className="w-full max-w-md flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-6">
              <AlertTriangle size={36} className="text-emerald-400" />
            </div>

            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-3">
              Critical Error
            </span>

            <h1 className="text-3xl font-extrabold mb-3">
              Something went wrong
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed mb-8">
              SahiDawa ran into an unexpected problem. You can try reloading, or return to the home screen.
            </p>

            {isDev && (error.message || error.digest) && (
              <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-3 mb-8 text-left">
                {error.message && (
                  <p className="text-xs font-mono text-slate-200 break-words">
                    {error.message}
                  </p>
                )}
                {error.digest && (
                  <p className="text-[10px] font-mono text-slate-400 mt-1">
                    digest: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => unstable_retry()}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-full px-6 py-3 font-bold shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-colors"
              >
                <RotateCw size={18} />
                Try Again
              </button>
              <a
                href="/"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 font-bold text-white hover:bg-white/20 transition-colors"
              >
                <Home size={18} />
                Go Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
