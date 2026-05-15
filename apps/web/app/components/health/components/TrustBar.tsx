"use client";

// ─── TrustBar ──────────────────────────────────────────────────────────────────
// Compact row of medical trust indicators shown below the input bar.

interface BadgeProps {
  icon: React.ReactNode;
  label: string;
}

function TrustBadge({ icon, label }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
      <span className="text-emerald-600 flex-shrink-0" aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

// SVG icons (inline, tiny)
const ShieldIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
  </svg>
);
const GlobeIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);
const WifiOffIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.99 9C19.15 5.16 13.8 3.76 8.84 4.78L11 6.95c3.25-.53 6.68.37 9.27 2.69L22.99 9zM18.77 13.22C17 11.45 14.61 10.5 12.1 10.5c-.89 0-1.75.12-2.57.34L11.69 13c.13-.01.27-.02.41-.02 1.77 0 3.38.68 4.59 1.78l2.08-1.54zM2 3.05L5.07 6.1C2.9 7.31 1.14 9.07 0 11.1l1.9 1.9c.88-1.64 2.16-2.96 3.69-3.9l1.43 1.43c-1.55.78-2.9 1.96-3.82 3.46L5 15.8c.8-1.42 2.06-2.51 3.56-3.09L10.62 14.8c-.93.25-1.77.71-2.47 1.35L10.43 18.5c.32-.42.73-.77 1.22-1.01L14.5 20.4c-.06.15-.14.3-.14.48C14.36 22.05 15.31 23 16.5 23c1.19 0 2.14-.95 2.14-2.12 0-.34-.1-.65-.24-.93l4.27 4.27 1.42-1.42L3.41 1.63 2 3.05z" />
  </svg>
);
const StarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export function TrustBar() {
  return (
    <div
      role="complementary"
      aria-label="Trust indicators"
      className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 py-2 px-4 border-t border-slate-100"
    >
      <TrustBadge icon={<StarIcon />} label="CDSCO Aligned" />
      <span className="w-px h-3 bg-slate-200" aria-hidden="true" />
      <TrustBadge icon={<GlobeIcon />} label="10+ Languages" />
      <span className="w-px h-3 bg-slate-200" aria-hidden="true" />
      <TrustBadge icon={<WifiOffIcon />} label="Offline Ready" />
      <span className="w-px h-3 bg-slate-200" aria-hidden="true" />
      <TrustBadge icon={<ShieldIcon />} label="Private & Secure" />
    </div>
  );
}