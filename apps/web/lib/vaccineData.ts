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
};

export type VaccineKey = keyof typeof vaccineDatabase;
