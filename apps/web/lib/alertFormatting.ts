function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getVisibleAlertBatchNumber(
    composition: string | null | undefined,
    batchNumber: string | number | null | undefined
): string | null {
    const normalizedBatchNumber = String(batchNumber ?? "").trim();

    if (!normalizedBatchNumber) {
        return null;
    }

    const normalizedComposition = String(composition ?? "").toLowerCase();
    const batchTokenPattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(normalizedBatchNumber.toLowerCase())}([^a-z0-9]|$)`
    );

    return batchTokenPattern.test(normalizedComposition) ? null : normalizedBatchNumber;
}
