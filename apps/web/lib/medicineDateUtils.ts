export function formatExpiryForBadge(isoDate: string | null | undefined): string | undefined {
    if (!isoDate) return undefined;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return undefined;
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function expiryToIso(expiryStr: string): string {
    const [month, year] = expiryStr.split("/");
    return `${year}-${month.padStart(2, "0")}-01T00:00:00.000Z`;
}
