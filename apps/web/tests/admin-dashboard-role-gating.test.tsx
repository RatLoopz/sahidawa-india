/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AdminDashboard from "../app/[locale]/admin/dashboard/page";

type MockRole = "admin" | "moderator" | null;

let mockSessionRole: MockRole = null;

const mockGetSession = jest.fn(async () => ({
    data: {
        session: mockSessionRole
            ? {
                  user: {
                      app_metadata: { role: mockSessionRole },
                      user_metadata: {},
                  },
              }
            : null,
    },
}));

jest.mock("@/src/components/AuthProvider", () => ({
    useSession: () => {
        if (!mockSessionRole) {
            return { session: null, isLoading: false, token: null };
        }
        return {
            session: {
                user: {
                    app_metadata: { role: mockSessionRole },
                    user_metadata: {},
                },
            },
            isLoading: false,
            token: "test-token",
        };
    },
}));

jest.mock("@/i18n/routing", () => ({
    Link: ({
        children,
        href,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

jest.mock("next-intl", () => ({
    useTranslations: () => {
        const messages: Record<string, string> = {
            "actions.addMedicine": "Add Medicine",
            "actions.falseAlarm": "False alarm",
            "actions.markFake": "Mark fake",
            "actions.refresh": "Refresh",
            "actions.signIn": "Sign In",
            "header.subtitle": "Manage community-reported counterfeit medicines",
            "header.title": "Moderation Dashboard",
            "medicine.columns.barcode": "Barcode",
            "medicine.columns.brand": "Brand",
            "medicine.columns.generic": "Generic",
            "medicine.columns.manufacturer": "Manufacturer",
            "medicine.columns.status": "Status",
            "medicine.empty": "No medicines found",
            "medicine.title": "Medicine Master",
            "nav.logs": "Audit Logs",
            "nav.medicine": "Medicine Master",
            "nav.reports": "Reports",
            "reports.columns.actions": "Actions",
            "reports.columns.barcode": "Barcode",
            "reports.columns.district": "District",
            "reports.columns.medicine": "Medicine",
            "reports.columns.reported": "Reported",
            "reports.empty": "No pending reports",
            "reports.loading": "Loading reports...",
            "reports.title": "Incoming Reports",
            searchPlaceholder: "Search...",
        };

        return (key: string, values?: Record<string, unknown>) => {
            if (key === "reports.pendingCount") {
                return `${String(values?.count ?? 0)} pending reports`;
            }

            return messages[key] ?? key;
        };
    },
}));

const report = {
    id: "report-1",
    reported_brand_name: "Suspect Med",
    district: "Jaipur",
    status: "pending",
    created_at: new Date().toISOString(),
    scanned_barcode: "8901234567890",
};

const medicine = {
    id: "medicine-1",
    brand_name: "Catalog Med",
    generic_name: "Paracetamol",
    manufacturer: "Sahi Labs",
    barcode_id: "8900000000000",
    cdsco_approval_status: "approved",
};

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

describe("AdminDashboard role-based mutation controls", () => {
    beforeEach(() => {
        mockSessionRole = null;
        mockGetSession.mockClear();
        localStorage.setItem("sb-access-token", "test-token");
        Object.defineProperty(global, "fetch", {
            configurable: true,
            writable: true,
            value: jest.fn(async (input) => {
                const url = String(input);

                if (url.endsWith("/reports")) {
                    return jsonResponse({ reports: [report] });
                }

                if (url.endsWith("/medicines")) {
                    return jsonResponse({ medicines: [medicine] });
                }

                if (url.endsWith("/logs")) {
                    return jsonResponse({ logs: [] });
                }

                if (url.endsWith("/reports/report-1/status")) {
                    return jsonResponse({ report: { ...report, status: "verified_fake" } });
                }

                return jsonResponse({}, 404);
            }),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        localStorage.clear();
    });

    it("lets moderators view reports and medicines without mutation controls", async () => {
        mockSessionRole = "moderator";

        render(<AdminDashboard />);

        expect(await screen.findByText("Suspect Med")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /mark fake/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /false alarm/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /medicine master/i }));

        expect(await screen.findByText("Catalog Med")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /add medicine/i })).not.toBeInTheDocument();
    });

    it("keeps mutation controls available for admins", async () => {
        mockSessionRole = "admin";

        render(<AdminDashboard />);

        expect(await screen.findByRole("button", { name: /mark fake/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /false alarm/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /medicine master/i }));

        expect(await screen.findByRole("button", { name: /add medicine/i })).toBeInTheDocument();
    });

    it("sends report mutation requests for admins", async () => {
        mockSessionRole = "admin";
        const fetchMock = global.fetch as jest.Mock;

        render(<AdminDashboard />);

        fireEvent.click(await screen.findByRole("button", { name: /mark fake/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("/reports/report-1/status"),
                expect.objectContaining({
                    method: "PATCH",
                })
            );
        });
    });
});
