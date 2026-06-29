/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChildVaccinationTracker } from "@/components/vaccine/ChildVaccinationTracker";

jest.setTimeout(20000);

const mockGetSession = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
        from: (...args: unknown[]) => mockFrom(...args),
    },
}));

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useFormatter: () => ({
        dateTime: (date: Date) => {
            const d = new Date(date);
            return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
        },
    }),
    useTranslations: () => {
        const translations: Record<string, string> = {
            childTrackerTitle: "Child Vaccination Tracker",
            childTrackerSubtitle: "Track your child's vaccinations",
            childNameLabel: "Child name",
            childNamePlaceholder: "Enter child name",
            childDobLabel: "Date of birth",
            childDobPrompt: "Enter date of birth to see schedule",
            childDobFutureError: "Date of birth cannot be in the future",
            childDobInvalidError: "Invalid date of birth",
            childReminderButton: "Download Reminders",
            childProfileSummary: "Child Profile",
            scheduleSourceLabel: "Schedule Source",
            childTimelineHeading: "Vaccination Timeline",
            childDefaultName: "My Child",
            completedStatus: "Completed",
            dueStatus: "Due",
            overdueStatus: "Overdue",
            upcomingStatus: "Upcoming",
            markCompleteButton: "Mark Complete",
            whereApplicableBadge: "Where applicable",
            dueDateLabel: "Due Date",
            officialTimingLabel: "Official Timing",
        };
        return (key: string) => translations[key] ?? key;
    },
}));

const TRACKER_STORAGE_KEY = "vaccine-hub-child-tracker-v1";

function configureSupabaseMock({
    sessionUserId = null,
    childProfile = null,
    completedDoseIds = [],
}: {
    sessionUserId?: string | null;
    childProfile?: { id: string; name: string; date_of_birth: string } | null;
    completedDoseIds?: string[];
} = {}) {
    const profileMaybeSingle = jest.fn().mockResolvedValue({
        data: childProfile,
        error: null,
    });
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }));
    const profileSelect = jest.fn(() => ({ eq: profileEq }));
    const profileUpsertSingle = jest.fn().mockResolvedValue({
        data: childProfile ?? {
            id: "profile-new",
            name: "Maya",
            date_of_birth: "2024-01-01",
        },
        error: null,
    });
    const profileUpsertSelect = jest.fn(() => ({ single: profileUpsertSingle }));
    const profileUpsert = jest.fn(() => ({ select: profileUpsertSelect }));

    const completedEq = jest.fn().mockResolvedValue({
        data: completedDoseIds.map((dose_id) => ({ dose_id })),
        error: null,
    });
    const completedSelect = jest.fn(() => ({ eq: completedEq }));
    const completedInsert = jest.fn().mockResolvedValue({ error: null });
    const completedDeleteDoseEq = jest.fn().mockResolvedValue({ error: null });
    const completedDeleteProfileEq = jest.fn(() => ({ eq: completedDeleteDoseEq }));
    const completedDelete = jest.fn(() => ({ eq: completedDeleteProfileEq }));

    mockGetSession.mockResolvedValue({
        data: {
            session: sessionUserId
                ? {
                      user: {
                          id: sessionUserId,
                      },
                  }
                : null,
        },
        error: null,
    });
    mockFrom.mockImplementation((table: string) => {
        if (table === "child_profiles") {
            return {
                select: profileSelect,
                upsert: profileUpsert,
            };
        }

        if (table === "child_completed_vaccinations") {
            return {
                select: completedSelect,
                insert: completedInsert,
                delete: completedDelete,
            };
        }

        throw new Error(`Unexpected Supabase table: ${table}`);
    });

    return {
        completedDeleteDoseEq,
        completedInsert,
        completedSelect,
        profileEq,
        profileMaybeSingle,
        profileUpsert,
        profileUpsertSingle,
    };
}

describe("ChildVaccinationTracker cloud sync", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("loads the child profile and completed doses from Supabase for authenticated users", async () => {
        const mocks = configureSupabaseMock({
            sessionUserId: "user-1",
            childProfile: {
                id: "profile-1",
                name: "Aarav",
                date_of_birth: "2024-01-01",
            },
            completedDoseIds: ["bcg"],
        });

        render(<ChildVaccinationTracker />);

        await waitFor(() => {
            expect(screen.getByLabelText("Child name")).toHaveValue("Aarav");
            expect(screen.getByLabelText("Date of birth")).toHaveValue("2024-01-01");
        });

        expect(screen.getByRole("button", { name: /mark BCG due/i })).toBeInTheDocument();
        expect(mocks.profileEq).toHaveBeenCalledWith("user_id", "user-1");
        expect(mocks.completedSelect).toHaveBeenCalledWith("dose_id");
        expect(localStorage.getItem(TRACKER_STORAGE_KEY)).toBeNull();
    });

    it("persists child profile state to localStorage when signed out", async () => {
        configureSupabaseMock();

        render(<ChildVaccinationTracker />);

        fireEvent.change(screen.getByLabelText("Child name"), {
            target: { value: "Maya" },
        });
        fireEvent.change(screen.getByLabelText("Date of birth"), {
            target: { value: "2024-01-01" },
        });

        await waitFor(() => {
            expect(screen.getByText("BCG")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: /mark BCG completed/i }));

        await waitFor(() => {
            expect(JSON.parse(localStorage.getItem(TRACKER_STORAGE_KEY) ?? "{}")).toEqual({
                childName: "Maya",
                dateOfBirth: "2024-01-01",
                completedDoseIds: ["bcg"],
            });
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it("upserts the child profile and syncs completed doses for authenticated users", async () => {
        const mocks = configureSupabaseMock({
            sessionUserId: "user-1",
        });

        render(<ChildVaccinationTracker />);

        fireEvent.change(screen.getByLabelText("Child name"), {
            target: { value: "Maya" },
        });
        fireEvent.change(screen.getByLabelText("Date of birth"), {
            target: { value: "2024-01-01" },
        });

        await waitFor(() => {
            expect(mocks.profileUpsert).toHaveBeenCalledWith(
                {
                    user_id: "user-1",
                    name: "Maya",
                    date_of_birth: "2024-01-01",
                },
                { onConflict: "user_id" }
            );
        });

        fireEvent.click(await screen.findByRole("button", { name: /mark BCG completed/i }));

        await waitFor(() => {
            expect(mocks.completedInsert).toHaveBeenCalledWith({
                child_profile_id: "profile-new",
                dose_id: "bcg",
            });
        });
        expect(localStorage.getItem(TRACKER_STORAGE_KEY)).toBeNull();
    });

    it("deletes completed doses from Supabase when authenticated users uncheck them", async () => {
        const mocks = configureSupabaseMock({
            sessionUserId: "user-1",
            childProfile: {
                id: "profile-1",
                name: "Aarav",
                date_of_birth: "2024-01-01",
            },
            completedDoseIds: ["bcg"],
        });

        render(<ChildVaccinationTracker />);

        fireEvent.click(await screen.findByRole("button", { name: /mark BCG due/i }));

        await waitFor(() => {
            expect(mocks.completedDeleteDoseEq).toHaveBeenCalledWith("dose_id", "bcg");
        });
    });
});
