export default function ScanLoading() {
  return (
    <div className="min-h-screen bg-black text-white font-sans relative flex flex-col">

      {/* Header Skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 bg-transparent absolute top-0 left-0 right-0 z-20">
        <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse shrink-0" />

        <div className="space-y-2">
          <div className="w-36 h-4 rounded-full bg-white/15 animate-pulse" />

          <div className="w-24 h-3 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Viewfinder Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        
        {/* Background */}
        <div className="absolute inset-0 bg-slate-900">
          <div className="absolute inset-0 animate-pulse bg-emerald-500/5" />
        </div>

        {/* Scanner Frame */}
        <div className="relative w-72 h-72 md:w-96 md:h-96 z-10">
          <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl" />

          <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl" />

          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl" />

          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl" />

          {/* Spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-emerald-500 animate-spin" />
          </div>
        </div>
      </div>

      {/* Bottom Guidance */}
      <div className="p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center gap-6">
        <div className="w-64 h-3 rounded-full bg-white/10 animate-pulse" />

        <div className="flex gap-4">
          <div className="w-40 h-12 rounded-full bg-white/10 animate-pulse" />

          <div className="w-12 h-12 rounded-2xl bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  )
}