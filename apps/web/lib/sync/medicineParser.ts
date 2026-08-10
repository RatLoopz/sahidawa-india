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

/**
 * Known Indian medicine brand names and their generic active ingredients.
 * Used to identify a medicine from OCR text even when the formal parsing fails.
 */
export const BRAND_TO_GENERIC: Record<string, string> = {
    // Paracetamol / Acetaminophen brands
    dolo: "paracetamol",
    crocin: "paracetamol",
    calpol: "paracetamol",
    malidens: "paracetamol",
    panadol: "paracetamol",
    pyrigesic: "paracetamol",
    febrex: "paracetamol",
    metacin: "paracetamol",
    "p-250": "paracetamol",
    // Telmisartan brands
    telma: "telmisartan",
    "telma-ct": "telmisartan",
    "telma-h": "telmisartan",
    "telma-am": "telmisartan",
    telvas: "telmisartan",
    tazloc: "telmisartan",
    telmikind: "telmisartan",
    telpres: "telmisartan",
    sartel: "telmisartan",
    // Ibuprofen brands
    brufen: "ibuprofen",
    combiflam: "ibuprofen",
    ibugesic: "ibuprofen",
    advil: "ibuprofen",
    nurofen: "ibuprofen",
    // Amoxicillin brands
    amoxil: "amoxicillin",
    novamox: "amoxicillin",
    mox: "amoxicillin",
    wymox: "amoxicillin",
    // Azithromycin brands
    zithromax: "azithromycin",
    azithral: "azithromycin",
    azee: "azithromycin",
    azax: "azithromycin",
    // Metformin brands
    glucophage: "metformin",
    glycomet: "metformin",
    gluconorm: "metformin",
    obimet: "metformin",
    // Atorvastatin brands
    lipitor: "atorvastatin",
    atorva: "atorvastatin",
    storvas: "atorvastatin",
    lipvas: "atorvastatin",
    // Amlodipine brands
    norvasc: "amlodipine",
    stamlo: "amlodipine",
    amlokind: "amlodipine",
    amlong: "amlodipine",
    // Omeprazole / PPI brands
    prilosec: "omeprazole",
    omez: "omeprazole",
    losec: "omeprazole",
    pantocid: "pantoprazole",
    pan: "pantoprazole",
    rablet: "rabeprazole",
    // Cetirizine brands
    zyrtec: "cetirizine",
    cetzine: "cetirizine",
    alerid: "cetirizine",
    okacet: "cetirizine",
    // Ciprofloxacin brands
    cipro: "ciprofloxacin",
    ciplox: "ciprofloxacin",
    cifran: "ciprofloxacin",
    // Metronidazole brands
    flagyl: "metronidazole",
    metrogyl: "metronidazole",
    aristogyl: "metronidazole",
    // Aspirin brands
    disprin: "aspirin",
    ecosprin: "aspirin",
    loprin: "aspirin",
    // Clopidogrel brands
    plavix: "clopidogrel",
    clopilet: "clopidogrel",
    deplatt: "clopidogrel",
    // Levothyroxine brands
    thyronorm: "levothyroxine",
    eltroxin: "levothyroxine",
    // Ondansetron brands
    zofran: "ondansetron",
    ondem: "ondansetron",
    vomikind: "ondansetron",
    // Domperidone brands
    domstal: "domperidone",
    vomitab: "domperidone",
    domperidone: "domperidone",
    // Diclofenac brands
    voveran: "diclofenac",
    volini: "diclofenac",
    diclofenac: "diclofenac",
    // Salbutamol brands
    asthalin: "salbutamol",
    ventolin: "salbutamol",
    levolin: "salbutamol",
};

/**
 * Given raw OCR text, attempts to identify the medicine name.
 *
 * Strategy:
 * 1. Look for known Indian brand names directly in the OCR text (brand lookup)
 * 2. Look for IP/BP/USP generic names (e.g. "Paracetamol Tablets IP")
 * 3. Fall back to first meaningful all-caps line (at least 4 chars, not a noise word)
 *
 * Returns null if the text is too short or noisy to extract a reliable name.
 */
export function extractMedicineName(text: string): string | null {
    if (!text || text.trim().length < 4) return null;

    const norm = text.toLowerCase();

    // Strategy 1: Brand name lookup in full OCR text
    for (const [brand] of Object.entries(BRAND_TO_GENERIC)) {
        if (norm.includes(brand)) {
            // Return the original-case match from the text
            const re = new RegExp(`\\b${brand}\\b`, "i");
            const m = text.match(re);
            return m ? m[0] : brand;
        }
    }

    // Strategy 2: Look for "XYZ Tablets IP/BP/USP" pattern (generic medicine name line)
    const ipPattern = /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+Tablets?\s+I\.?P\.?|B\.?P\.?|U\.?S\.?P\.?/i;
    const ipMatch = text.match(ipPattern);
    if (ipMatch?.[1]) {
        const name = ipMatch[1].trim();
        if (name.length >= 4) return name;
    }

    // Strategy 3 & 4 helper lists
    const FULL_LINE_SKIP = [
        "warning",
        "warn",
        "arng",
        "warng",
        "schedule",
        "prescription",
        "retail",
        "practitioner",
        "medical",
        "drug",
        "manufactur",
        "marketed",
        "mfg",
        "exp",
        "batch",
        "lot",
        "licence",
        "lic no",
        "glenmark",
        "abbott",
        "cipla",
        "sun pharma",
        "lupin",
        "torrent",
        "alkem",
        "intas",
        "cadila",
        "zydus",
        "pfizer",
        "gsk",
        "micro labs",
        "macleods",
        "composition",
        "excipients",
        "dosage",
        "directed",
        "physician",
        "doctor",
        "store",
        "keep",
        "children",
        "temperature",
        "moisture",
        "light",
        "overdose",
        "injurious",
        "liver",
        "trade mark",
        "regd",
    ];

    const CLEAN_WORDS = [
        /\btablets?\b/gi,
        /\bcapsules?\b/gi,
        /\bstrips?\b/gi,
        /\bmg\b/gi,
        /\bmcg\b/gi,
        /\bml\b/gi,
    ];

    const shouldSkipLine = (line: string): boolean => {
        const lower = line.toLowerCase();
        return FULL_LINE_SKIP.some((word) => lower.includes(word));
    };

    const cleanCandidate = (line: string): string => {
        let cleaned = line;
        for (const regex of CLEAN_WORDS) {
            cleaned = cleaned.replace(regex, "");
        }
        return cleaned
            .replace(/[^a-zA-Z\s\-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    // Strategy 3: All-caps meaningful line (brand names are usually printed in ALL CAPS on Indian strips)
    for (const line of lines) {
        if (shouldSkipLine(line)) continue;
        if (/^\d/.test(line)) continue;

        const allCaps = line.match(/\b([A-Z][A-Z\s\-]{3,})\b/);
        if (allCaps) {
            const candidate = cleanCandidate(allCaps[1]);
            if (candidate.length >= 4 && !shouldSkipLine(candidate)) {
                return candidate;
            }
        }
    }

    // Strategy 4: First non-noise, non-numeric line with 4+ meaningful characters
    for (const line of lines) {
        if (shouldSkipLine(line)) continue;
        if (/^\d/.test(line)) continue;
        const candidate = cleanCandidate(line);
        if (candidate.length >= 4) {
            return candidate;
        }
    }

    return null;
}

/**
 * Given a medicine name (brand or generic), resolve it to the generic active
 * ingredient if it's a known brand. Returns the original name if not found.
 */
export function resolveToGeneric(medicineName: string): string {
    const norm = medicineName.toLowerCase().trim();
    // Check full match first, then partial
    if (BRAND_TO_GENERIC[norm]) return BRAND_TO_GENERIC[norm];
    for (const [brand, generic] of Object.entries(BRAND_TO_GENERIC)) {
        if (norm.includes(brand) || brand.includes(norm)) return generic;
    }
    return norm;
}
