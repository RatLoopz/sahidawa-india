export function CdscoStatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        approved: {
            label: "CDSCO Approved",
            className:
                "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border-emerald-250 dark:border-emerald-900/30",
        },
        recalled: {
            label: "Recalled",
            className:
                "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450 border-amber-250 dark:border-amber-900/30",
        },
        banned: {
            label: "Banned",
            className:
                "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/30",
        },
    };
    const c = config[status] ?? {
        label: status,
        className:
            "bg-(--color-surface-muted) text-(--color-text-secondary) border-(--color-border-muted)",
    };
    return (
        <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${c.className}`}
        >
            {c.label}
        </span>
    );
}
