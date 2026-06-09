import {
    generateChildVaccinationSchedule,
    NATIONAL_IMMUNIZATION_SCHEDULE,
    validateChildDateOfBirth,
} from "@/lib/childVaccinationSchedule";

describe("child vaccination schedule", () => {
    it("contains core India NIS infant and child vaccine milestones", () => {
        const vaccineNames = NATIONAL_IMMUNIZATION_SCHEDULE.map((item) => item.vaccineName);

        expect(vaccineNames).toEqual(expect.arrayContaining(["BCG", "OPV-0", "OPV-1"]));
        expect(vaccineNames).toEqual(
            expect.arrayContaining(["Pentavalent-1", "fIPV-3", "DPT Booster-1", "DPT Booster-2"])
        );
    });

    it("calculates due dates from the child's date of birth", () => {
        const schedule = generateChildVaccinationSchedule("2024-01-01", "2024-03-01");

        expect(schedule.find((item) => item.id === "bcg")?.dueDate).toBe("2024-01-01");
        expect(schedule.find((item) => item.id === "opv-1")?.dueDate).toBe("2024-02-12");
        expect(schedule.find((item) => item.id === "pentavalent-3")?.dueDate).toBe("2024-04-08");
        expect(schedule.find((item) => item.id === "fipv-3")?.dueDate).toBe("2024-10-01");
        expect(schedule.find((item) => item.id === "dpt-booster-1")?.dueDate).toBe("2025-05-01");
    });

    it("uses the end of the official due window when deciding overdue status", () => {
        const schedule = generateChildVaccinationSchedule("2024-01-01", "2025-01-15");

        expect(schedule.find((item) => item.id === "mr-1")?.status).toBe("overdue");
        expect(schedule.find((item) => item.id === "dpt-booster-1")?.status).toBe("upcoming");
    });

    it("clamps month calculations for children born at the end of a month", () => {
        const schedule = generateChildVaccinationSchedule("2024-01-31", "2024-02-01");

        expect(schedule.find((item) => item.id === "mr-1")?.dueDate).toBe("2024-10-31");
        expect(schedule.find((item) => item.id === "dpt-booster-1")?.dueDate).toBe("2025-05-31");
    });

    it("clamps month calculations to February 29 in leap years", () => {
        const schedule = generateChildVaccinationSchedule("2022-10-31", "2024-01-01");

        expect(schedule.find((item) => item.id === "dpt-booster-1")?.dueDate).toBe("2024-02-29");
    });

    it("rejects invalid and future dates of birth", () => {
        expect(validateChildDateOfBirth("", "2024-01-01")).toEqual({
            isValid: false,
            reason: "missing",
        });
        expect(validateChildDateOfBirth("not-a-date", "2024-01-01")).toEqual({
            isValid: false,
            reason: "invalid",
        });
        expect(validateChildDateOfBirth("2024-01-02", "2024-01-01")).toEqual({
            isValid: false,
            reason: "future",
        });
        expect(validateChildDateOfBirth("2024-01-01", "2024-01-01")).toEqual({
            isValid: true,
        });
    });
});
