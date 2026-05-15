export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="relative flex items-center justify-center">
        {/* I have kept the height ratios as factors of 4. To  make them look even and good */}
        <div className="absolute h-40 w-40 animate-ping rounded-full border border-emerald-400/40" />
        {/* Middle ring */}
        <div className="absolute h-28 w-28 animate-pulse rounded-full border-2 border-emerald-400/60" />
        {/* Inner core */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.6)]">
          <div className="h-6 w-6 rounded-full bg-white/90" />
        </div>
      </div>
    </div>
  );
}