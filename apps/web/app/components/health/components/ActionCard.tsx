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
            className={`w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 active:scale-[0.98] ${accent.hover} focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none`}
            aria-label={label}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}
                >
                    <span className={`${accent.iconColor} h-5 w-5`} aria-hidden="true">
                        {icon}
                    </span>
                </div>
                {/* Text */}
                <div className="min-w-0">
                    <p className={`text-sm font-semibold ${accent.label} leading-snug`}>{label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
                </div>
                {/* Chevron */}
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-1 ml-auto flex-shrink-0"
                    aria-hidden="true"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </div>
        </button>
    );
}
