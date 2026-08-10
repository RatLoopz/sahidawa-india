/**
 * Static knowledge base for common active pharmaceutical ingredients (APIs)
 * used in India. Enables SahiDawa to show useful medicine information to rural
 * users even when the specific brand is not present in the CDSCO database.
 *
 * Data sourced from WHO Essential Medicines List, CDSCO approvals, and
 * standard Indian pharmacopoeia (IP) references. Not a substitute for
 * professional medical advice.
 */

export interface IngredientInfo {
    /** Generic / INN name of the active ingredient */
    genericName: string;
    /** Common therapeutic uses, written in plain language */
    uses: string;
    /** Standard dose forms available in India */
    commonForms: string;
    /** Important safety notes for the patient */
    safetyNote: string;
    /** Drug category / pharmacological class */
    category: string;
}

/** Normalise a string for fuzzy matching */
const normalise = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const KNOWLEDGE_BASE: Record<string, IngredientInfo> = {
    acetaminophen: {
        genericName: "Paracetamol / Acetaminophen",
        uses: "Fever reduction, mild to moderate pain (headache, toothache, body ache, period pain)",
        commonForms: "Tablet 500 mg, Syrup, Suppository",
        safetyNote:
            "Do not exceed 4 g per day. Avoid alcohol. Consult a doctor if fever persists beyond 3 days.",
        category: "Analgesic / Antipyretic",
    },
    paracetamol: {
        genericName: "Paracetamol / Acetaminophen",
        uses: "Fever reduction, mild to moderate pain (headache, toothache, body ache, period pain)",
        commonForms: "Tablet 500 mg / 650 mg, Syrup, Drops",
        safetyNote:
            "Do not exceed 4 g per day. Avoid alcohol. Not for liver or kidney disease without advice.",
        category: "Analgesic / Antipyretic",
    },
    amoxicillin: {
        genericName: "Amoxicillin",
        uses: "Bacterial infections: throat, ear, chest, urinary tract, skin",
        commonForms: "Capsule 250 mg / 500 mg, Syrup, Injection",
        safetyNote:
            "Complete the full course. Inform doctor of penicillin allergy. Do not use for viral infections.",
        category: "Antibiotic (Penicillin class)",
    },
    azithromycin: {
        genericName: "Azithromycin",
        uses: "Bacterial infections: chest, throat, ear, skin, typhoid",
        commonForms: "Tablet 250 mg / 500 mg, Syrup",
        safetyNote: "Usually taken as a 3- or 5-day course. Inform doctor of heart conditions.",
        category: "Antibiotic (Macrolide class)",
    },
    metformin: {
        genericName: "Metformin",
        uses: "Type 2 diabetes — lowers blood sugar",
        commonForms: "Tablet 500 mg / 850 mg / 1000 mg (plain or extended-release)",
        safetyNote:
            "Take with food to reduce stomach upset. Do not skip doses. Regular kidney function check needed.",
        category: "Antidiabetic (Biguanide)",
    },
    atorvastatin: {
        genericName: "Atorvastatin",
        uses: "Lowers high cholesterol and triglycerides; reduces heart attack and stroke risk",
        commonForms: "Tablet 10 mg / 20 mg / 40 mg / 80 mg",
        safetyNote:
            "Take at the same time daily. Report unexplained muscle pain or weakness immediately.",
        category: "Statin (Cholesterol-lowering)",
    },
    amlodipine: {
        genericName: "Amlodipine",
        uses: "High blood pressure (hypertension), chest pain (angina)",
        commonForms: "Tablet 5 mg / 10 mg",
        safetyNote:
            "Do not stop suddenly. May cause ankle swelling. Monitor blood pressure regularly.",
        category: "Calcium Channel Blocker (Antihypertensive)",
    },
    metoprolol: {
        genericName: "Metoprolol",
        uses: "High blood pressure, angina, heart failure, irregular heartbeat",
        commonForms: "Tablet 25 mg / 50 mg / 100 mg",
        safetyNote:
            "Do not stop abruptly — taper dose. Can mask low blood sugar symptoms in diabetics.",
        category: "Beta-Blocker (Antihypertensive)",
    },
    losartan: {
        genericName: "Losartan",
        uses: "High blood pressure, diabetic kidney protection, heart failure",
        commonForms: "Tablet 25 mg / 50 mg / 100 mg",
        safetyNote:
            "Avoid during pregnancy. Monitor potassium levels. Do not combine with potassium supplements.",
        category: "ARB (Antihypertensive)",
    },
    omeprazole: {
        genericName: "Omeprazole",
        uses: "Acidity, heartburn, peptic ulcer, GERD (acid reflux)",
        commonForms: "Capsule 20 mg / 40 mg, Tablet",
        safetyNote:
            "Take 30 minutes before food. Long-term use may reduce magnesium and vitamin B12 levels.",
        category: "Proton Pump Inhibitor (Antacid)",
    },
    pantoprazole: {
        genericName: "Pantoprazole",
        uses: "Acidity, heartburn, peptic ulcer, GERD",
        commonForms: "Tablet 20 mg / 40 mg, Injection",
        safetyNote: "Take before meals. Inform doctor if used long-term.",
        category: "Proton Pump Inhibitor (Antacid)",
    },
    rabeprazole: {
        genericName: "Rabeprazole",
        uses: "Acidity, gastric ulcer, GERD",
        commonForms: "Tablet 10 mg / 20 mg",
        safetyNote: "Take before food. Not for use in severe liver disease.",
        category: "Proton Pump Inhibitor (Antacid)",
    },
    cetirizine: {
        genericName: "Cetirizine",
        uses: "Allergies, runny nose, itchy eyes, skin rash (urticaria), hay fever",
        commonForms: "Tablet 5 mg / 10 mg, Syrup",
        safetyNote: "May cause drowsiness. Avoid driving or operating machinery after taking.",
        category: "Antihistamine (Anti-allergy)",
    },
    montelukast: {
        genericName: "Montelukast",
        uses: "Asthma prevention, allergic rhinitis, seasonal allergies",
        commonForms: "Tablet 4 mg / 5 mg / 10 mg, Chewable tablet",
        safetyNote:
            "Not for acute asthma attacks. Report mood changes or sleep problems to doctor.",
        category: "Leukotriene Inhibitor (Anti-asthma)",
    },
    salbutamol: {
        genericName: "Salbutamol / Albuterol",
        uses: "Relief of acute asthma, bronchospasm, COPD breathlessness",
        commonForms: "Inhaler (100 mcg/puff), Syrup, Nebuliser solution",
        safetyNote:
            "Rescue inhaler — use when needed. Overuse can worsen asthma. Shake before use.",
        category: "Bronchodilator (Short-acting Beta-2 agonist)",
    },
    budesonide: {
        genericName: "Budesonide",
        uses: "Prevention (not relief) of asthma, nasal allergies, inflammatory bowel disease",
        commonForms: "Inhaler, Nasal spray, Tablet",
        safetyNote:
            "Rinse mouth after using inhaler. Long-term use requires regular doctor monitoring.",
        category: "Corticosteroid (Anti-inflammatory)",
    },
    dexamethasone: {
        genericName: "Dexamethasone",
        uses: "Severe allergic reactions, inflammatory conditions, respiratory distress",
        commonForms: "Tablet 0.5 mg, Injection",
        safetyNote:
            "Do not stop abruptly after long-term use. Can raise blood sugar. Use shortest effective course.",
        category: "Corticosteroid (Steroid)",
    },
    prednisolone: {
        genericName: "Prednisolone",
        uses: "Allergies, asthma, arthritis, autoimmune conditions",
        commonForms: "Tablet 5 mg / 10 mg / 20 mg, Syrup",
        safetyNote:
            "Take with food. Do not stop abruptly. Can increase blood sugar and infection risk.",
        category: "Corticosteroid (Steroid)",
    },
    ibuprofen: {
        genericName: "Ibuprofen",
        uses: "Pain (headache, toothache, joint pain, period pain), fever, inflammation",
        commonForms: "Tablet 200 mg / 400 mg / 600 mg, Syrup",
        safetyNote:
            "Take with food to protect the stomach. Avoid in kidney disease, peptic ulcer. Not for children under 6 months.",
        category: "NSAID (Anti-inflammatory / Analgesic)",
    },
    diclofenac: {
        genericName: "Diclofenac",
        uses: "Joint pain (arthritis), muscle pain, dental pain, post-operative pain",
        commonForms: "Tablet 50 mg / 100 mg, Gel, Injection",
        safetyNote:
            "Take with food. Avoid in heart disease or kidney problems. Not for long-term use without medical supervision.",
        category: "NSAID (Anti-inflammatory / Analgesic)",
    },
    tramadol: {
        genericName: "Tramadol",
        uses: "Moderate to severe pain",
        commonForms: "Tablet 50 mg / 100 mg, Injection",
        safetyNote:
            "Schedule H drug — requires prescription. Risk of dependence. Can cause dizziness and nausea.",
        category: "Opioid-like Analgesic",
    },
    gabapentin: {
        genericName: "Gabapentin",
        uses: "Nerve pain, epilepsy (seizures)",
        commonForms: "Capsule 100 mg / 300 mg / 400 mg",
        safetyNote: "Schedule H drug. Can cause drowsiness and dizziness. Do not stop suddenly.",
        category: "Anticonvulsant / Neuropathic pain agent",
    },
    metronidazole: {
        genericName: "Metronidazole",
        uses: "Bacterial and parasitic infections: stomach infections, amoeba, giardia",
        commonForms: "Tablet 200 mg / 400 mg, Syrup, Injection, Gel",
        safetyNote:
            "Strictly avoid alcohol during treatment and 48 hours after. Can cause metallic taste.",
        category: "Antibiotic / Antiprotozoal",
    },
    ciprofloxacin: {
        genericName: "Ciprofloxacin",
        uses: "Urinary tract infections, respiratory infections, typhoid, traveller's diarrhoea",
        commonForms: "Tablet 250 mg / 500 mg, Eye drops, Injection",
        safetyNote:
            "Schedule H. Avoid in children under 18 unless directed. Take with plenty of water.",
        category: "Antibiotic (Fluoroquinolone)",
    },
    cefixime: {
        genericName: "Cefixime",
        uses: "Throat, ear, urinary tract and chest infections",
        commonForms: "Tablet 100 mg / 200 mg, Syrup",
        safetyNote: "Complete the full course. Inform doctor if allergic to cephalosporins.",
        category: "Antibiotic (Cephalosporin)",
    },
    doxycycline: {
        genericName: "Doxycycline",
        uses: "Bacterial infections, malaria prevention, acne, typhus, leptospirosis",
        commonForms: "Capsule 100 mg, Tablet",
        safetyNote:
            "Take with plenty of water. Avoid lying down for 30 min after. Increases sun sensitivity.",
        category: "Antibiotic (Tetracycline class)",
    },
    chloroquine: {
        genericName: "Chloroquine",
        uses: "Malaria treatment and prevention",
        commonForms: "Tablet 250 mg / 500 mg",
        safetyNote:
            "Resistance is common in some regions. Requires prescription. Avoid in G6PD deficiency.",
        category: "Antimalarial",
    },
    artemether: {
        genericName: "Artemether + Lumefantrine",
        uses: "Uncomplicated falciparum malaria",
        commonForms: "Tablet (combination)",
        safetyNote: "Take with fatty food for better absorption. Complete the full 6-dose course.",
        category: "Antimalarial (Artemisinin-based combination)",
    },
    hydroxychloroquine: {
        genericName: "Hydroxychloroquine",
        uses: "Rheumatoid arthritis, lupus, malaria prevention",
        commonForms: "Tablet 200 mg / 400 mg",
        safetyNote:
            "Requires prescription. Regular eye check-ups needed for long-term use. Not for self-medication.",
        category: "Antimalarial / Immunomodulator",
    },
    insulin: {
        genericName: "Insulin",
        uses: "Type 1 diabetes and advanced Type 2 diabetes — blood sugar control",
        commonForms: "Injection (vial / cartridge / pen), various types (Regular, NPH, Glargine)",
        safetyNote:
            "Store in refrigerator. Rotate injection sites. Carry glucose source for hypoglycemia.",
        category: "Antidiabetic (Hormone)",
    },
    glimepiride: {
        genericName: "Glimepiride",
        uses: "Type 2 diabetes — stimulates the pancreas to release insulin",
        commonForms: "Tablet 1 mg / 2 mg / 3 mg / 4 mg",
        safetyNote:
            "Risk of low blood sugar (hypoglycemia). Take with or just before food. Avoid skipping meals.",
        category: "Antidiabetic (Sulfonylurea)",
    },
    vildagliptin: {
        genericName: "Vildagliptin",
        uses: "Type 2 diabetes — works by increasing insulin levels after meals",
        commonForms: "Tablet 50 mg",
        safetyNote: "Usually combined with metformin. Monitor liver function periodically.",
        category: "Antidiabetic (DPP-4 Inhibitor)",
    },
    telmisartan: {
        genericName: "Telmisartan",
        uses: "High blood pressure, cardiovascular risk reduction",
        commonForms: "Tablet 20 mg / 40 mg / 80 mg",
        safetyNote: "Avoid during pregnancy. Monitor kidney function and potassium levels.",
        category: "ARB (Antihypertensive)",
    },
    ramipril: {
        genericName: "Ramipril",
        uses: "High blood pressure, heart failure, kidney protection in diabetes",
        commonForms: "Capsule / Tablet 1.25 mg / 2.5 mg / 5 mg / 10 mg",
        safetyNote: "Can cause persistent dry cough. Avoid in pregnancy. Monitor kidney function.",
        category: "ACE Inhibitor (Antihypertensive)",
    },
    enalapril: {
        genericName: "Enalapril",
        uses: "High blood pressure, heart failure",
        commonForms: "Tablet 2.5 mg / 5 mg / 10 mg / 20 mg",
        safetyNote: "Can cause dry cough. Monitor potassium and kidney function.",
        category: "ACE Inhibitor (Antihypertensive)",
    },
    furosemide: {
        genericName: "Furosemide",
        uses: "Fluid retention (oedema) in heart failure, kidney and liver disease",
        commonForms: "Tablet 20 mg / 40 mg, Injection",
        safetyNote:
            "Can cause low potassium — eat potassium-rich foods or as directed. Causes frequent urination.",
        category: "Diuretic (Water tablet)",
    },
    spironolactone: {
        genericName: "Spironolactone",
        uses: "Heart failure, high blood pressure, fluid retention, hormonal acne",
        commonForms: "Tablet 25 mg / 50 mg / 100 mg",
        safetyNote:
            "Avoid excess potassium intake. Monitor kidney and potassium levels. Avoid in pregnancy.",
        category: "Potassium-sparing Diuretic",
    },
    warfarin: {
        genericName: "Warfarin",
        uses: "Blood clot prevention, atrial fibrillation, deep vein thrombosis",
        commonForms: "Tablet 1 mg / 2 mg / 5 mg",
        safetyNote:
            "Regular INR blood tests required. Many drug and food interactions. Avoid with aspirin unless prescribed.",
        category: "Anticoagulant (Blood thinner)",
    },
    aspirin: {
        genericName: "Aspirin (Acetylsalicylic Acid)",
        uses: "Heart attack prevention (low dose), fever and pain relief (higher dose)",
        commonForms: "Tablet 75 mg / 150 mg / 325 mg / 500 mg",
        safetyNote:
            "Low doses for heart protection must be taken daily without skipping. Avoid in peptic ulcer. Not for children with viral infections.",
        category: "Antiplatelet / Analgesic / NSAID",
    },
    clopidogrel: {
        genericName: "Clopidogrel",
        uses: "Heart attack and stroke prevention, after angioplasty",
        commonForms: "Tablet 75 mg",
        safetyNote:
            "Do not stop without doctor's advice — increases clot risk. Report unusual bleeding.",
        category: "Antiplatelet",
    },
    levothyroxine: {
        genericName: "Levothyroxine",
        uses: "Hypothyroidism (underactive thyroid), goitre",
        commonForms: "Tablet 25 mcg / 50 mcg / 100 mcg",
        safetyNote:
            "Take on empty stomach, 30–60 min before breakfast. Many interactions — inform doctor of all medicines.",
        category: "Thyroid Hormone Replacement",
    },
    sertraline: {
        genericName: "Sertraline",
        uses: "Depression, anxiety disorders, OCD, PTSD",
        commonForms: "Tablet 25 mg / 50 mg / 100 mg",
        safetyNote:
            "Schedule H. Takes 2–4 weeks for full effect. Do not stop suddenly. Not for under 18 without advice.",
        category: "Antidepressant (SSRI)",
    },
    escitalopram: {
        genericName: "Escitalopram",
        uses: "Depression, generalised anxiety disorder, panic disorder",
        commonForms: "Tablet 5 mg / 10 mg / 20 mg",
        safetyNote: "Takes several weeks for effect. Do not stop abruptly. Avoid alcohol.",
        category: "Antidepressant (SSRI)",
    },
    alprazolam: {
        genericName: "Alprazolam",
        uses: "Anxiety, panic disorder (short-term)",
        commonForms: "Tablet 0.25 mg / 0.5 mg / 1 mg",
        safetyNote:
            "Schedule H — requires prescription. High risk of dependence. Do not drive. Avoid alcohol.",
        category: "Anxiolytic (Benzodiazepine)",
    },
    clonazepam: {
        genericName: "Clonazepam",
        uses: "Epilepsy, panic disorder, involuntary movement disorders",
        commonForms: "Tablet 0.5 mg / 1 mg / 2 mg",
        safetyNote: "Schedule H. Dependence risk. Do not stop abruptly. Causes drowsiness.",
        category: "Anticonvulsant / Anxiolytic (Benzodiazepine)",
    },
    ondansetron: {
        genericName: "Ondansetron",
        uses: "Nausea and vomiting (from chemotherapy, surgery, or infections)",
        commonForms: "Tablet 4 mg / 8 mg, Syrup, Injection",
        safetyNote: "Do not crush or chew. Not for long-term use without supervision.",
        category: "Antiemetic (Anti-nausea)",
    },
    domperidone: {
        genericName: "Domperidone",
        uses: "Nausea, vomiting, bloating, slow stomach emptying",
        commonForms: "Tablet 10 mg, Syrup",
        safetyNote:
            "Take before meals. Use shortest effective dose. Avoid if history of cardiac problems.",
        category: "Antiemetic / Prokinetic",
    },
    loperamide: {
        genericName: "Loperamide",
        uses: "Diarrhoea (short-term relief)",
        commonForms: "Capsule / Tablet 2 mg, Syrup",
        safetyNote:
            "Keep up fluid intake. Do not use for bloody diarrhoea or fever. Not for infants.",
        category: "Antidiarrhoeal",
    },
    iron: {
        genericName: "Ferrous Sulfate / Iron Supplement",
        uses: "Iron deficiency anaemia, pregnancy anaemia prevention",
        commonForms: "Tablet 100 mg / 200 mg, Syrup, Injection",
        safetyNote:
            "Take with water or juice — not with milk or tea. Can cause dark stools and constipation.",
        category: "Haematinic (Iron supplement)",
    },
    folic: {
        genericName: "Folic Acid",
        uses: "Prevention of neural tube defects in pregnancy, anaemia treatment",
        commonForms: "Tablet 0.5 mg / 1 mg / 5 mg",
        safetyNote:
            "Start before conception for pregnancy. Safe for long-term use at normal doses.",
        category: "Vitamin / Haematinic",
    },
    vitamin: {
        genericName: "Vitamin / Nutritional Supplement",
        uses: "Nutritional deficiency correction, immune support, bone health",
        commonForms: "Tablet, Capsule, Syrup, Injection",
        safetyNote:
            "Follow recommended dose. Excessive fat-soluble vitamins (A, D, E, K) can be harmful.",
        category: "Nutritional Supplement",
    },
    calcium: {
        genericName: "Calcium Carbonate / Citrate",
        uses: "Calcium deficiency, osteoporosis prevention, antacid (at low doses)",
        commonForms: "Tablet 500 mg / 1000 mg, Syrup",
        safetyNote:
            "Take with food for better absorption. Calcium carbonate needs stomach acid — take with meals.",
        category: "Mineral Supplement / Antacid",
    },
    fluconazole: {
        genericName: "Fluconazole",
        uses: "Fungal infections: oral thrush, vaginal candidiasis, skin and nail infections",
        commonForms: "Capsule 50 mg / 150 mg / 200 mg, Syrup",
        safetyNote:
            "Single dose of 150 mg is often sufficient for vaginal thrush. Inform doctor of liver conditions.",
        category: "Antifungal",
    },
    acyclovir: {
        genericName: "Acyclovir",
        uses: "Herpes infections (cold sores, genital herpes, shingles, chickenpox)",
        commonForms: "Tablet 200 mg / 400 mg / 800 mg, Cream, Injection",
        safetyNote: "Drink plenty of water. Start as early as possible after symptoms appear.",
        category: "Antiviral",
    },
};

/**
 * Given raw OCR text extracted from a medicine packet, returns the best matching
 * ingredient knowledge entry, or null if no match is found.
 */
import { BRAND_TO_GENERIC } from "./sync/medicineParser";

/** Calculate similarity of two strings using Sorensen-Dice coefficient */
function getSimilarity(s1: string, s2: string): number {
    s1 = s1.toLowerCase().replace(/[^a-z0-9]/g, "");
    s2 = s2.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;

    const getBigrams = (str: string) => {
        const bigrams = new Set<string>();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.substring(i, i + 2));
        }
        return bigrams;
    };
    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    let intersection = 0;
    for (const val of b1) {
        if (b2.has(val)) intersection++;
    }
    return (2.0 * intersection) / (b1.size + b2.size || 1);
}

/**
 * Given raw OCR text extracted from a medicine packet, returns the best matching
 * ingredient knowledge entry, or null if no match is found. Uses a combination of
 * exact substring matches, brand-to-generic lookup, word-by-word fuzzy matching,
 * and hardcoded OCR typo guards.
 */
export function lookupIngredientFromOcr(ocrText: string): IngredientInfo | null {
    if (!ocrText) return null;
    const norm = normalise(ocrText);

    // 1. First-pass: Exact substring match for ingredients (highest precision)
    let bestExact: IngredientInfo | null = null;
    let bestExactLen = 0;
    for (const [key, info] of Object.entries(KNOWLEDGE_BASE)) {
        const re = new RegExp(`\\b${key}\\b`, "i");
        if (re.test(norm) && key.length > bestExactLen) {
            bestExact = info;
            bestExactLen = key.length;
        }
    }
    if (bestExact) return bestExact;

    // 2. Second-pass: Exact brand name lookup in normalized text
    for (const [brand, generic] of Object.entries(BRAND_TO_GENERIC)) {
        const re = new RegExp(`\\b${brand}\\b`, "i");
        if (re.test(norm)) {
            const resolved = KNOWLEDGE_BASE[generic];
            if (resolved) return resolved;
        }
    }

    // 3. Third-pass: Fuzzy matching word-by-word
    // Split the OCR text into clean alphanumeric words of length >= 3
    const words = norm.split(/\s+/).filter((w) => w.length >= 3);

    let bestFuzzy: IngredientInfo | null = null;
    let bestScore = 0.65; // Threshold is 0.65 (stricter to avoid random matches)

    for (const word of words) {
        if (word.length <= 3) continue; // Skip 3-letter words for fuzzy matching to avoid noise

        // A. Fuzzy match against generic ingredients in KNOWLEDGE_BASE
        for (const [key, info] of Object.entries(KNOWLEDGE_BASE)) {
            const score = getSimilarity(word, key);
            if (score > bestScore) {
                bestScore = score;
                bestFuzzy = info;
            }
        }

        // B. Fuzzy match against brand names in BRAND_TO_GENERIC
        for (const [brand, generic] of Object.entries(BRAND_TO_GENERIC)) {
            const score = getSimilarity(word, brand);
            if (score > bestScore) {
                const resolved = KNOWLEDGE_BASE[generic];
                if (resolved) {
                    bestScore = score;
                    bestFuzzy = resolved;
                }
            }
        }
    }

    if (bestFuzzy) return bestFuzzy;

    // 4. Fourth-pass: If still no match, look for common OCR typos for paracetamol/acetaminophen
    const paracetamolTypos = [
        "jacetomol",
        "lacetomol",
        "acetomol",
        "paracetol",
        "paracetemol",
        "paracetmol",
        "paraceta",
        "acetaminop",
        "acetaminofen",
        "acetominophen",
        "acetamniophen",
    ];
    for (const typo of paracetamolTypos) {
        if (norm.includes(typo)) {
            return KNOWLEDGE_BASE.paracetamol;
        }
    }

    return null;
}

/**
 * Extract the manufacturer / company name from OCR text.
 * Looks for well-known Indian pharmaceutical company names.
 */
export function extractManufacturer(ocrText: string): string | null {
    const MANUFACTURERS = [
        "Abbott",
        "Sun Pharma",
        "Cipla",
        "Lupin",
        "Dr. Reddy",
        "Mankind",
        "Alkem",
        "Torrent",
        "Intas",
        "Cadila",
        "Zydus",
        "Glenmark",
        "Pfizer",
        "GSK",
        "GlaxoSmithKline",
        "Novartis",
        "Sanofi",
        "Bayer",
        "Wockhardt",
        "Emcure",
        "Hetero",
        "Micro Labs",
        "Indoco",
        "Macleods",
        "FDC",
        "Aristo",
        "Eris",
        "Elder",
        "USV",
    ];

    const norm = normalise(ocrText);
    for (const m of MANUFACTURERS) {
        if (norm.includes(normalise(m))) return m;
    }
    return null;
}

/**
 * Extracts dosage information (e.g. "500 mg", "10 mg") from OCR text.
 */
export function extractDosage(ocrText: string): string | null {
    const match = ocrText.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?)/i);
    return match ? `${match[1]} ${match[2].toLowerCase()}` : null;
}
