export type VaccinationStatus = "completed" | "due" | "overdue" | "upcoming";
export type DateOfBirthValidationReason = "missing" | "invalid" | "future";

export type DateOfBirthValidationResult =
    | { isValid: true }
    | { isValid: false; reason: DateOfBirthValidationReason };

export interface ScheduleOffset {
    days?: number;
    weeks?: number;
    months?: number;
    years?: number;
}

export interface NationalImmunizationScheduleItem {
    id: string;
    vaccineName: string;
    doseLabel: string;
    protectsAgainst: string;
    timingLabel: string;
    dueOffset: ScheduleOffset;
    dueWindowEndOffset?: ScheduleOffset;
    stage: "Birth" | "Infant" | "Child" | "Adolescent";
    notes?: string;
    isAreaSpecific?: boolean;
}

export interface ChildVaccinationScheduleItem extends NationalImmunizationScheduleItem {
    dueDate: string;
    dueWindowEndDate?: string;
    status: VaccinationStatus;
}

interface DateParts {
    year: number;
    month: number;
    day: number;
}

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const NATIONAL_IMMUNIZATION_SOURCE =
    "India National Immunization Schedule for Infants, Children and Pregnant Women, Ministry of Health and Family Welfare.";

export const NATIONAL_IMMUNIZATION_SCHEDULE: NationalImmunizationScheduleItem[] = [
    {
        id: "bcg",
        vaccineName: "BCG",
        doseLabel: "Single dose",
        protectsAgainst: "Severe childhood tuberculosis",
        timingLabel: "At birth",
        dueOffset: { days: 0 },
        dueWindowEndOffset: { months: 12 },
        stage: "Birth",
        notes: "Give as early as possible, up to one year of age if not given earlier.",
    },
    {
        id: "hepb-birth",
        vaccineName: "Hepatitis B Birth Dose",
        doseLabel: "Birth dose",
        protectsAgainst: "Hepatitis B",
        timingLabel: "At birth, within 24 hours",
        dueOffset: { days: 0 },
        dueWindowEndOffset: { days: 1 },
        stage: "Birth",
    },
    {
        id: "opv-0",
        vaccineName: "OPV-0",
        doseLabel: "Birth dose",
        protectsAgainst: "Polio",
        timingLabel: "At birth, within first 15 days",
        dueOffset: { days: 0 },
        dueWindowEndOffset: { days: 15 },
        stage: "Birth",
    },
    {
        id: "opv-1",
        vaccineName: "OPV-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Polio",
        timingLabel: "At 6 weeks",
        dueOffset: { weeks: 6 },
        stage: "Infant",
        notes: "OPV can be given up to five years of age if missed.",
    },
    {
        id: "pentavalent-1",
        vaccineName: "Pentavalent-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
        timingLabel: "At 6 weeks",
        dueOffset: { weeks: 6 },
        stage: "Infant",
    },
    {
        id: "fipv-1",
        vaccineName: "fIPV-1",
        doseLabel: "Fractional dose 1",
        protectsAgainst: "Polio",
        timingLabel: "At 6 weeks",
        dueOffset: { weeks: 6 },
        stage: "Infant",
    },
    {
        id: "rotavirus-1",
        vaccineName: "Rotavirus-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Rotavirus diarrhoea",
        timingLabel: "At 6 weeks",
        dueOffset: { weeks: 6 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Introduced in phases under UIP.",
    },
    {
        id: "pcv-1",
        vaccineName: "PCV-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Pneumococcal disease",
        timingLabel: "At 6 weeks",
        dueOffset: { weeks: 6 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Phased introduction, presently in select states or districts.",
    },
    {
        id: "opv-2",
        vaccineName: "OPV-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Polio",
        timingLabel: "At 10 weeks",
        dueOffset: { weeks: 10 },
        stage: "Infant",
        notes: "OPV can be given up to five years of age if missed.",
    },
    {
        id: "pentavalent-2",
        vaccineName: "Pentavalent-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
        timingLabel: "At 10 weeks",
        dueOffset: { weeks: 10 },
        stage: "Infant",
    },
    {
        id: "rotavirus-2",
        vaccineName: "Rotavirus-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Rotavirus diarrhoea",
        timingLabel: "At 10 weeks",
        dueOffset: { weeks: 10 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Introduced in phases under UIP.",
    },
    {
        id: "opv-3",
        vaccineName: "OPV-3",
        doseLabel: "Dose 3",
        protectsAgainst: "Polio",
        timingLabel: "At 14 weeks",
        dueOffset: { weeks: 14 },
        stage: "Infant",
        notes: "OPV can be given up to five years of age if missed.",
    },
    {
        id: "pentavalent-3",
        vaccineName: "Pentavalent-3",
        doseLabel: "Dose 3",
        protectsAgainst: "Diphtheria, pertussis, tetanus, hepatitis B and Hib",
        timingLabel: "At 14 weeks",
        dueOffset: { weeks: 14 },
        stage: "Infant",
    },
    {
        id: "fipv-2",
        vaccineName: "fIPV-2",
        doseLabel: "Fractional dose 2",
        protectsAgainst: "Polio",
        timingLabel: "At 14 weeks",
        dueOffset: { weeks: 14 },
        stage: "Infant",
    },
    {
        id: "rotavirus-3",
        vaccineName: "Rotavirus-3",
        doseLabel: "Dose 3",
        protectsAgainst: "Rotavirus diarrhoea",
        timingLabel: "At 14 weeks",
        dueOffset: { weeks: 14 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Introduced in phases under UIP.",
    },
    {
        id: "pcv-2",
        vaccineName: "PCV-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Pneumococcal disease",
        timingLabel: "At 14 weeks",
        dueOffset: { weeks: 14 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Phased introduction, presently in select states or districts.",
    },
    {
        id: "mr-1",
        vaccineName: "MR-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Measles and rubella",
        timingLabel: "At 9 completed months to 12 months",
        dueOffset: { months: 9 },
        dueWindowEndOffset: { months: 12 },
        stage: "Infant",
    },
    {
        id: "fipv-3",
        vaccineName: "fIPV-3",
        doseLabel: "Fractional dose 3",
        protectsAgainst: "Polio",
        timingLabel: "At 9 completed months with MR-1",
        dueOffset: { months: 9 },
        dueWindowEndOffset: { months: 12 },
        stage: "Infant",
        notes: "Third fractional IPV dose introduced under UIP from January 2023.",
    },
    {
        id: "pcv-booster",
        vaccineName: "PCV Booster",
        doseLabel: "Booster",
        protectsAgainst: "Pneumococcal disease",
        timingLabel: "At 9 to 12 months",
        dueOffset: { months: 9 },
        dueWindowEndOffset: { months: 12 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Phased introduction, presently in select states or districts.",
    },
    {
        id: "je-1",
        vaccineName: "JE-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Japanese encephalitis",
        timingLabel: "At 9 completed months to 12 months",
        dueOffset: { months: 9 },
        dueWindowEndOffset: { months: 12 },
        stage: "Infant",
        isAreaSpecific: true,
        notes: "Applicable in JE endemic districts.",
    },
    {
        id: "vitamin-a-1",
        vaccineName: "Vitamin A-1",
        doseLabel: "Dose 1",
        protectsAgainst: "Vitamin A deficiency complications",
        timingLabel: "At 9 completed months with MR-1",
        dueOffset: { months: 9 },
        stage: "Infant",
    },
    {
        id: "dpt-booster-1",
        vaccineName: "DPT Booster-1",
        doseLabel: "Booster 1",
        protectsAgainst: "Diphtheria, pertussis and tetanus",
        timingLabel: "At 16 to 24 months",
        dueOffset: { months: 16 },
        dueWindowEndOffset: { months: 24 },
        stage: "Child",
    },
    {
        id: "mr-2",
        vaccineName: "MR-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Measles and rubella",
        timingLabel: "At 16 to 24 months",
        dueOffset: { months: 16 },
        dueWindowEndOffset: { months: 24 },
        stage: "Child",
    },
    {
        id: "opv-booster",
        vaccineName: "OPV Booster",
        doseLabel: "Booster",
        protectsAgainst: "Polio",
        timingLabel: "At 16 to 24 months",
        dueOffset: { months: 16 },
        dueWindowEndOffset: { months: 24 },
        stage: "Child",
    },
    {
        id: "je-2",
        vaccineName: "JE-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Japanese encephalitis",
        timingLabel: "At 16 to 24 months",
        dueOffset: { months: 16 },
        dueWindowEndOffset: { months: 24 },
        stage: "Child",
        isAreaSpecific: true,
        notes: "Applicable in JE endemic districts.",
    },
    {
        id: "vitamin-a-2",
        vaccineName: "Vitamin A-2",
        doseLabel: "Dose 2",
        protectsAgainst: "Vitamin A deficiency complications",
        timingLabel: "At 16 months",
        dueOffset: { months: 16 },
        stage: "Child",
    },
    ...Array.from({ length: 7 }, (_, index) => {
        const doseNumber = index + 3;
        const months = 16 + (index + 1) * 6;

        return {
            id: `vitamin-a-${doseNumber}`,
            vaccineName: `Vitamin A-${doseNumber}`,
            doseLabel: `Dose ${doseNumber}`,
            protectsAgainst: "Vitamin A deficiency complications",
            timingLabel: `At ${months} months`,
            dueOffset: { months },
            stage: "Child" as const,
            notes: "Given every six months up to five years of age.",
        };
    }),
    {
        id: "dpt-booster-2",
        vaccineName: "DPT Booster-2",
        doseLabel: "Booster 2",
        protectsAgainst: "Diphtheria, pertussis and tetanus",
        timingLabel: "At 5 to 6 years",
        dueOffset: { years: 5 },
        dueWindowEndOffset: { years: 6 },
        stage: "Child",
    },
    {
        id: "td-10",
        vaccineName: "Td",
        doseLabel: "10 year dose",
        protectsAgainst: "Tetanus and diphtheria",
        timingLabel: "At 10 years",
        dueOffset: { years: 10 },
        stage: "Adolescent",
    },
    {
        id: "td-16",
        vaccineName: "Td",
        doseLabel: "16 year dose",
        protectsAgainst: "Tetanus and diphtheria",
        timingLabel: "At 16 years",
        dueOffset: { years: 16 },
        stage: "Adolescent",
    },
];

export function getTodayDateInput(): string {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
    ].join("-");
}

export function validateChildDateOfBirth(
    dateOfBirth: string,
    todayDateInput = getTodayDateInput()
): DateOfBirthValidationResult {
    if (!dateOfBirth.trim()) {
        return { isValid: false, reason: "missing" };
    }

    if (!parseDateInput(dateOfBirth)) {
        return { isValid: false, reason: "invalid" };
    }

    if (dateOfBirth > todayDateInput) {
        return { isValid: false, reason: "future" };
    }

    return { isValid: true };
}

export function generateChildVaccinationSchedule(
    dateOfBirth: string,
    todayDateInput = getTodayDateInput(),
    completedDoseIds: Iterable<string> = []
): ChildVaccinationScheduleItem[] {
    if (!validateChildDateOfBirth(dateOfBirth, todayDateInput).isValid) {
        return [];
    }

    const completed = new Set(completedDoseIds);

    return NATIONAL_IMMUNIZATION_SCHEDULE.map((scheduleItem) => {
        const dueDate = addOffsetToDateInput(dateOfBirth, scheduleItem.dueOffset);
        const dueWindowEndDate = scheduleItem.dueWindowEndOffset
            ? addOffsetToDateInput(dateOfBirth, scheduleItem.dueWindowEndOffset)
            : undefined;

        return {
            ...scheduleItem,
            dueDate,
            dueWindowEndDate,
            status: getScheduleStatus(dueDate, todayDateInput, completed.has(scheduleItem.id), {
                dueWindowEndDate,
            }),
        };
    });
}

function getScheduleStatus(
    dueDate: string,
    todayDateInput: string,
    isCompleted: boolean,
    options: { dueWindowEndDate?: string }
): VaccinationStatus {
    if (isCompleted) return "completed";
    if (todayDateInput < dueDate) return "upcoming";
    if (todayDateInput <= (options.dueWindowEndDate ?? dueDate)) return "due";

    return "overdue";
}

function addOffsetToDateInput(dateInput: string, offset: ScheduleOffset): string {
    const parsed = parseDateInput(dateInput);

    if (!parsed) {
        throw new Error(`Invalid date input: ${dateInput}`);
    }

    let date = dateFromParts(parsed);
    const monthOffset = (offset.months ?? 0) + (offset.years ?? 0) * 12;

    if (monthOffset !== 0) {
        date = addMonthsClamped(date, monthOffset);
    }

    const dayOffset = (offset.days ?? 0) + (offset.weeks ?? 0) * 7;

    if (dayOffset !== 0) {
        date = new Date(date.getTime());
        date.setUTCDate(date.getUTCDate() + dayOffset);
    }

    return formatDateInput(date);
}

function parseDateInput(dateInput: string): DateParts | null {
    const match = DATE_INPUT_PATTERN.exec(dateInput);

    if (!match) return null;

    const [, yearValue, monthValue, dayValue] = match;
    const parts = {
        year: Number(yearValue),
        month: Number(monthValue),
        day: Number(dayValue),
    };

    if (parts.month < 1 || parts.month > 12) return null;

    const date = dateFromParts(parts);

    if (
        date.getUTCFullYear() !== parts.year ||
        date.getUTCMonth() + 1 !== parts.month ||
        date.getUTCDate() !== parts.day
    ) {
        return null;
    }

    return parts;
}

function dateFromParts(parts: DateParts): Date {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));

    if (parts.year >= 0 && parts.year < 100) {
        date.setUTCFullYear(parts.year);
    }

    return date;
}

function addMonthsClamped(date: Date, monthOffset: number): Date {
    const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + monthOffset;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = totalMonths % 12;
    const targetDay = Math.min(date.getUTCDate(), daysInMonth(targetYear, targetMonth));

    return dateFromParts({
        year: targetYear,
        month: targetMonth + 1,
        day: targetDay,
    });
}

function daysInMonth(year: number, monthIndex: number): number {
    const date = new Date(Date.UTC(year, monthIndex + 1, 0, 12));

    return date.getUTCDate();
}

function formatDateInput(date: Date): string {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
}
