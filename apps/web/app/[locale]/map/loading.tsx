"use client";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header Skeleton */}
        <div className="mb-6 space-y-3">
          <div className="h-8 w-52 animate-pulse rounded-lg bg-zinc-300" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-200" />
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-300">
          <div className="h-[70vh] w-full animate-pulse bg-zinc-300" />
          {/* Shimmer effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-linear-to-r from-transparent via-white/40 to-transparent" />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}