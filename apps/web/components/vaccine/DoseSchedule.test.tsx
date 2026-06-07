import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoseSchedule } from "../DoseSchedule";
import { VaccineProfile } from "@/lib/vaccineData";

const mockVaccine: VaccineProfile = {
    id: "test-vaccine",
    disease_name: "Test Disease",
    disease_summary: "A test disease",
    vaccine_name: "Test Vaccine",
    category: "Viral",
    target_groups: ["Infant"],
    is_relative_to_birth: true,
    dosing_intervals_weeks: [0, 6, 10, 14],
    total_doses: 4,
    effectiveness: "95%",
    side_effects: {
        common: ["Mild fever"],
        severe: ["Severe reaction"],
    },
    aftercare_text: "Rest well",
    schedule_label: "Test schedule",
};

describe("DoseSchedule", () => {
    it("renders the component without date", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="" />);

        expect(screen.getByText("Immunization Schedule")).toBeInTheDocument();
        expect(screen.getByText(/Select a birth date above to see projected/i)).toBeInTheDocument();
    });

    it("renders all doses", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        mockVaccine.dosing_intervals_weeks.forEach((_, index) => {
            expect(screen.getByText(String(index + 1))).toBeInTheDocument();
        });
    });

    it("calculates dates correctly", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        // First dose should be immediately after birth
        expect(screen.getByText(/1 Jan 2024/)).toBeInTheDocument();
    });

    it("displays summary information", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText(/Total Doses:/)).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText(/Effectiveness:/)).toBeInTheDocument();
        expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("handles relative to birth vaccines correctly", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText("At Birth Administration")).toBeInTheDocument();
        expect(screen.getByText("At 6 Weeks of Age")).toBeInTheDocument();
    });

    it("handles relative to first dose vaccines correctly", () => {
        const firstDoseVaccine: VaccineProfile = {
            ...mockVaccine,
            is_relative_to_birth: false,
            dosing_intervals_weeks: [0, 26],
        };

        render(<DoseSchedule vaccine={firstDoseVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText("Initial Administration (Baseline)")).toBeInTheDocument();
        expect(screen.getByText("Dose Step 2 (+26 weeks later)")).toBeInTheDocument();
    });

    it("shows pending state when no date is selected", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="" />);

        expect(screen.getByText(/Enter a date above to calculate/i)).toBeInTheDocument();
    });

    it("marks past doses as scheduled", () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split("T")[0];

        render(<DoseSchedule vaccine={mockVaccine} initialDate={dateStr} />);

        expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
    });
});
