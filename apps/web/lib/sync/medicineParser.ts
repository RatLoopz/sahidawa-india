export function extractExpiryDate(text: string): string | null {
    // 1. Most specific: DD/MM/YYYY
    const ddMmYyyy = /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/;
    const dmy = text.match(ddMmYyyy);
    if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10);
        const year = parseInt(dmy[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day
            ) {
                return `${dmy[2]}/${dmy[3]}`;
            }
        }
        return null;
    }

    // 2. Named months: JAN 2024
    const mmm =
        /(?:EXP(?:IRY)?\s*)?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\.?\s*(\d{4})/i;
    const mm = text.match(mmm);
    if (mm) {
        const map: Record<string, string> = {
            jan: "01",
            feb: "02",
            mar: "03",
            apr: "04",
            may: "05",
            jun: "06",
            jul: "07",
            aug: "08",
            sep: "09",
            oct: "10",
            nov: "11",
            dec: "12",
        };
        const month = map[mm[1].toLowerCase()];
        if (month) return `${month}/${mm[2]}`;
    }

    // 3. Labeled MM/YYYY or MM/YY
    const labeled =
        /(?:EXP(?:IRY)?\.?\s*(?:DATE)?|EXPIRY|USE\s+BEFORE|BB|E\.?D\.?)[:\s.-]*(\d{1,2})[\/\s.-](\d{4}|\d{2})/i;
    const m = text.match(labeled);
    if (m) {
        const month = m[1].padStart(2, "0");
        const year = m[2].length === 2 ? "20" + m[2] : m[2];
        const mn = parseInt(month, 10);
        if (mn >= 1 && mn <= 12) {
            return `${month}/${year}`;
        }
        // If explicitly labeled as EXP but month is invalid, do not fall through to generic dates (which could be Mfg dates)
        return null;
    }

    // 4. Generic MM/YYYY or MM/YY
    const generic = /\b(0[1-9]|1[0-2])[\/\s.-](20[2-9]\d|[2-9]\d)\b/;
    const g = text.match(generic);
    if (g) {
        const year = g[2].length === 2 ? "20" + g[2] : g[2];
        return `${g[1]}/${year}`;
    }

    return null;
}

export function extractBatchNumber(text: string): string | null {
    const patterns = [
        /(?:BATCH\s*(?:NO\.?)?|LOT\s*(?:NO\.?)?|B\.?\s*NO\.?|BATCH)[:\s.-]*([A-Z0-9][A-Z0-9\/\-]{2,14})/i,
        /\b([A-Z]{1,3}[0-9]{3,12}[A-Z0-9]*)\b/,
    ];

    const BLOCKLIST = new Set([
        "CDSCO",
        "APPROVED",
        "TABLET",
        "EXPIRY",
        "BATCH",
        "MANUFACTURING",
        "MRP",
        "RS",
        "INR",
        "MFG",
        "EXP",
        "COMPOSITION",
        "CAPSULE",
        "STRIP",
        "TABS",
        "MG",
    ]);

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const candidate = match[1].trim().toUpperCase();
            if (!BLOCKLIST.has(candidate) && candidate.length >= 3) {
                return candidate;
            }
        }
    }
    return null;
}

export function extractMedicineName(text: string): string | null {
    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const skip =
        /^(exp(?:iry)?|batch|b\.?\s*no|mfg|date|composition|tablet(?:s)?|capsule(?:s)?|strip(?:s)?|drops?|syrup|injection|suspension|solution|ointment|cream|gel|powder|granules?|spray|inhaler|mg|mrp|rs|inr|use|manufacture|store|keep|dosage)/i;

    for (const line of lines) {
        if (skip.test(line)) continue;
        if (/^\d/.test(line)) continue;

        const allCaps = line.match(/\b([A-Z][A-Z\s-]{2,})\b/);
        if (allCaps) {
            const candidate = allCaps[1].replace(/\s+/g, " ").trim();
            if (candidate.length >= 3 && !/\d/.test(candidate)) return candidate;
        }
    }

    for (const line of lines) {
        if (skip.test(line)) continue;
        if (/^\d/.test(line)) continue;
        const cleaned = line.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        if (cleaned.length > 2) return cleaned;
    }

    return null;
}
