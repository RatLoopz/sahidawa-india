"use client";

// ─── ActionCard ────────────────────────────────────────────────────────────────
// Primary CTA cards surfacing the core SahiDawa product flows.
// Displayed in the empty/welcome state of the chat.

interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accentColor?: "emerald" | "sky" | "amber";
}

const accentMap = {
  emerald: {
    iconBg: "bg-emerald-50 border border-emerald-200",
    iconColor: "text-emerald-600",
    hover: "hover:border-emerald-400 hover:bg-emerald-50/60",
    label: "text-emerald-700",
  },
  sky: {
    iconBg: "bg-sky-50 border border-sky-200",
    iconColor: "text-sky-600",
    hover: "hover:border-sky-400 hover:bg-sky-50/60",
    label: "text-sky-700",
  },
  amber: {
    iconBg: "bg-amber-50 border border-amber-200",
    iconColor: "text-amber-600",
    hover: "hover:border-amber-400 hover:bg-amber-50/60",
    label: "text-amber-700",
  },
};

export function ActionCard({
  icon,
  label,
  description,
  onClick,
  accentColor = "emerald",
}: ActionCardProps) {
  const accent = accentMap[accentColor];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-200 rounded-2xl p-4 transition-all duration-200 active:scale-[0.98] shadow-sm ${accent.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
      aria-label={label}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent.iconBg}`}>
          <span className={`${accent.iconColor} w-5 h-5`} aria-hidden="true">{icon}</span>
        </div>
        {/* Text */}
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${accent.label} leading-snug`}>{label}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        {/* Chevron */}
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 mt-1 ml-auto"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}