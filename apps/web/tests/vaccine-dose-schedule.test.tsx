/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { DoseSchedule } from "@/components/vaccine/DoseSchedule";
import { VaccineProfile } from "@/lib/vaccineData";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({
        dateTime: (date: Date) => {
            const d = new Date(date);
            return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
        },
    }),
}));

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

        expect(screen.getByText("scheduleLayoutHeading")).toBeInTheDocument();
        expect(screen.getAllByText("selectDateWarning")[0]).toBeInTheDocument();
    });

    it("renders all doses", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        mockVaccine.dosing_intervals_weeks.forEach((_, index) => {
            expect(screen.getAllByText(String(index + 1))[0]).toBeInTheDocument();
        });
    });

    it("calculates dates correctly", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        // First dose should be immediately after birth
        expect(screen.getByText(/1 Jan 2024/)).toBeInTheDocument();
    });

    it("displays summary information", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText(/totalDoses/)).toBeInTheDocument();
        expect(screen.getAllByText("4")[0]).toBeInTheDocument();
        expect(screen.getByText(/effectiveness/)).toBeInTheDocument();
        expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("handles relative to birth vaccines correctly", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText("atBirth")).toBeInTheDocument();
        expect(screen.getAllByText("atWeeks").length).toBeGreaterThan(0);
    });

    it("handles relative to first dose vaccines correctly", () => {
        const firstDoseVaccine: VaccineProfile = {
            ...mockVaccine,
            is_relative_to_birth: false,
            dosing_intervals_weeks: [0, 26],
        };

        render(<DoseSchedule vaccine={firstDoseVaccine} initialDate="2024-01-01" />);

        expect(screen.getByText("baseline")).toBeInTheDocument();
        expect(screen.getByText("doseStep")).toBeInTheDocument();
    });

    it("shows pending state when no date is selected", () => {
        render(<DoseSchedule vaccine={mockVaccine} initialDate="" />);

        expect(screen.getAllByText("selectDateWarning")[0]).toBeInTheDocument();
    });

    it("marks past doses as scheduled", () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split("T")[0];

        render(<DoseSchedule vaccine={mockVaccine} initialDate={dateStr} />);

        expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
    });
});
