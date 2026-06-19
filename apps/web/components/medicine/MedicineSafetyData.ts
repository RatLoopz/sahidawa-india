export type SeverityLevel = "common" | "severe";
export type DietaryRule = {
    icon: string;
    label: string;
    instruction: string;
    type: "required" | "avoid" | "optional";
};

export type AgeGroup = {
    group: "children" | "adults" | "elderly";
    label: string;
    ageRange: string;
    dose: string;
    frequency: string;
    notes: string[];
    warnings: string[];
};

export type SideEffect = {
    name: string;
    severity: SeverityLevel;
    frequency: "common" | "uncommon" | "rare";
};

export type MedicineSafetyProfile = {
    activeIngredient: string;
    genericName: string;
    /** Common brand names that map to this profile */
    brandAliases?: string[];
    sideEffects: SideEffect[];
    ageBasedDosage: AgeGroup[];
    dietaryCues: DietaryRule[];
    storageNote: string;
    pregnancyCategory?: string;
};

// ---------------------------------------------------------------------------
// Safety Profiles
// ---------------------------------------------------------------------------

const safetyProfiles: MedicineSafetyProfile[] = [
    // ── Paracetamol ──────────────────────────────────────────────────────────
    {
        activeIngredient: "paracetamol",
        genericName: "Paracetamol (Acetaminophen)",
        brandAliases: [
            "crocin",
            "calpol",
            "dolo",
            "dolo 650",
            "calpol 650",
            "metacin",
            "pyrigesic",
            "p-500",
        ],
        sideEffects: [
            { name: "Nausea", severity: "common", frequency: "common" },
            { name: "Stomach upset", severity: "common", frequency: "common" },
            { name: "Headache", severity: "common", frequency: "uncommon" },
            { name: "Dizziness", severity: "common", frequency: "uncommon" },
            { name: "Severe liver damage (overdose)", severity: "severe", frequency: "rare" },
            {
                name: "Allergic skin rash / Steven-Johnson Syndrome",
                severity: "severe",
                frequency: "rare",
            },
            { name: "Blood disorders (agranulocytosis)", severity: "severe", frequency: "rare" },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "2–12 years",
                dose: "10–15 mg/kg per dose (syrup preferred)",
                frequency: "Every 4–6 hours, max 5 doses/day",
                notes: [
                    "Use weight-based dosing for accuracy",
                    "Syrup: 125 mg/5 mL — measure with calibrated dropper",
                ],
                warnings: [
                    "Do NOT give to children under 2 years without medical advice",
                    "Never exceed 75 mg/kg/day",
                ],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "500 mg – 1000 mg per dose",
                frequency: "Every 4–6 hours, max 4 g/day",
                notes: [
                    "Take with a full glass of water",
                    "650 mg tablet (e.g. Dolo 650) common for fever & pain",
                ],
                warnings: [
                    "Avoid alcohol while taking paracetamol",
                    "Do not combine with other paracetamol-containing products",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "500 mg per dose (lower end preferred)",
                frequency: "Every 6–8 hours, max 2 g/day",
                notes: [
                    "Reduced hepatic clearance — use minimum effective dose",
                    "Monitor for signs of toxicity even at normal doses",
                ],
                warnings: [
                    "High risk of liver toxicity with malnutrition or low body weight",
                    "Consult doctor if on warfarin — paracetamol elevates INR",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Take with a full glass of water (200 mL)",
                type: "required",
            },
            {
                icon: "UtensilsCrossed",
                label: "With or Without Food",
                instruction: "Can be taken on empty stomach or after food",
                type: "optional",
            },
            {
                icon: "Wine",
                label: "Avoid Alcohol",
                instruction: "Strictly avoid alcohol — risk of fatal liver damage",
                type: "avoid",
            },
        ],
        storageNote: "Store below 25°C. Keep away from moisture and sunlight.",
        pregnancyCategory: "Category B — Generally considered safe under medical supervision",
    },

    // ── Amoxicillin + Clavulanic Acid ─────────────────────────────────────
    {
        // FIX: was "amoxicillin_clavulanate" — must match resolveIngredientKey return value
        activeIngredient: "amoxicillin_clavulanate",
        genericName: "Amoxicillin + Clavulanic Acid",
        brandAliases: ["augmentin", "mox clav", "clavam", "amoxyclav", "co-amoxiclav"],
        sideEffects: [
            { name: "Diarrhoea", severity: "common", frequency: "common" },
            { name: "Nausea & vomiting", severity: "common", frequency: "common" },
            { name: "Skin rash", severity: "common", frequency: "uncommon" },
            { name: "Abdominal pain", severity: "common", frequency: "common" },
            {
                name: "Anaphylaxis / severe allergic reaction",
                severity: "severe",
                frequency: "rare",
            },
            {
                name: "Clostridium difficile-associated diarrhoea",
                severity: "severe",
                frequency: "rare",
            },
            {
                name: "Cholestatic jaundice / hepatotoxicity",
                severity: "severe",
                frequency: "rare",
            },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "3 months – 12 years",
                dose: "25–45 mg/kg/day (amoxicillin component), divided doses",
                frequency: "Every 8 or 12 hours",
                notes: [
                    "Suspension preferred: 228.5 mg/5 mL or 457 mg/5 mL",
                    "Use lower dose for mild-moderate infections",
                ],
                warnings: [
                    "Check penicillin allergy history before first dose",
                    "Avoid in children with mononucleosis (EBV) — causes rash",
                ],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "Augmentin 625: 1 tablet (Amoxicillin 500mg + Clavulanate 125mg)",
                frequency: "Every 8 hours (3× daily) for 5–7 days",
                notes: [
                    "Complete the full antibiotic course even if feeling better",
                    "Take at the START of a meal to reduce GI side effects",
                ],
                warnings: [
                    "Do not crush or chew tablet",
                    "Disclose any penicillin/beta-lactam allergy to prescriber",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "625 mg every 12 hours (reduced frequency)",
                frequency: "Twice daily with renal function monitoring",
                notes: [
                    "Dose adjustment required for CrCl < 30 mL/min",
                    "Monitor liver enzymes in patients with pre-existing liver disease",
                ],
                warnings: [
                    "Increased risk of hepatic events in older males",
                    "Consult doctor before combining with warfarin or methotrexate",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "UtensilsCrossed",
                label: "At Start of Meal",
                instruction: "Take at the beginning of a meal to minimise stomach upset",
                type: "required",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Swallow whole with a full glass of water",
                type: "required",
            },
            {
                icon: "MilkOff",
                label: "Avoid Milk Alone",
                instruction: "Do not take with milk on an empty stomach",
                type: "avoid",
            },
        ],
        storageNote:
            "Store below 25°C. Reconstituted suspension must be refrigerated and discarded after 7 days.",
        pregnancyCategory: "Category B — Use only if clearly needed; consult physician",
    },

    // ── Amoxicillin (plain) ───────────────────────────────────────────────
    {
        activeIngredient: "amoxicillin",
        genericName: "Amoxicillin",
        brandAliases: ["mox", "amoxil", "novamox", "trimox"],
        sideEffects: [
            { name: "Diarrhoea", severity: "common", frequency: "common" },
            { name: "Nausea", severity: "common", frequency: "common" },
            { name: "Skin rash", severity: "common", frequency: "uncommon" },
            {
                name: "Anaphylaxis / severe allergic reaction",
                severity: "severe",
                frequency: "rare",
            },
            {
                name: "Clostridium difficile-associated diarrhoea",
                severity: "severe",
                frequency: "rare",
            },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "3 months – 12 years",
                dose: "25–50 mg/kg/day, divided doses",
                frequency: "Every 8 hours",
                notes: ["Suspension preferred for accurate weight-based dosing"],
                warnings: [
                    "Check penicillin allergy history before first dose",
                    "Avoid in children with mononucleosis (EBV) — causes rash",
                ],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "250–500 mg per dose",
                frequency: "Every 8 hours for 5–10 days",
                notes: [
                    "Complete the full antibiotic course even if feeling better",
                    "Can be taken with or without food",
                ],
                warnings: ["Disclose any penicillin/beta-lactam allergy to prescriber"],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "250–500 mg per dose",
                frequency: "Every 8–12 hours; adjust for renal function",
                notes: ["Dose adjustment required if CrCl < 30 mL/min"],
                warnings: ["Consult doctor before combining with warfarin"],
            },
        ],
        dietaryCues: [
            {
                icon: "UtensilsCrossed",
                label: "With or Without Food",
                instruction: "Can be taken with or without food",
                type: "optional",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Swallow whole with a full glass of water",
                type: "required",
            },
        ],
        storageNote:
            "Store below 25°C. Reconstituted suspension must be refrigerated and discarded after 14 days.",
        pregnancyCategory: "Category B — Use only if clearly needed; consult physician",
    },

    // ── Fexofenadine ─────────────────────────────────────────────────────────
    {
        activeIngredient: "fexofenadine",
        genericName: "Fexofenadine Hydrochloride",
        brandAliases: ["allegra", "allegra 120", "allegra 180", "fexo", "telfast"],
        sideEffects: [
            { name: "Headache", severity: "common", frequency: "common" },
            { name: "Drowsiness (mild)", severity: "common", frequency: "common" },
            { name: "Dizziness", severity: "common", frequency: "uncommon" },
            { name: "Nausea", severity: "common", frequency: "uncommon" },
            { name: "Menstrual cramps", severity: "common", frequency: "uncommon" },
            {
                name: "Severe allergic reaction (anaphylaxis)",
                severity: "severe",
                frequency: "rare",
            },
            {
                name: "Cardiac arrhythmia (with erythromycin/ketoconazole)",
                severity: "severe",
                frequency: "rare",
            },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "6–11 years",
                dose: "30 mg",
                frequency: "Twice daily",
                notes: [
                    "Fexofenadine 30 mg tablet or oral suspension preferred",
                    "Not recommended under 6 years without specialist advice",
                ],
                warnings: [
                    "Avoid grapefruit juice and apple juice — reduces absorption by up to 36%",
                ],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "120 mg (Allegra 120)",
                frequency: "Once daily for allergic rhinitis; 180 mg once daily for urticaria",
                notes: [
                    "Non-drowsy antihistamine — safe for daytime use",
                    "Onset of action: 1 hour; peak effect at 2–3 hours",
                ],
                warnings: [
                    "Avoid antacids containing aluminum or magnesium within 15 min of dose",
                    "Do not combine with erythromycin or ketoconazole",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "60 mg once or 120 mg once daily",
                frequency: "Once daily (start low)",
                notes: ["Reduced renal clearance — use lower starting dose"],
                warnings: [
                    "Monitor for increased drowsiness even though it is classified non-sedating",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "Apple",
                label: "Avoid Fruit Juices",
                instruction:
                    "Do NOT take with grapefruit, apple, or orange juice — reduces drug absorption significantly",
                type: "avoid",
            },
            {
                icon: "Droplets",
                label: "With Water Only",
                instruction: "Always take with plain water",
                type: "required",
            },
            {
                icon: "Clock",
                label: "Empty Stomach Preferred",
                instruction: "Best absorbed on an empty stomach or 1 hour before meals",
                type: "optional",
            },
        ],
        storageNote:
            "Store at room temperature 15–30°C. Keep in original packaging to protect from humidity.",
        pregnancyCategory: "Category C — Use only if benefit outweighs risk",
    },

    // ── Pantoprazole ─────────────────────────────────────────────────────────
    {
        activeIngredient: "pantoprazole",
        genericName: "Pantoprazole Sodium",
        brandAliases: ["pan 40", "pan d", "pantodac", "pantocid", "nexpro", "pantop"],
        sideEffects: [
            { name: "Headache", severity: "common", frequency: "common" },
            { name: "Diarrhoea", severity: "common", frequency: "common" },
            { name: "Nausea", severity: "common", frequency: "common" },
            { name: "Abdominal pain", severity: "common", frequency: "uncommon" },
            { name: "Flatulence", severity: "common", frequency: "common" },
            { name: "Hypomagnesaemia (long-term use)", severity: "severe", frequency: "uncommon" },
            { name: "Clostridium difficile infection", severity: "severe", frequency: "rare" },
            { name: "Bone fracture risk (long-term)", severity: "severe", frequency: "uncommon" },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "5–17 years (GERD only)",
                dose: "20–40 mg once daily based on weight",
                frequency: "Once daily for up to 8 weeks",
                notes: [
                    "Not approved for children under 5 years",
                    "Tablet must be swallowed whole — do not crush",
                ],
                warnings: ["Not for routine use in children — consult gastroenterologist"],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "40 mg (Pan 40)",
                frequency: "Once daily, 30–60 minutes BEFORE breakfast",
                notes: [
                    "For GERD/acid reflux: 4–8 week course typical",
                    "For H. pylori eradication: used in triple therapy",
                    "Enteric-coated tablet — do NOT crush or split",
                ],
                warnings: [
                    "Avoid taking after meals — significantly reduces efficacy",
                    "Long-term use (>1 year) requires periodic review",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "20–40 mg once daily",
                frequency: "Once daily before breakfast; use lowest effective dose",
                notes: [
                    "No dose adjustment normally needed for age alone",
                    "Monitor magnesium, vitamin B12, and bone density with prolonged use",
                ],
                warnings: [
                    "PPIs increase risk of hip, wrist, and spine fractures in elderly",
                    "Discontinue if not needed — do not continue indefinitely",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "Clock",
                label: "Before Breakfast",
                instruction: "Take 30–60 minutes BEFORE your first meal of the day for best effect",
                type: "required",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Swallow whole with water — do NOT crush or chew",
                type: "required",
            },
            {
                icon: "Coffee",
                label: "Limit Caffeine & Spice",
                instruction: "Reduce coffee, tea, alcohol, and spicy foods for better results",
                type: "avoid",
            },
        ],
        storageNote: "Store below 25°C away from moisture. Keep in blister pack until use.",
        pregnancyCategory: "Category B — Considered low-risk; use with caution",
    },

    // ── Ibuprofen ─────────────────────────────────────────────────────────────
    {
        activeIngredient: "ibuprofen",
        genericName: "Ibuprofen",
        brandAliases: ["brufen", "combiflam", "ibugesic", "advil", "nurofen"],
        sideEffects: [
            { name: "Stomach upset / heartburn", severity: "common", frequency: "common" },
            { name: "Nausea", severity: "common", frequency: "common" },
            { name: "Headache", severity: "common", frequency: "uncommon" },
            { name: "Dizziness", severity: "common", frequency: "uncommon" },
            { name: "GI bleeding / peptic ulcer", severity: "severe", frequency: "rare" },
            { name: "Kidney damage (long-term)", severity: "severe", frequency: "rare" },
            { name: "Cardiovascular events (long-term)", severity: "severe", frequency: "rare" },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "6 months – 12 years",
                dose: "5–10 mg/kg per dose",
                frequency: "Every 6–8 hours; max 40 mg/kg/day",
                notes: [
                    "Suspension preferred — use calibrated dropper",
                    "Not for infants under 6 months",
                ],
                warnings: [
                    "Do not use in children with chickenpox or flu-like illness",
                    "Avoid if child is dehydrated",
                ],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "200–400 mg per dose",
                frequency: "Every 4–6 hours; max 1200 mg/day OTC",
                notes: [
                    "Always take with food or milk to protect the stomach",
                    "Use lowest effective dose for shortest duration",
                ],
                warnings: [
                    "Avoid if history of peptic ulcer or GI bleeding",
                    "Do not combine with aspirin or other NSAIDs",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "200 mg per dose (minimum effective)",
                frequency: "Every 8 hours; avoid long-term use",
                notes: ["Monitor renal function and blood pressure regularly"],
                warnings: [
                    "Significantly elevated risk of GI bleeding and kidney injury",
                    "Avoid if on anticoagulants, ACE inhibitors, or diuretics",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "UtensilsCrossed",
                label: "After Food",
                instruction: "Always take AFTER food or with milk to prevent stomach irritation",
                type: "required",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Take with a full glass of water",
                type: "required",
            },
            {
                icon: "Wine",
                label: "Avoid Alcohol",
                instruction: "Alcohol increases risk of GI bleeding",
                type: "avoid",
            },
        ],
        storageNote: "Store below 25°C, away from moisture.",
        pregnancyCategory:
            "Category D in 3rd trimester — Avoid during pregnancy especially after 20 weeks",
    },

    // ── Cetirizine ────────────────────────────────────────────────────────────
    {
        activeIngredient: "cetirizine",
        genericName: "Cetirizine Hydrochloride",
        brandAliases: ["cetrizet", "alerid", "cetzine", "zyrtec", "okacet"],
        sideEffects: [
            { name: "Drowsiness", severity: "common", frequency: "common" },
            { name: "Dry mouth", severity: "common", frequency: "common" },
            { name: "Headache", severity: "common", frequency: "uncommon" },
            { name: "Fatigue", severity: "common", frequency: "common" },
            { name: "Severe allergic reaction", severity: "severe", frequency: "rare" },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "2–11 years",
                dose: "2.5–5 mg",
                frequency: "Once or twice daily",
                notes: ["Syrup available: 5 mg/5 mL", "Under 2 years — consult doctor only"],
                warnings: ["May cause paradoxical excitability in young children"],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "10 mg",
                frequency: "Once daily (evening preferred to minimize drowsiness)",
                notes: [
                    "May cause drowsiness — avoid driving if affected",
                    "Effective for allergic rhinitis, urticaria, and itching",
                ],
                warnings: [
                    "Avoid alcohol — enhanced sedation",
                    "Caution in patients with kidney disease",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "5 mg once daily",
                frequency: "Once daily; adjust for renal impairment",
                notes: ["Reduced clearance — start with half dose"],
                warnings: ["Increased fall risk due to sedation", "Monitor renal function"],
            },
        ],
        dietaryCues: [
            {
                icon: "UtensilsCrossed",
                label: "With or Without Food",
                instruction: "Can be taken with or without food",
                type: "optional",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Take with a full glass of water",
                type: "required",
            },
            {
                icon: "Wine",
                label: "Avoid Alcohol",
                instruction: "Alcohol significantly increases sedation",
                type: "avoid",
            },
        ],
        storageNote: "Store below 30°C, away from moisture and light.",
        pregnancyCategory: "Category B — Use only if clearly needed",
    },

    // ── Azithromycin ──────────────────────────────────────────────────────────
    {
        activeIngredient: "azithromycin",
        genericName: "Azithromycin",
        brandAliases: ["zithromax", "azee", "azimax", "z-pack", "azithral"],
        sideEffects: [
            { name: "Diarrhoea", severity: "common", frequency: "common" },
            { name: "Nausea", severity: "common", frequency: "common" },
            { name: "Abdominal pain", severity: "common", frequency: "common" },
            { name: "Vomiting", severity: "common", frequency: "uncommon" },
            { name: "Cardiac arrhythmia (QT prolongation)", severity: "severe", frequency: "rare" },
            { name: "Severe allergic reaction", severity: "severe", frequency: "rare" },
            { name: "Liver dysfunction", severity: "severe", frequency: "rare" },
        ],
        ageBasedDosage: [
            {
                group: "children",
                label: "Children",
                ageRange: "6 months – 12 years",
                dose: "10 mg/kg on Day 1, then 5 mg/kg on Days 2–5",
                frequency: "Once daily for 3–5 days",
                notes: ["Suspension available: 200 mg/5 mL", "Do not exceed adult dose"],
                warnings: ["Do not use with antacids containing aluminum/magnesium simultaneously"],
            },
            {
                group: "adults",
                label: "Adults",
                ageRange: "18–60 years",
                dose: "500 mg Day 1, then 250 mg Days 2–5 (Z-Pack)",
                frequency: "Once daily",
                notes: [
                    "Complete the full course — do not stop early",
                    "Can be taken with or without food",
                ],
                warnings: [
                    "Avoid in patients with known QT prolongation or arrhythmias",
                    "Do not combine with other QT-prolonging drugs",
                ],
            },
            {
                group: "elderly",
                label: "Senior Citizens",
                ageRange: "60+ years",
                dose: "250–500 mg once daily",
                frequency: "Once daily; use with caution in cardiac patients",
                notes: ["Monitor ECG if cardiac risk factors present"],
                warnings: [
                    "Elevated risk of cardiac arrhythmia",
                    "Consult doctor if on digoxin or warfarin",
                ],
            },
        ],
        dietaryCues: [
            {
                icon: "UtensilsCrossed",
                label: "With or Without Food",
                instruction: "Can be taken with or without food (food may reduce nausea)",
                type: "optional",
            },
            {
                icon: "Droplets",
                label: "With Water",
                instruction: "Take with a full glass of water",
                type: "required",
            },
            {
                icon: "Pill",
                label: "Antacid Gap",
                instruction: "Wait at least 2 hours after antacids before taking azithromycin",
                type: "avoid",
            },
        ],
        storageNote: "Store below 30°C. Reconstituted suspension stable for 5 days — refrigerate.",
        pregnancyCategory: "Category B — Use only if clearly needed",
    },
];

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a search query (brand name, generic name, or composition string)
 * to a normalized ingredient key used in safetyProfiles.
 */
export function resolveIngredientKey(query: string | undefined | null): string {
    if (!query) return "";

    const q = query.toLowerCase().trim();

    // ── Direct active ingredient matches ──────────────────────────────────────
    if (q.includes("paracetamol") || q.includes("acetaminophen")) return "paracetamol";
    if (q.includes("amoxicillin") && (q.includes("clavulanate") || q.includes("clavulanic")))
        return "amoxicillin_clavulanate";
    if (q.includes("amoxicillin")) return "amoxicillin";
    if (q.includes("fexofenadine")) return "fexofenadine";
    if (q.includes("pantoprazole")) return "pantoprazole";
    if (q.includes("ibuprofen")) return "ibuprofen";
    if (q.includes("cetirizine")) return "cetirizine";
    if (q.includes("azithromycin")) return "azithromycin";

    // ── Brand alias lookup (checks brandAliases on each profile) ─────────────
    for (const profile of safetyProfiles) {
        if (profile.brandAliases) {
            for (const alias of profile.brandAliases) {
                if (q.includes(alias) || alias.includes(q)) {
                    return profile.activeIngredient;
                }
            }
        }
    }

    return "";
}

/**
 * Returns the safety profile for a given search query.
 * Accepts a brand name, generic name, or composition string.
 */
export function getSafetyProfile(query: string | undefined | null): MedicineSafetyProfile | null {
    if (!query) return null;
    const key = resolveIngredientKey(query);
    if (!key) return null;
    return safetyProfiles.find((p) => p.activeIngredient === key) ?? null;
}

export { safetyProfiles };
export { getSafetyProfile as getStaticSafetyProfile };
