export default function VoiceLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Decorative blobs — matches real page */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl -ml-20 -mb-20" />

      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-6 pt-14 pb-4 relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="space-y-1.5">
          <div className="w-28 h-3.5 rounded-full bg-slate-200 animate-pulse" />
          <div className="w-20 h-2.5 rounded-full bg-slate-200 animate-pulse" />
        </div>
      </div>

      {/* Center content skeleton */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 gap-8">
        {/* Title skeleton */}
        <div className="space-y-3 flex flex-col items-center">
          <div className="w-52 h-8 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="w-64 h-3 rounded-full bg-slate-200 animate-pulse" />
          <div className="w-44 h-3 rounded-full bg-slate-200 animate-pulse" />
        </div>

        {/* Feature cards skeleton */}
        <div className="grid grid-cols-2 gap-4 max-w-sm w-full">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="w-5 h-5 rounded-md bg-slate-200 animate-pulse" />
            <div className="w-16 h-2.5 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-24 h-3.5 rounded-full bg-slate-200 animate-pulse" />
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-2">
            <div className="w-5 h-5 rounded-md bg-slate-200 animate-pulse" />
            <div className="w-16 h-2.5 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-20 h-3.5 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Mic button skeleton — pulsing circle, microphone-loading feel */}
      <div className="relative z-10 p-12 flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          {/* Outer pulse rings */}
          <div className="absolute w-24 h-24 rounded-full bg-emerald-400/20 animate-pulse" style={{ animationDuration: "1.6s" }} />
          <div className="absolute w-32 h-32 rounded-full bg-emerald-400/10 animate-pulse" style={{ animationDuration: "2.2s" }} />
          {/* Mic button shimmer */}
          <div className="w-24 h-24 rounded-full bg-emerald-200 animate-pulse" />
        </div>
        <div className="w-24 h-3 rounded-full bg-slate-200 animate-pulse" />
      </div>

      {/* Footer text skeleton */}
      <div className="p-8 flex justify-center">
        <div className="w-56 h-2.5 rounded-full bg-slate-200 animate-pulse" />
      </div>
    </div>
  );
}