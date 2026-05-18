type ExpiryStatus = "valid" | "near-expiry" | "expired" | "unknown";

function getExpiryStatus(expiryDate?: string): ExpiryStatus {
    if (!expiryDate) return "unknown";
    const [month, year] = expiryDate.split("/").map(Number);
    if (!month || !year) return "unknown";
    const expiry = new Date(year, month - 1, 1);
    const today = new Date();
    const soon = new Date();
    soon.setDate(today.getDate() + 30);
    if (expiry < today) return "expired";
    if (expiry <= soon) return "near-expiry";
    return "valid";
}

const statusConfig = {
    valid: {
        label: "Valid",
        icon: "✓",
        className: "bg-green-50 text-green-700 border border-green-200",
    },
    "near-expiry": {
        label: "Expiring Soon",
        icon: "⚠",
        className: "bg-amber-50 text-amber-800 border border-amber-200",
    },
    expired: {
        label: "Expired",
        icon: "✕",
        className: "bg-red-50 text-red-700 border border-red-200",
    },
    unknown: {
        label: "Expiry Unknown",
        icon: "?",
        className: "bg-slate-50 text-slate-600 border border-slate-200",
    },
};

export function ExpiryBadge({ expiryDate }: { expiryDate?: string }) {
    const status = getExpiryStatus(expiryDate);
    const config = statusConfig[status];

    return (
        <div className={`rounded-2xl p-3 ${config.className}`}>
            <span className="block text-[10px] font-bold tracking-wider uppercase opacity-60">
                Expiry
            </span>
            <span
                role="status"
                aria-label={`Expiry status: ${config.label}`}
                className="mt-0.5 flex items-center gap-1 font-bold"
            >
                <span aria-hidden="true">{config.icon}</span>
                <span>{expiryDate ?? "Unknown"}</span>
                <span className="text-xs font-medium opacity-75">— {config.label}</span>
            </span>
        </div>
    );
}
