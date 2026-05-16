export function MedicineResultSkeleton() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white text-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500 animate-pulse"></div>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse"></div>
          <div className="space-y-2 w-full">
            <div className="h-7 bg-gray-200 rounded-lg animate-pulse w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-1/2 mx-auto"></div>
          </div>
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4 mx-auto"></div>
              <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2 mx-auto"></div>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4 mx-auto"></div>
              <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2 mx-auto"></div>
            </div>
          </div>
          <div className="w-full bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
          </div>
          <div className="w-full py-4 bg-gray-200 rounded-2xl animate-pulse h-12"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
      </div>
    </div>
  );
}