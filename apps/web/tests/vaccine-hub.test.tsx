/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VaccineHubPage from "@/app/[locale]/vaccine-hub/page";

jest.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
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
        const user = userEvent.setup();

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

    it("does not persist child date of birth to localStorage", async () => {
        render(<VaccineHubPage />);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Date of birth"), "2024-01-01");

        expect(localStorage.getItem("vaccine-hub-child-tracker-v1")).toBeNull();
    });

    it("shows a validation message for future child dates of birth", async () => {
        render(<VaccineHubPage />);
        const user = userEvent.setup();
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
        const user = userEvent.setup();

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
        const user = userEvent.setup();

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
        const user = userEvent.setup();

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
        await user.type(dateInput, "2024-01-01");

        // Verify doses are calculated
        await waitFor(() => {
            expect(screen.getByText(/1 Jan 2024/)).toBeInTheDocument();
        });
    });

    it("displays safety information", async () => {
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
        await user.type(dateInput, "2024-01-01");

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
        await user.type(dateInput, "2024-01-01");

        expect(localStorage.getItem("vaccine-hub-initial-date")).toBe("2024-01-01");

        // Switch vaccine
        selector = screen.getByRole("button", { name: /Select a vaccine/i });
        await user.click(selector);

        await waitFor(() => {
            screen.getByText(/Measles/i);
        });

        const measlesOption = screen.getByText(/Measles, Mumps & Rubella/i);
        await user.click(measlesOption);

        // Verify date was cleared
        expect(localStorage.getItem("vaccine-hub-initial-date")).toBeNull();
    });
});
