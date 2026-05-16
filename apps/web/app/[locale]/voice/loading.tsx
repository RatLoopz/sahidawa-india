export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="relative flex items-center justify-center">
        {/* Pulsing waves */}
        <div className="absolute h-36 w-36 animate-ping rounded-full bg-emerald-500/10" />
        <div className="absolute h-24 w-24 animate-pulse rounded-full bg-emerald-500/20" />

        {/* Main mic circle */}
        <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)]">
          <div className="h-8 w-8 rounded-full bg-white/90" />
        </div>
      </div>
    </div>
  );
}