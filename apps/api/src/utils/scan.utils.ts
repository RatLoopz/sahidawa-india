export function calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + 1
                );
            }
        }
    }
    return matrix[a.length][b.length];
}

export function calculateAdvancedMatchScore(ocrText: string, candidate: string): number {
    const normalizedOcr = ocrText
        .toLowerCase()
        .replace(/amoxycillin/g, "amoxicillin")
        .replace(/clavulanic/g, "clavulanate");
    const normalizedCandidate = candidate
        .toLowerCase()
        .replace(/amoxycillin/g, "amoxicillin")
        .replace(/clavulanic/g, "clavulanate");

    const FILLER_WORDS = new Set([
        "acid",
        "tablets",
        "tablet",
        "capsule",
        "capsules",
        "mg",
        "mcg",
        "g",
        "ml",
        "ip",
        "bp",
        "usp",
        "diluted",
        "anhydrous",
        "trihydrate",
        "potassium",
        "sodium",
        "and",
        "plus",
    ]);

    // Split candidate by standard delimiters
    const candidateParts = normalizedCandidate
        .split(/[\s,+/&.-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !FILLER_WORDS.has(t));

    if (candidateParts.length === 0) return 0;

    let matchedParts = 0;
    for (const part of candidateParts) {
        if (normalizedOcr.includes(part)) {
            matchedParts++;
        }
    }

    const coverage = matchedParts / candidateParts.length;
    if (coverage === 1) {
        return 100;
    } else if (coverage >= 0.5) {
        return Math.round(coverage * 85);
    }

    return 0;
}

export const LOCAL_EXPLANATIONS: Record<
    string,
    { purpose: string; precautions: string; sideEffects: string; usageGuidance: string }
> = {
    paracetamol: {
        purpose:
            "Used to relieve mild to moderate pain (such as headache, toothache, or muscle aches) and reduce fever.",
        precautions:
            "Do not exceed the recommended dose (usually 4g per day for adults). Excessive use can cause severe liver damage. Avoid alcohol while taking this medication.",
        sideEffects:
            "Very rare when taken as directed. Rarely may cause skin rash, nausea, or liver problems at high doses.",
        usageGuidance:
            "Take with or without food. Adults: 1-2 tablets (500mg-1000mg) every 4 to 6 hours as needed. Do not take more than 8 tablets in 24 hours.",
    },
    amoxicillin: {
        purpose:
            "An antibiotic used to treat bacterial infections, such as ear infections, strep throat, pneumonia, and urinary tract infections.",
        precautions:
            "Finish the entire prescribed course even if symptoms disappear. Do not use if you are allergic to penicillin or other beta-lactam antibiotics.",
        sideEffects: "Common side effects include diarrhea, nausea, vomiting, or skin rash.",
        usageGuidance:
            "Usually taken every 8 or 12 hours. Can be taken with or without food, but taking it with food may reduce stomach upset.",
    },
    ibuprofen: {
        purpose:
            "A nonsteroidal anti-inflammatory drug (NSAID) used to reduce fever, pain, inflammation, and stiffness caused by conditions like arthritis or injury.",
        precautions:
            "Can increase the risk of stomach ulcers or bleeding, especially with prolonged use. Avoid taking if you have active stomach ulcers, kidney disease, or heart conditions.",
        sideEffects:
            "Common side effects include stomach pain, heartburn, nausea, dizziness, or headache.",
        usageGuidance:
            "Always take with food or milk to prevent stomach upset. Drink plenty of water.",
    },
    atorvastatin: {
        purpose:
            "A statin medication used to lower 'bad' cholesterol (LDL) and triglycerides in the blood, and to reduce the risk of stroke or heart attack.",
        precautions:
            "Avoid consuming large amounts of grapefruit juice. Contact your doctor immediately if you experience unexplained muscle pain, tenderness, or weakness.",
        sideEffects:
            "Common side effects include headache, muscle pain (myalgia), joint pain, diarrhea, or mild changes in liver function tests.",
        usageGuidance:
            "Take once daily, at the same time each day, with or without food. Typically taken in the evening.",
    },
    pantoprazole: {
        purpose:
            "A proton pump inhibitor (PPI) that decreases the amount of acid produced in the stomach, used to treat GERD, acid reflux, and stomach ulcers.",
        precautions:
            "Long-term use may increase the risk of bone fractures or low magnesium levels. Consult your doctor if symptoms persist after completion of the course.",
        sideEffects: "Common side effects include headache, stomach pain, gas, or nausea.",
        usageGuidance:
            "Take 30 to 60 minutes before breakfast (on an empty stomach) with a full glass of water. Swallow the tablet whole; do not crush or chew.",
    },
    ranitidine: {
        purpose:
            "An H2 blocker that reduces stomach acid production, used to treat and prevent heartburn, acid indigestion, and stomach ulcers.",
        precautions: "Consult a doctor if symptoms persist or if you have kidney disease.",
        sideEffects:
            "Side effects are generally mild and may include headache, dizziness, constipation, or diarrhea.",
        usageGuidance:
            "Can be taken with or without food. Take 30-60 minutes before eating or drinking foods that cause heartburn.",
    },
    cetirizine: {
        purpose:
            "An antihistamine used to relieve allergy symptoms such as sneezing, runny nose, itchy or watery eyes, and hives.",
        precautions:
            "May cause drowsiness. Avoid driving or operating machinery if affected. Avoid alcohol as it can increase drowsiness.",
        sideEffects:
            "Common side effects include drowsiness, dry mouth, tiredness, or sore throat.",
        usageGuidance:
            "Take once daily, with or without food, preferably in the evening if it causes drowsiness.",
    },
    azithromycin: {
        purpose:
            "A macrolide antibiotic used to treat various bacterial infections including respiratory infections, skin infections, and certain sexually transmitted diseases.",
        precautions:
            "Do not take with antacids that contain aluminum or magnesium. Finish the full course of therapy.",
        sideEffects: "Nausea, vomiting, diarrhea, or abdominal pain.",
        usageGuidance:
            "Take once daily as directed. Can be taken with or without food, but food may help reduce stomach upset.",
    },
    metronidazole: {
        purpose:
            "An antibiotic and antiprotozoal medication used to treat various infections of the gastrointestinal tract, skin, and joints.",
        precautions:
            "Strictly avoid alcohol during treatment and for at least 3 days after the last dose to prevent severe nausea and vomiting.",
        sideEffects: "Metallic taste in mouth, nausea, headache, or dark urine.",
        usageGuidance:
            "Take exactly as prescribed, usually 2 to 3 times a day with food or milk to prevent stomach upset.",
    },
    omeprazole: {
        purpose:
            "A proton pump inhibitor used to treat gastroesophageal reflux disease (GERD), stomach ulcers, and other acid-related conditions.",
        precautions:
            "May interact with certain other medications. Tell your doctor if you have liver disease.",
        sideEffects: "Headache, stomach pain, nausea, diarrhea, or gas.",
        usageGuidance:
            "Take once daily before a meal, preferably in the morning. Swallow capsule whole.",
    },
    diclofenac: {
        purpose:
            "A nonsteroidal anti-inflammatory drug (NSAID) used to treat pain, inflammatory disorders, and dysmenorrhea.",
        precautions:
            "May increase risk of fatal heart attack or stroke, especially with long term use. Avoid if you have a history of stomach ulcers.",
        sideEffects: "Indigestion, gas, stomach pain, nausea, vomiting, or dizziness.",
        usageGuidance:
            "Take with food or milk to reduce stomach upset. Do not crush or chew delayed-release tablets.",
    },
    aceclofenac: {
        purpose:
            "An NSAID used for the relief of pain and inflammation in rheumatoid arthritis, osteoarthritis and ankylosing spondylitis.",
        precautions:
            "Not recommended in patients with severe heart failure or active stomach ulcers.",
        sideEffects: "Dyspepsia, abdominal pain, nausea, and diarrhea.",
        usageGuidance: "Take with or after food to prevent stomach upset.",
    },
    nimesulide: {
        purpose: "An NSAID used for pain relief and for the prevention of fever.",
        precautions:
            "Should not be used long-term due to risk of liver toxicity. Not for children under 12.",
        sideEffects: "Nausea, vomiting, diarrhea, or elevated liver enzymes.",
        usageGuidance: "Take with food or milk.",
    },
    etoricoxib: {
        purpose: "A COX-2 inhibitor NSAID used to treat arthritis and gout.",
        precautions: "Use with caution if you have a history of heart disease.",
        sideEffects: "Swelling, dizziness, headache, or stomach pain.",
        usageGuidance: "Take once daily, with or without food.",
    },
    tramadol: {
        purpose: "An opioid pain medication used to treat moderate to moderately severe pain.",
        precautions: "May cause dependency. Do not mix with alcohol or other CNS depressants.",
        sideEffects: "Dizziness, nausea, constipation, or headache.",
        usageGuidance: "Take exactly as prescribed. Do not crush or chew extended-release forms.",
    },
    domperidone: {
        purpose: "An anti-sickness medicine used to stop nausea and vomiting.",
        precautions: "Inform your doctor if you have heart problems.",
        sideEffects: "Dry mouth. Rarely, abnormal heart rhythms.",
        usageGuidance: "Take 15 to 30 minutes before meals.",
    },
    ondansetron: {
        purpose: "Prevents nausea and vomiting caused by surgery or chemotherapy.",
        precautions: "May prolong QT interval (heart rhythm disorder).",
        sideEffects: "Headache, constipation, or fatigue.",
        usageGuidance: "Can be taken with or without food.",
    },
    amlodipine: {
        purpose:
            "A calcium channel blocker used to treat high blood pressure and chest pain (angina).",
        precautions:
            "May cause dizziness, especially when standing up quickly. Tell your doctor if you have liver disease or heart failure.",
        sideEffects: "Swelling of the legs/ankles, dizziness, flushing, or palpitations.",
        usageGuidance:
            "Take once daily, with or without food. Try to take it at the same time each day.",
    },
    losartan: {
        purpose:
            "An ARB used to treat high blood pressure and protect kidneys from damage due to diabetes.",
        precautions: "Do not use if pregnant.",
        sideEffects: "Dizziness, fatigue, or upper respiratory infections.",
        usageGuidance: "Take once daily.",
    },
    olmesartan: {
        purpose: "An ARB used to lower blood pressure.",
        precautions: "Avoid during pregnancy. Can cause severe chronic diarrhea.",
        sideEffects: "Dizziness or headache.",
        usageGuidance: "Take once daily, with or without food.",
    },
    metformin: {
        purpose:
            "An oral antidiabetic medication used to control high blood sugar in people with type 2 diabetes.",
        precautions:
            "Risk of lactic acidosis. Avoid excessive alcohol consumption. Stop taking before certain medical imaging procedures with contrast.",
        sideEffects: "Nausea, diarrhea, stomach upset, or metallic taste in the mouth.",
        usageGuidance:
            "Take with meals to reduce stomach or bowel side effects. Usually taken 1 to 3 times a day.",
    },
    glimepiride: {
        purpose: "An oral diabetes medicine that helps control blood sugar levels.",
        precautions: "Can cause low blood sugar (hypoglycemia). Avoid skipping meals.",
        sideEffects: "Hypoglycemia, dizziness, or weight gain.",
        usageGuidance: "Take once daily, usually with breakfast or the first main meal.",
    },
    gliclazide: {
        purpose: "Used to control blood glucose in patients with type 2 diabetes.",
        precautions: "Risk of hypoglycemia if meals are skipped.",
        sideEffects: "Low blood sugar, stomach upset.",
        usageGuidance: "Take with breakfast.",
    },
    insulin: {
        purpose: "A hormone used to control blood sugar in people with type 1 and type 2 diabetes.",
        precautions: "Monitor blood sugar regularly. Rotate injection sites.",
        sideEffects: "Hypoglycemia, weight gain, or injection site reactions.",
        usageGuidance: "Administer subcutaneously as directed by your doctor.",
    },
    levothyroxine: {
        purpose:
            "A thyroid hormone replacement used to treat an underactive thyroid (hypothyroidism).",
        precautions:
            "Take on an empty stomach. Certain foods, supplements, and other medications can decrease absorption. Do not use for weight loss.",
        sideEffects:
            "Usually related to over-replacement: palpitations, sweating, weight loss, or anxiety.",
        usageGuidance:
            "Take once daily in the morning, on an empty stomach, at least 30 to 60 minutes before breakfast.",
    },
    telmisartan: {
        purpose:
            "An angiotensin receptor blocker (ARB) used to treat high blood pressure and reduce the risk of cardiovascular events.",
        precautions:
            "Do not use during pregnancy. May cause dizziness or hyperkalemia (high potassium).",
        sideEffects: "Dizziness, back pain, sinus pain, or diarrhea.",
        usageGuidance: "Take once daily with or without food.",
    },
    rosuvastatin: {
        purpose:
            "A statin used to lower 'bad' cholesterol and triglycerides, and raise 'good' cholesterol.",
        precautions:
            "Avoid large quantities of grapefruit. Tell your doctor immediately if you have unexplained muscle pain.",
        sideEffects: "Muscle pain, headache, abdominal pain, or weakness.",
        usageGuidance: "Take once daily, at any time of day, with or without food.",
    },
    rabeprazole: {
        purpose:
            "A proton pump inhibitor used to treat GERD and other conditions involving excessive stomach acid.",
        precautions:
            "Long-term use may lead to vitamin B12 deficiency or bone fractures. Discuss with your doctor if symptoms persist.",
        sideEffects: "Headache, nausea, diarrhea, or sore throat.",
        usageGuidance: "Take once daily, usually in the morning before eating.",
    },
    cefixime: {
        purpose: "A cephalosporin antibiotic used to treat a wide variety of bacterial infections.",
        precautions:
            "Do not use if you are allergic to penicillin or cephalosporins. Finish the entire course.",
        sideEffects: "Stomach upset, diarrhea, nausea, or gas.",
        usageGuidance: "Take usually once or twice a day with or without food.",
    },
    cefpodoxime: {
        purpose: "An antibiotic used to treat bacterial infections.",
        precautions: "Finish full course.",
        sideEffects: "Diarrhea, nausea.",
        usageGuidance: "Take with food.",
    },
    ceftriaxone: {
        purpose: "A broad-spectrum antibiotic given by injection.",
        precautions: "Usually administered in a clinical setting.",
        sideEffects: "Injection site pain, diarrhea.",
        usageGuidance: "Administered by a healthcare professional.",
    },
    ciprofloxacin: {
        purpose: "A fluoroquinolone antibiotic used to treat severe infections.",
        precautions: "May cause tendon rupture. Avoid dairy products around the time of dosing.",
        sideEffects: "Nausea, diarrhea, dizziness.",
        usageGuidance: "Take twice daily. Drink plenty of fluids.",
    },
    levofloxacin: {
        purpose: "An antibiotic used for respiratory and urinary tract infections.",
        precautions: "Tendon rupture risk.",
        sideEffects: "Nausea, headache, insomnia.",
        usageGuidance: "Take once daily.",
    },
    ofloxacin: {
        purpose: "An antibiotic used to treat bacterial infections.",
        precautions: "Avoid sun exposure.",
        sideEffects: "Nausea, diarrhea, dizziness.",
        usageGuidance: "Take twice daily.",
    },
    fluconazole: {
        purpose: "An antifungal medicine used to treat yeast infections.",
        precautions: "Interacts with many drugs. Tell your doctor about all medicines you take.",
        sideEffects: "Headache, nausea, stomach pain.",
        usageGuidance: "Usually taken as a single dose for vaginal thrush.",
    },
    albendazole: {
        purpose: "An antiparasitic used to treat infections caused by worms.",
        precautions: "May cause liver issues. Use birth control while taking.",
        sideEffects: "Stomach pain, nausea, vomiting.",
        usageGuidance: "Take with a high-fat meal to increase absorption.",
    },
    levocetirizine: {
        purpose:
            "An antihistamine used to relieve allergy symptoms such as watery eyes, runny nose, and sneezing.",
        precautions: "May cause drowsiness. Use caution when driving or operating machinery.",
        sideEffects: "Drowsiness, tiredness, dry mouth, or fatigue.",
        usageGuidance: "Take once daily in the evening, with or without food.",
    },
    fexofenadine: {
        purpose: "A non-drowsy antihistamine for allergies.",
        precautions:
            "Avoid taking with fruit juices like apple or orange as they reduce absorption.",
        sideEffects: "Headache, back pain.",
        usageGuidance: "Take once daily.",
    },
    montelukast: {
        purpose:
            "Used to prevent asthma attacks and for the long-term treatment of asthma and allergic rhinitis.",
        precautions:
            "Not for sudden asthma attacks. May cause mood or behavior changes in rare cases.",
        sideEffects: "Headache, stomach pain, or sore throat.",
        usageGuidance: "Take once daily, usually in the evening for asthma, with or without food.",
    },
    budesonide: {
        purpose: "A steroid inhaler used to prevent asthma attacks.",
        precautions: "Rinse mouth after use to prevent fungal infections.",
        sideEffects: "Throat irritation, oral thrush.",
        usageGuidance: "Inhale regularly as prescribed.",
    },
    salbutamol: {
        purpose: "A quick-relief inhaler used to treat sudden asthma symptoms.",
        precautions: "May cause rapid heartbeat or tremors.",
        sideEffects: "Tremors, headache, palpitations.",
        usageGuidance: "Use as needed for sudden shortness of breath.",
    },
    aspirin: {
        purpose: "Used as a blood thinner to prevent heart attacks and strokes.",
        precautions: "Can cause stomach bleeding. Avoid if you have active ulcers.",
        sideEffects: "Stomach upset, heartburn.",
        usageGuidance: "Take with food.",
    },
    clopidogrel: {
        purpose: "An antiplatelet medication used to prevent blood clots.",
        precautions: "Increases bleeding risk. Stop taking before surgeries.",
        sideEffects: "Easy bruising, bleeding.",
        usageGuidance: "Take once daily.",
    },
    vitamin_b_complex: {
        purpose:
            "A dietary supplement used to treat or prevent vitamin deficiency due to poor diet or certain illnesses.",
        precautions:
            "Do not exceed the recommended dose. Inform your doctor if you have any pre-existing conditions.",
        sideEffects: "Mild stomach upset, flushing, or yellow-green urine.",
        usageGuidance: "Take once daily, usually with food.",
    },
    calcium: {
        purpose: "Used to prevent or treat low blood calcium levels and to support bone health.",
        precautions: "Tell your doctor if you have a history of kidney stones or kidney disease.",
        sideEffects: "Constipation or upset stomach.",
        usageGuidance: "Take with food to increase absorption. Do not take with high-fiber meals.",
    },
    vitamin_d3: {
        purpose: "Helps your body absorb calcium and phosphorus.",
        precautions: "Too much can cause calcium buildup in the blood.",
        sideEffects: "Rare at normal doses. High doses can cause nausea and vomiting.",
        usageGuidance: "Usually taken weekly or monthly depending on the dose.",
    },
    iron: {
        purpose: "Used to treat or prevent iron-deficiency anemia.",
        precautions: "Can interfere with other medicines. Keep out of reach of children.",
        sideEffects: "Constipation, dark stools, upset stomach.",
        usageGuidance:
            "Best absorbed on an empty stomach, but can take with food if it upsets your stomach.",
    },
    alprazolam: {
        purpose: "A benzodiazepine used to treat anxiety and panic disorders.",
        precautions: "High risk of dependence. Do not stop abruptly.",
        sideEffects: "Drowsiness, dizziness, memory problems.",
        usageGuidance: "Take exactly as prescribed.",
    },
    clonazepam: {
        purpose: "Used to prevent and control seizures, and treat panic attacks.",
        precautions: "May cause severe drowsiness. Do not mix with alcohol.",
        sideEffects: "Sleepiness, poor coordination.",
        usageGuidance: "Take as prescribed.",
    },
    escitalopram: {
        purpose: "An SSRI antidepressant used to treat depression and anxiety.",
        precautions: "May take several weeks to see full effects. Do not stop abruptly.",
        sideEffects: "Nausea, dry mouth, sleep problems, sexual dysfunction.",
        usageGuidance: "Take once daily, in the morning or evening.",
    },
    pregabalin: {
        purpose: "Used to treat nerve pain and seizures.",
        precautions: "May cause dizziness or weight gain.",
        sideEffects: "Dizziness, sleepiness, swelling of hands or feet.",
        usageGuidance: "Take 2 or 3 times a day as prescribed.",
    },
    gabapentin: {
        purpose: "Used to treat nerve pain and prevent seizures.",
        precautions: "Do not stop suddenly.",
        sideEffects: "Dizziness, fatigue, coordination issues.",
        usageGuidance: "Dose is usually gradually increased. Take as prescribed.",
    },
};

export const BRAND_TO_GENERIC_MAP: Record<string, string> = {
    // Paracetamol
    crocin: "paracetamol",
    calpol: "paracetamol",
    dolo: "paracetamol",
    dolo650: "paracetamol",
    pcm: "paracetamol",
    pacimol: "paracetamol",
    fepanil: "paracetamol",
    macfast: "paracetamol",
    // Antibiotics (Penicillins & Macrolides & Cephalosporins)
    augmentin: "amoxicillin",
    mox: "amoxicillin",
    moxikind: "amoxicillin",
    novamox: "amoxicillin",
    clavam: "amoxicillin",
    megamentin: "amoxicillin",
    advent: "amoxicillin",
    azithral: "azithromycin",
    zithrox: "azithromycin",
    azee: "azithromycin",
    zifi: "cefixime",
    "taxim-o": "cefixime",
    taxim: "cefixime",
    omnicef: "cefixime",
    mahacef: "cefixime",
    monocep: "cefpodoxime",
    cepodem: "cefpodoxime",
    gudcef: "cefpodoxime",
    monocef: "ceftriaxone",
    oframax: "ceftriaxone",
    cifran: "ciprofloxacin",
    ciplox: "ciprofloxacin",
    levoflox: "levofloxacin",
    loxof: "levofloxacin",
    zanocin: "ofloxacin",
    oflox: "ofloxacin",
    tarivid: "ofloxacin",
    flagyl: "metronidazole",
    metrogyl: "metronidazole",
    aristogyl: "metronidazole",
    // NSAIDs / Painkillers
    brufen: "ibuprofen",
    combiflam: "ibuprofen",
    flexon: "ibuprofen",
    voveran: "diclofenac",
    volini: "diclofenac",
    dicloran: "diclofenac",
    reactin: "diclofenac",
    nac: "diclofenac",
    zerodol: "aceclofenac",
    hifenac: "aceclofenac",
    aldegesic: "aceclofenac",
    signoflam: "aceclofenac",
    nise: "nimesulide",
    sumo: "nimesulide",
    nimulid: "nimesulide",
    nucoxia: "etoricoxib",
    etoshine: "etoricoxib",
    ultracet: "tramadol",
    tramacip: "tramadol",
    ultram: "tramadol",
    // Antacids / Gastric
    pan: "pantoprazole",
    pantocid: "pantoprazole",
    pan40: "pantoprazole",
    pantodac: "pantoprazole",
    pentids: "pantoprazole",
    rantac: "ranitidine",
    zinetac: "ranitidine",
    aciloc: "ranitidine",
    omez: "omeprazole",
    omee: "omeprazole",
    rabeloc: "rabeprazole",
    rabemac: "rabeprazole",
    rablet: "rabeprazole",
    cyra: "rabeprazole",
    veloz: "rabeprazole",
    happi: "rabeprazole",
    domstal: "domperidone",
    motilium: "domperidone",
    vomistop: "domperidone",
    emeset: "ondansetron",
    zofran: "ondansetron",
    ondem: "ondansetron",
    // Allergy / Asthma
    sinarest: "cetirizine",
    okacet: "cetirizine",
    zyrtec: "cetirizine",
    alerid: "cetirizine",
    cetzine: "cetirizine",
    levocet: "levocetirizine",
    "l-cet": "levocetirizine",
    lcet: "levocetirizine",
    "1-al": "levocetirizine",
    teczine: "levocetirizine",
    vozine: "levocetirizine",
    allegra: "fexofenadine",
    fexofast: "fexofenadine",
    montair: "montelukast",
    telekast: "montelukast",
    romilast: "montelukast",
    budecort: "budesonide",
    asthalin: "salbutamol",
    // Cardiac / Blood Pressure / Cholesterol
    lipitor: "atorvastatin",
    atorva: "atorvastatin",
    tonact: "atorvastatin",
    statin: "atorvastatin",
    rozavel: "rosuvastatin",
    rosyn: "rosuvastatin",
    rosuvas: "rosuvastatin",
    crestor: "rosuvastatin",
    turbovas: "rosuvastatin",
    amlong: "amlodipine",
    stamlo: "amlodipine",
    amlodac: "amlodipine",
    amtas: "amlodipine",
    telma: "telmisartan",
    tazloc: "telmisartan",
    telmikind: "telmisartan",
    eritels: "telmisartan",
    losar: "losartan",
    repace: "losartan",
    olmezest: "olmesartan",
    olmark: "olmesartan",
    ecosprin: "aspirin",
    clopilet: "clopidogrel",
    plavix: "clopidogrel",
    deplat: "clopidogrel",
    // Diabetes
    glycomet: "metformin",
    glyciphage: "metformin",
    cetapin: "metformin",
    amaryl: "glimepiride",
    zoryl: "glimepiride",
    azulix: "glimepiride",
    diamicron: "gliclazide",
    reclide: "gliclazide",
    mixtard: "insulin",
    lantus: "insulin",
    novomix: "insulin",
    // Thyroid
    thyronorm: "levothyroxine",
    eltroxin: "levothyroxine",
    // Supplements / Vitamins
    becosules: "vitamin_b_complex",
    neurobion: "vitamin_b_complex",
    nurokind: "vitamin_b_complex",
    supradyn: "vitamin_b_complex",
    zincovit: "vitamin_b_complex",
    shelcal: "calcium",
    gemcal: "calcium",
    calcimax: "calcium",
    calcirol: "vitamin_d3",
    uprise: "vitamin_d3",
    d3: "vitamin_d3",
    dexorange: "iron",
    folvite: "iron",
    autrin: "iron",
    orofer: "iron",
    // Antifungal / Antiparasitic
    zocon: "fluconazole",
    forcan: "fluconazole",
    syscan: "fluconazole",
    zentel: "albendazole",
    bandy: "albendazole",
    // CNS / Neuro
    alprax: "alprazolam",
    restyl: "alprazolam",
    clonotril: "clonazepam",
    lonazep: "clonazepam",
    nexito: "escitalopram",
    lexapro: "escitalopram",
    pregabid: "pregabalin",
    lyrica: "pregabalin",
    neurontin: "gabapentin",
};
