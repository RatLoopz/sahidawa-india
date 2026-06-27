export type TargetGroupType =
    | "Newborn"
    | "Infant"
    | "Child"
    | "Adolescent"
    | "Adult"
    | "Pregnant Women";
export type VaccineCategoryType = "Viral" | "Bacterial" | "Combination";

export interface VaccineProfile {
    id: string;

    // Core info
    disease_name: string;
    disease_summary: string;
    vaccine_name: string;
    category: VaccineCategoryType;

    // Audience (Now accepts multiple audiences)
    target_groups: TargetGroupType[];

    // Schedule tracking
    is_relative_to_birth: boolean; // true = relative to age, false = relative to 1st dose
    dosing_intervals_weeks: number[];

    // Dose + effectiveness
    total_doses: number;
    effectiveness: string;

    // Safety info
    side_effects: {
        common: string[];
        severe: string[];
    };

    // Care guidance
    aftercare_text: string;

    // UI labels
    schedule_label: string;
}

// Global educational disclaimer (keeps data DRY)
export const VACCINE_GLOBAL_DISCLAIMER =
    "This tool is for educational purposes only and should not replace professional medical advice. Always consult a healthcare provider.";

export const vaccineDatabase: Record<string, VaccineProfile> = {
    polio: {
        id: "polio",
        disease_name: "Poliomyelitis (Polio)",
        disease_summary:
            "Polio is a viral infectious disease that can cause paralysis by attacking the nervous system, especially in children.",
        vaccine_name: "OPV (Oral Polio Vaccine) & IPV (Injectable Polio Vaccine)",
        category: "Viral",
        target_groups: ["Newborn", "Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [0, 6, 10, 14],
        total_doses: 4,
        effectiveness: "99%",
        side_effects: {
            common: ["Mild fever", "Temporary irritability", "Mild crying"],
            severe: ["High fever (>102°F)", "Severe allergic reaction", "Difficulty breathing"],
        },
        aftercare_text:
            "Ensure the child rests well. If injectable IPV is given, apply a cool damp cloth to reduce mild swelling.",
        schedule_label: "At birth, 6 weeks, 10 weeks, 14 weeks",
    },

    measles: {
        id: "measles",
        disease_name: "Measles, Mumps & Rubella (MMR)",
        disease_summary:
            "MMR protects against three highly contagious viral infections that can cause fever, rash, and serious complications.",
        vaccine_name: "MMR / MR Vaccine",
        category: "Viral",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [39, 65], // ~9 months & ~15 months
        total_doses: 2,
        effectiveness: "97%",
        side_effects: {
            common: ["Mild fever (7–12 days after vaccination)", "Light rash", "Fatigue"],
            severe: ["Seizures due to high fever", "Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Keep the child hydrated. Use lukewarm sponge baths for fever. Do not give aspirin.",
        schedule_label: "9 months and 15 months",
    },

    hpv: {
        id: "hpv",
        disease_name: "Human Papillomavirus (HPV)",
        disease_summary:
            "HPV is a common viral infection that can lead to cervical cancer and other cancers.",
        vaccine_name: "Cervavac (India) / Gardasil",
        category: "Viral",
        target_groups: ["Adolescent"],
        is_relative_to_birth: false, // Timed from first dose
        dosing_intervals_weeks: [0, 26], // 2nd dose 6 months later
        total_doses: 2,
        effectiveness: "92%",
        side_effects: {
            common: ["Pain at injection site", "Headache", "Mild dizziness"],
            severe: ["Severe allergic reaction", "High fever", "Fainting (rare)"],
        },
        aftercare_text:
            "Rest for 15 minutes after injection. Avoid heavy arm movement for 24 hours.",
        schedule_label: "0 and 6 months",
    },

    corona: {
        id: "corona",
        disease_name: "COVID-19",
        disease_summary:
            "COVID-19 is a respiratory viral disease caused by SARS-CoV-2, which can range from mild to severe illness.",
        vaccine_name: "Covishield / Covaxin / iNCOVACC",
        category: "Viral",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0, 12],
        total_doses: 2,
        effectiveness: "85% - 90%",
        side_effects: {
            common: ["Fever", "Body aches", "Fatigue", "Arm soreness"],
            severe: ["Breathing difficulty", "Chest pain", "Severe allergic reaction"],
        },
        aftercare_text:
            "Rest well for 24–48 hours. Stay hydrated and consult a doctor if symptoms worsen.",
        schedule_label: "0 and 12 weeks",
    },

    bcg: {
        id: "bcg",
        disease_name: "Tuberculosis (TB)",
        disease_summary:
            "TB is a bacterial infection that mainly affects the lungs and can be severe in infants.",
        vaccine_name: "BCG Vaccine",
        category: "Bacterial",
        target_groups: ["Newborn"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "80% (prevents severe childhood TB)",
        side_effects: {
            common: ["Small scar formation", "Mild swelling at injection site"],
            severe: ["Large ulcer at injection site", "Swollen lymph nodes (rare)"],
        },
        aftercare_text:
            "Do not apply ointments or cover the site. The small scar formation is normal.",
        schedule_label: "At birth",
    },

    tetanus_maternal: {
        id: "tetanus_maternal",
        disease_name: "Maternal & Neonatal Tetanus",
        disease_summary:
            "Tetanus is a bacterial infection that can cause severe muscle stiffness and is dangerous for newborns.",
        vaccine_name: "Td (Tetanus & Diphtheria)",
        category: "Bacterial",
        target_groups: ["Pregnant Women"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0, 4],
        total_doses: 2,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling", "Fatigue"],
            severe: ["Severe allergic reaction", "Neurological reaction (very rare)"],
        },
        aftercare_text:
            "Move the arm gently after vaccination. A cold compress can reduce soreness.",
        schedule_label: "Early pregnancy and 4 weeks later",
    },
    // ============ NEWBORN & INFANT ============
    hepatitis_b: {
        id: "hepatitis_b",
        disease_name: "Hepatitis B",
        disease_summary:
            "Hepatitis B is a viral liver infection that can become chronic if acquired at birth, leading to long-term liver damage.",
        vaccine_name: "Hepatitis B Vaccine",
        category: "Viral",
        target_groups: ["Newborn", "Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [0, 6, 10, 14],
        total_doses: 4,
        effectiveness: "98%",
        side_effects: {
            common: ["Mild fever", "Soreness at injection site", "Fatigue"],
            severe: ["Severe allergic reaction (anaphylaxis)", "High fever"],
        },
        aftercare_text:
            "Monitor for fever in the first 24 hours. A cool compress can ease soreness at the injection site.",
        schedule_label: "At birth, 6 weeks, 10 weeks, 14 weeks",
    },

    pentavalent: {
        id: "pentavalent",
        disease_name: "Diphtheria, Pertussis, Tetanus, Hepatitis B & Hib",
        disease_summary:
            "The Pentavalent vaccine protects against five serious childhood diseases in a single combination shot.",
        vaccine_name: "Pentavalent Vaccine (DPT-HepB-Hib)",
        category: "Combination",
        target_groups: ["Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [6, 10, 14],
        total_doses: 3,
        effectiveness: "95%",
        side_effects: {
            common: ["Fever", "Swelling at injection site", "Irritability"],
            severe: ["High fever (>104┬░F)", "Persistent crying", "Seizures (rare)"],
        },
        aftercare_text:
            "Give plenty of fluids. A lukewarm sponge bath helps with fever. Watch the injection site for excessive swelling.",
        schedule_label: "6 weeks, 10 weeks, 14 weeks",
    },

    rotavirus: {
        id: "rotavirus",
        disease_name: "Rotavirus Diarrhea",
        disease_summary:
            "Rotavirus is a leading cause of severe diarrhea and dehydration in infants and young children.",
        vaccine_name: "Rotavirus Vaccine (Oral)",
        category: "Viral",
        target_groups: ["Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [6, 10, 14],
        total_doses: 3,
        effectiveness: "85% - 90%",
        side_effects: {
            common: ["Mild diarrhea", "Mild irritability", "Low-grade fever"],
            severe: ["Intussusception (very rare)", "Severe vomiting"],
        },
        aftercare_text:
            "This is an oral vaccine — no injection site care needed. Watch for unusual vomiting in the days after dosing.",
        schedule_label: "6 weeks, 10 weeks, 14 weeks",
    },

    fipv: {
        id: "fipv",
        disease_name: "Poliomyelitis (Polio) — Injectable Booster",
        disease_summary:
            "Fractional IPV provides an additional layer of polio protection alongside oral polio doses.",
        vaccine_name: "Fractional IPV (fIPV)",
        category: "Viral",
        target_groups: ["Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [6, 14],
        total_doses: 2,
        effectiveness: "99%",
        side_effects: {
            common: ["Mild swelling at injection site", "Low-grade fever"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text: "Apply a cool damp cloth to reduce mild swelling at the injection site.",
        schedule_label: "6 weeks and 14 weeks",
    },

    pcv: {
        id: "pcv",
        disease_name: "Pneumococcal Disease",
        disease_summary:
            "PCV protects against pneumococcal bacteria that can cause pneumonia, meningitis, and ear infections in young children.",
        vaccine_name: "Pneumococcal Conjugate Vaccine (PCV)",
        category: "Bacterial",
        target_groups: ["Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [6, 14, 39],
        total_doses: 3,
        effectiveness: "90%",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever", "Reduced appetite"],
            severe: ["High fever", "Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Monitor temperature for 48 hours. A cold compress helps reduce soreness at the site.",
        schedule_label: "6 weeks, 14 weeks, 9 months",
    },

    je: {
        id: "je",
        disease_name: "Japanese Encephalitis",
        disease_summary:
            "Japanese Encephalitis is a mosquito-borne viral infection affecting the brain, endemic to certain regions of India.",
        vaccine_name: "Japanese Encephalitis (JE) Vaccine",
        category: "Viral",
        target_groups: ["Infant"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [39, 65],
        total_doses: 2,
        effectiveness: "90%",
        side_effects: {
            common: ["Mild fever", "Soreness at injection site"],
            severe: ["Severe allergic reaction (rare)", "Neurological reaction (very rare)"],
        },
        aftercare_text:
            "Recommended primarily in JE-endemic regions. Monitor for fever and consult a doctor if symptoms persist beyond 48 hours.",
        schedule_label: "9 months and 16 months (endemic regions)",
    },

    // ============ CHILDREN (1-10 YEARS) ============
    dpt_booster: {
        id: "dpt_booster",
        disease_name: "Diphtheria, Pertussis & Tetanus — Booster",
        disease_summary:
            "Booster doses reinforce immunity against diphtheria, pertussis, and tetanus as early childhood protection wanes.",
        vaccine_name: "DPT Booster",
        category: "Bacterial",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [78, 260], // ~18 months & 5 years
        total_doses: 2,
        effectiveness: "95%",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever", "Fatigue"],
            severe: ["High fever", "Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Encourage rest and fluids. A cold compress eases soreness at the injection site.",
        schedule_label: "18 months and 5 years",
    },

    opv_booster: {
        id: "opv_booster",
        disease_name: "Poliomyelitis (Polio) — Booster",
        disease_summary:
            "An additional OPV dose strengthens long-term immunity against polio in early childhood.",
        vaccine_name: "OPV Booster",
        category: "Viral",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [78],
        total_doses: 1,
        effectiveness: "99%",
        side_effects: {
            common: ["Mild fever", "Mild irritability"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Oral dose — no injection site care needed. Monitor for fever in the first 24 hours.",
        schedule_label: "18 months",
    },

    mr_second_dose: {
        id: "mr_second_dose",
        disease_name: "Measles & Rubella — Second Dose",
        disease_summary:
            "The second MR dose ensures stronger, longer-lasting immunity against measles and rubella.",
        vaccine_name: "MR Second Dose",
        category: "Viral",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [78],
        total_doses: 1,
        effectiveness: "97%",
        side_effects: {
            common: ["Mild fever", "Light rash", "Fatigue"],
            severe: ["Seizures due to high fever (rare)", "Severe allergic reaction"],
        },
        aftercare_text:
            "Keep the child hydrated. Use lukewarm sponge baths for fever. Do not give aspirin.",
        schedule_label: "18 months",
    },

    vitamin_a: {
        id: "vitamin_a",
        disease_name: "Vitamin A Deficiency",
        disease_summary:
            "Vitamin A supplementation reduces childhood mortality and protects against vision problems and infections.",
        vaccine_name: "Vitamin A Supplementation",
        category: "Combination",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [39, 65, 91, 117, 143, 169, 195, 221, 247],
        total_doses: 9,
        effectiveness: "Reduces childhood mortality risk significantly",
        side_effects: {
            common: ["Mild nausea", "Headache (rare)"],
            severe: ["Vomiting (rare)", "Bulging fontanelle in infants (very rare)"],
        },
        aftercare_text:
            "Given as an oral dose every 6 months from 9 months to 5 years. No special aftercare required.",
        schedule_label: "Every 6 months, 9 months to 5 years",
    },

    typhoid: {
        id: "typhoid",
        disease_name: "Typhoid Fever",
        disease_summary:
            "Typhoid is a bacterial infection spread through contaminated food and water, common in endemic regions.",
        vaccine_name: "Typhoid Conjugate Vaccine",
        category: "Bacterial",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [39],
        total_doses: 1,
        effectiveness: "85%",
        side_effects: {
            common: ["Mild fever", "Soreness at injection site"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended, not yet part of the mandatory UIP schedule. Monitor for fever for 24-48 hours.",
        schedule_label: "9 months onwards (recommended)",
    },

    hepatitis_a: {
        id: "hepatitis_a",
        disease_name: "Hepatitis A",
        disease_summary:
            "Hepatitis A is a liver infection spread through contaminated food and water, common in children.",
        vaccine_name: "Hepatitis A Vaccine",
        category: "Viral",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [65, 117],
        total_doses: 2,
        effectiveness: "95%",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever", "Headache"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended, not yet part of the mandatory UIP schedule. A cold compress helps with soreness.",
        schedule_label: "15 months and 24 months (recommended)",
    },

    varicella: {
        id: "varicella",
        disease_name: "Varicella (Chickenpox)",
        disease_summary:
            "Varicella vaccine protects against chickenpox, a highly contagious viral infection common in childhood.",
        vaccine_name: "Varicella Vaccine",
        category: "Viral",
        target_groups: ["Child"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [65, 234],
        total_doses: 2,
        effectiveness: "90%",
        side_effects: {
            common: ["Mild rash", "Soreness at injection site", "Low-grade fever"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended, not yet part of the mandatory UIP schedule. Avoid scratching any mild rash that develops.",
        schedule_label: "15 months and 4-6 years (recommended)",
    },

    // ============ ADOLESCENTS ============
    td_adolescent: {
        id: "td_adolescent",
        disease_name: "Tetanus & Diphtheria",
        disease_summary:
            "The Td booster maintains immunity against tetanus and diphtheria into adolescence.",
        vaccine_name: "Td (Tetanus & Diphtheria)",
        category: "Bacterial",
        target_groups: ["Adolescent"],
        is_relative_to_birth: true,
        dosing_intervals_weeks: [521, 833], // 10 years & 16 years
        total_doses: 2,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling", "Fatigue"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Move the arm gently after vaccination. A cold compress can reduce soreness.",
        schedule_label: "10 years and 16 years",
    },

    mr_catchup: {
        id: "mr_catchup",
        disease_name: "Measles & Rubella — Catch-up",
        disease_summary:
            "Catch-up MR vaccination ensures adolescents who missed earlier doses are still protected.",
        vaccine_name: "Catch-up MR Vaccination",
        category: "Viral",
        target_groups: ["Adolescent"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "97%",
        side_effects: {
            common: ["Mild fever", "Light rash"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended only where earlier MR doses were missed. Consult a healthcare provider to confirm eligibility.",
        schedule_label: "As needed, where applicable",
    },

    // ============ ADULTS ============
    td_adult_booster: {
        id: "td_adult_booster",
        disease_name: "Tetanus & Diphtheria — Adult Booster",
        disease_summary:
            "Periodic Td boosters maintain long-term immunity against tetanus and diphtheria in adults.",
        vaccine_name: "Td Booster",
        category: "Bacterial",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling", "Fatigue"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended every 10 years. Move the arm gently after vaccination to ease soreness.",
        schedule_label: "Every 10 years",
    },

    influenza: {
        id: "influenza",
        disease_name: "Influenza (Flu)",
        disease_summary:
            "Annual flu vaccination reduces the risk of seasonal influenza and its complications.",
        vaccine_name: "Influenza Vaccine",
        category: "Viral",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "40% - 60% (varies by season)",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever", "Fatigue"],
            severe: ["Severe allergic reaction (rare)", "Guillain-Barr├⌐ syndrome (very rare)"],
        },
        aftercare_text:
            "Recommended annually, especially for high-risk groups. Rest and stay hydrated after vaccination.",
        schedule_label: "Annually",
    },

    hepatitis_b_highrisk: {
        id: "hepatitis_b_highrisk",
        disease_name: "Hepatitis B (High-Risk Adults)",
        disease_summary:
            "Adults in high-risk groups without prior immunity should receive the Hepatitis B series.",
        vaccine_name: "Hepatitis B Vaccine (High-Risk Groups)",
        category: "Viral",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0, 4, 24],
        total_doses: 3,
        effectiveness: "98%",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended for healthcare workers and other high-risk groups. Monitor for fever in the first 24 hours.",
        schedule_label: "0, 1 month, and 6 months",
    },

    pneumococcal_adult: {
        id: "pneumococcal_adult",
        disease_name: "Pneumococcal Disease (Elderly/High-Risk)",
        disease_summary:
            "Pneumococcal vaccination protects older adults and high-risk individuals from pneumonia and related illness.",
        vaccine_name: "Pneumococcal Vaccine",
        category: "Bacterial",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "85%",
        side_effects: {
            common: ["Soreness at injection site", "Mild fever", "Fatigue"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended for adults 65+ or with chronic conditions. A cold compress eases soreness at the site.",
        schedule_label: "Once, with possible booster depending on risk",
    },

    shingles: {
        id: "shingles",
        disease_name: "Shingles (Herpes Zoster)",
        disease_summary:
            "Shingles vaccination reduces the risk of painful nerve-related rash common in older adults.",
        vaccine_name: "Shingles Vaccine",
        category: "Viral",
        target_groups: ["Adult"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0, 8],
        total_doses: 2,
        effectiveness: "90%",
        side_effects: {
            common: ["Soreness at injection site", "Fatigue", "Headache"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended for adults 50 and older. Rest and stay hydrated after each dose.",
        schedule_label: "2 doses, 2-6 months apart",
    },

    // ============ PREGNANCY ============
    td1_pregnancy: {
        id: "td1_pregnancy",
        disease_name: "Maternal & Neonatal Tetanus — Dose 1",
        disease_summary:
            "The first Td dose during pregnancy protects both mother and newborn from tetanus.",
        vaccine_name: "Td-1",
        category: "Bacterial",
        target_groups: ["Pregnant Women"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Given as early as possible in pregnancy. Move the arm gently to ease soreness.",
        schedule_label: "Early pregnancy",
    },

    td2_pregnancy: {
        id: "td2_pregnancy",
        disease_name: "Maternal & Neonatal Tetanus — Dose 2",
        disease_summary:
            "The second Td dose strengthens protection against tetanus for both mother and newborn.",
        vaccine_name: "Td-2",
        category: "Bacterial",
        target_groups: ["Pregnant Women"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [4],
        total_doses: 1,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling", "Fatigue"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text: "Given 4 weeks after Td-1. A cold compress can reduce soreness.",
        schedule_label: "4 weeks after Td-1",
    },

    td_booster_pregnancy: {
        id: "td_booster_pregnancy",
        disease_name: "Maternal & Neonatal Tetanus — Booster",
        disease_summary:
            "A booster dose for women previously vaccinated, ensuring continued protection during pregnancy.",
        vaccine_name: "Td Booster (Previously Vaccinated)",
        category: "Bacterial",
        target_groups: ["Pregnant Women"],
        is_relative_to_birth: false,
        dosing_intervals_weeks: [0],
        total_doses: 1,
        effectiveness: "95%",
        side_effects: {
            common: ["Arm pain", "Mild swelling"],
            severe: ["Severe allergic reaction (rare)"],
        },
        aftercare_text:
            "Recommended only if previous Td doses were already received. Consult a healthcare provider to confirm timing.",
        schedule_label: "As advised, for previously vaccinated women",
    },
};

export type VaccineKey = keyof typeof vaccineDatabase;
