export default function MapLoading() {
  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">

      <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm z-30 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse shrink-0" />
        <div className="flex-1 h-10 rounded-2xl bg-slate-100 animate-pulse" />
      </div>

      <div className="bg-white px-4 pt-3 pb-5 shadow-sm z-20 border-b border-slate-100">
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-full bg-slate-200 animate-pulse" />
          <div
            className="h-8 w-32 rounded-full bg-emerald-100 animate-pulse"
            style={{ animationDelay: "80ms" }}
          />
          <div
            className="h-8 w-24 rounded-full bg-slate-100 animate-pulse"
            style={{ animationDelay: "160ms" }}
          />
          <div
            className="h-8 w-20 rounded-full bg-slate-100 animate-pulse"
            style={{ animationDelay: "240ms" }}
          />
        </div>
      </div>

      <div className="flex-1 relative bg-slate-200 overflow-hidden">

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.16) 50%, transparent 65%)",
            backgroundSize: "250% 100%",
            animation: "map-shimmer 2.4s ease-in-out infinite",
          }}
        />

        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-200 animate-pulse border-4 border-white shadow-lg" />
          <div className="h-5 w-28 rounded-full bg-white/90 animate-pulse shadow" />
        </div>

        <div className="absolute top-1/2 right-1/4">
          <div className="w-10 h-10 rounded-full bg-blue-200 animate-pulse border-4 border-white shadow-md" />
        </div>

        <div className="absolute bottom-1/4 left-1/4">
          <div
            className="w-10 h-10 rounded-full bg-blue-200 animate-pulse border-4 border-white shadow-md"
            style={{ animationDelay: "300ms" }}
          />
        </div>

        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <div className="w-10 h-10 rounded-xl bg-white shadow-md animate-pulse" />
          <div
            className="w-10 h-10 rounded-xl bg-white shadow-md animate-pulse"
            style={{ animationDelay: "120ms" }}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100 flex items-center justify-between"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl animate-pulse shrink-0"
                  style={{
                    background: i === 0 ? "#d1fae5" : "#dbeafe",
                    animationDelay: `${i * 100}ms`,
                  }}
                />

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 rounded-full bg-slate-200 animate-pulse"
                      style={{
                        width: [160, 110, 140][i],
                        animationDelay: `${i * 80}ms`,
                      }}
                    />

                    <div
                      className="h-4 w-14 rounded-md bg-emerald-100 animate-pulse"
                      style={{ animationDelay: `${i * 80 + 40}ms` }}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className="h-2.5 w-16 rounded-full bg-slate-100 animate-pulse"
                      style={{ animationDelay: `${i * 80 + 80}ms` }}
                    />

                    <div
                      className="h-2.5 w-8 rounded-full bg-amber-100 animate-pulse"
                      style={{ animationDelay: `${i * 80 + 120}ms` }}
                    />
                  </div>
                </div>
              </div>

              <div
                className="w-10 h-10 rounded-full bg-slate-200 animate-pulse shrink-0"
                style={{ animationDelay: `${i * 100 + 60}ms` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}