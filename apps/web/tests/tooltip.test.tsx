/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tooltip } from "../components/ui/Tooltip";

describe("Tooltip", () => {
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it("renders its trigger without showing tooltip content initially", () => {
        render(
            <Tooltip content="Report medicine details" delay={0} className="custom-trigger">
                <button type="button" className="child-button">
                    Report
                </button>
            </Tooltip>
        );

        const trigger = screen.getByRole("button", { name: "Report" });
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveClass("child-button");
        expect(trigger).toHaveClass("custom-trigger");
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("shows tooltip content when keyboard focus reaches trigger", async () => {
        const user = userEvent.setup();

        render(
            <Tooltip content="Search verified pharmacies" delay={0}>
                <button type="button">Search</button>
            </Tooltip>
        );

        await user.tab();

        expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
        const trigger = screen.getByRole("button", { name: "Search" });
        await waitFor(() => {
            const tooltip = screen.getByRole("tooltip");
            expect(tooltip).toHaveTextContent("Search verified pharmacies");
            expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
        });
    });
});
