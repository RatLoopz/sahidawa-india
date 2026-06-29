/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VaccineHubPage from "@/app/[locale]/vaccine-hub/page";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => {
        const labels: Record<string, string> = {
            childNameLabel: "Child name",
            childDobLabel: "Date of birth",
            childDobFutureError: "Date of birth cannot be in the future.",
            childDefaultName: "My Child",
            childTrackerTitle: "Child Vaccination Tracker",
            childTrackerSubtitle: "Track vaccinations for your child",
            completedStatus: "Completed",
            dueStatus: "Due",
            overdueStatus: "Overdue",
            upcomingStatus: "Upcoming",
            markCompleteButton: "Mark Complete",
            childDobPrompt: "Enter date of birth to see schedule",
            childReminderButton: "Download Reminders",
            scheduleSourceLabel: "Schedule Source",
            childTimelineHeading: "Vaccination Timeline",
            childProfileSummary: "Child Profile",
            childNamePlaceholder: "Enter child name",
            childDobInvalidError: "Invalid date of birth",
            whereApplicableBadge: "Where applicable",
            dueDateLabel: "Due Date",
            officialTimingLabel: "Official Timing",
        };
        return (key: string) => labels[key] ?? key;
    },
    useFormatter: () => ({
        dateTime: (date: Date) => {
            const d = new Date(date);
            return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
        },
    }),
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
});

const user = {
    type: async (element: HTMLElement, value: string) => {
        fireEvent.change(element, { target: { value } });
    },
    click: async (element: HTMLElement) => {
        fireEvent.click(element);
    },
};
const userEvent = {
    setup: () => user,
};

describe("VaccineHubPage Integration Tests", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("renders the page with empty state initially", () => {
        render(<VaccineHubPage />);

        expect(screen.getByText("title")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Child Vaccination Tracker" })
        ).toBeInTheDocument();
        expect(screen.getByText("noVaccineSelected")).toBeInTheDocument();
    });

    it("generates a personalized child schedule and toggles completed doses", async () => {
        render(<VaccineHubPage />);

        await user.type(screen.getByLabelText("Child name"), "Aarav");
        await user.type(screen.getByLabelText("Date of birth"), "2024-01-01");

        await waitFor(() => {
            expect(screen.getByText("Aarav")).toBeInTheDocument();
            expect(screen.getByText("BCG")).toBeInTheDocument();
            expect(screen.getByText("OPV-1")).toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: /mark BCG completed/i }));

        expect(screen.getByRole("button", { name: /mark BCG due/i })).toBeInTheDocument();
    });

    it("persists child tracker state to localStorage when signed out", async () => {
        render(<VaccineHubPage />);

        await user.type(screen.getByLabelText("Child name"), "Maya");
        await user.type(screen.getByLabelText("Date of birth"), "2024-01-01");

        await waitFor(() => {
            expect(
                JSON.parse(localStorage.getItem("vaccine-hub-child-tracker-v1") ?? "{}")
            ).toEqual({
                childName: "Maya",
                dateOfBirth: "2024-01-01",
                completedDoseIds: [],
            });
        });
    });

    it("shows a validation message for future child dates of birth", async () => {
        render(<VaccineHubPage />);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        await user.type(
            screen.getByLabelText("Date of birth"),
            futureDate.toISOString().split("T")[0]
        );

        expect(screen.getByText("Date of birth cannot be in the future.")).toBeInTheDocument();
    });

    it("limits child profile names to a mobile-safe length", () => {
        render(<VaccineHubPage />);

        expect(screen.getByLabelText("Child name")).toHaveAttribute("maxLength", "80");
    });

    it("shows vaccine selector control", () => {
        render(<VaccineHubPage />);

        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        expect(selector).toBeInTheDocument();
    });

    it("selects a vaccine and saves to localStorage", async () => {
        render(<VaccineHubPage />);

        // Open dropdown
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        // Wait for dropdown options
        await waitFor(() => {
            expect(screen.getByText(/Newborn & Infant/i)).toBeInTheDocument();
        });

        // Select polio
        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        // Verify vaccine details appear
        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        // Verify localStorage was updated
        expect(localStorage.getItem("vaccine-hub-selected-vaccine")).toBe("polio");
    });

    it("loads persisted vaccine selection on mount", () => {
        localStorage.setItem("vaccine-hub-selected-vaccine", "measles");

        render(<VaccineHubPage />);

        expect(screen.getAllByText(/Measles, Mumps & Rubella/i)[0]).toBeInTheDocument();
    });

    it("shows date input when vaccine is selected", async () => {
        render(<VaccineHubPage />);

        // Open dropdown and select vaccine
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        // Verify date input appears
        await waitFor(() => {
            const dateInput = screen.getByLabelText(/birth date/i);
            expect(dateInput).toBeInTheDocument();
        });
    });

    it("calculates and displays dose schedule with date", async () => {
        render(<VaccineHubPage />);

        // Select vaccine
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        // Enter date
        const dateInput = screen.getByLabelText(/birth date/i) as HTMLInputElement;
        await user.type(dateInput, "01012024");

        // Verify doses are calculated
        await waitFor(() => {
            expect(screen.getByText(/1 Jan 2024/)).toBeInTheDocument();
        });
    });

    it("displays safety information", async () => {
        render(<VaccineHubPage />);

        // Select vaccine
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        // Verify safety sections appear
        await waitFor(() => {
            expect(screen.getByText("commonEffects")).toBeInTheDocument();
            expect(screen.getByText("severeReactions")).toBeInTheDocument();
        });
    });

    it("displays aftercare guidance", async () => {
        render(<VaccineHubPage />);
        const user = userEvent.setup();

        // Select vaccine
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        // Verify aftercare section appears
        await waitFor(() => {
            expect(screen.getByText(/Post-Vaccination Care/i)).toBeInTheDocument();
        });
    });

    it("persists both vaccine selection and date", async () => {
        const { unmount } = render(<VaccineHubPage />);
        const user = userEvent.setup();

        // Select vaccine and date
        const selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        const dateInput = screen.getByLabelText(/birth date/i) as HTMLInputElement;
        await user.type(dateInput, "01012024");

        // Unmount and remount
        unmount();

        render(<VaccineHubPage />);

        // Verify persistence
        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        expect(localStorage.getItem("vaccine-hub-selected-vaccine")).toBe("polio");
        expect(localStorage.getItem("vaccine-hub-initial-date")).toBe("2024-01-01");
    });

    it("clears date when switching vaccines", async () => {
        render(<VaccineHubPage />);
        const user = userEvent.setup();

        // Select first vaccine with date
        let selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Poliomyelitis/i)[0]).toBeInTheDocument();
        });

        const polioOption = screen.getAllByText(/Poliomyelitis/i)[0];
        await user.click(polioOption);

        const dateInput = screen.getByLabelText(/birth date/i) as HTMLInputElement;
        await user.type(dateInput, "01012024");

        expect(localStorage.getItem("vaccine-hub-initial-date")).toBe("2024-01-01");

        // Switch vaccine
        selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            expect(screen.getAllByText(/Measles/i)[0]).toBeInTheDocument();
        });

        const measlesOption = screen.getByText(/Measles, Mumps & Rubella/i);
        await user.click(measlesOption);

        // Verify date was cleared
        expect(localStorage.getItem("vaccine-hub-initial-date")).toBeNull();
    });
});
