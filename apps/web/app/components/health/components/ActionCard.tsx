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
        iconBg: "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        hover: "hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/40 hover:shadow-lg",
        label: "text-emerald-700 dark:text-emerald-400",
    },
    sky: {
        iconBg: "bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800/50",
        iconColor: "text-sky-600 dark:text-sky-400",
        hover: "hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50/60 dark:hover:bg-sky-900/40 hover:shadow-lg",
        label: "text-sky-700 dark:text-sky-400",
    },
    amber: {
        iconBg: "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50",
        iconColor: "text-amber-600 dark:text-amber-400",
        hover: "hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/60 dark:hover:bg-amber-900/40 hover:shadow-lg",
        label: "text-amber-700 dark:text-amber-400",
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
            className={`w-full rounded-2xl border border-white/40 bg-white/40 p-4 text-left shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] dark:border-white/10 dark:bg-slate-900/40 ${accent.hover} focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none`}
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
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
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
