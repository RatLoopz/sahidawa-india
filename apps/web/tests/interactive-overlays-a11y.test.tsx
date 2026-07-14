/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Chatbot from "../app/[locale]/components/Chatbot";
import CommandPalette from "../app/[locale]/components/CommandPalette";

jest.mock("next-intl", () => ({
    useLocale: () => "en",
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values && "count" in values ? `${key}:${String(values.count)}` : key,
}));

describe("Chatbot accessibility", () => {
    it("exposes the panel as a labelled modal dialog", () => {
        render(<Chatbot />);

        const dialog = screen.getByRole("dialog", { hidden: true });
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", "chatbot-title");
        expect(document.getElementById("chatbot-title")).toHaveTextContent("title");
    });

    it("keeps the closed panel out of the tab order and accessibility tree", () => {
        render(<Chatbot />);

        // The panel stays mounted so it can animate, so `inert` is what actually hides it.
        const dialog = screen.getByRole("dialog", { hidden: true });
        expect(dialog).toHaveAttribute("inert");
        expect(dialog).toHaveAttribute("aria-hidden", "true");

        const launcher = screen.getByRole("button", { name: "openAiChat" });
        expect(launcher).toHaveAttribute("aria-expanded", "false");
        expect(launcher).toHaveAttribute("aria-controls", "chatbot-panel");
    });

    it("moves focus into the panel on open and restores it to the launcher on close", async () => {
        render(<Chatbot />);

        const launcher = screen.getByRole("button", { name: "openAiChat" });
        launcher.focus();
        fireEvent.click(launcher);

        const dialog = screen.getByRole("dialog");
        expect(dialog).not.toHaveAttribute("inert");
        expect(dialog).toHaveAttribute("aria-hidden", "false");

        // Focus lands on the message input, not the first header button.
        await waitFor(() => {
            expect(screen.getByRole("textbox", { name: "placeholder" })).toHaveFocus();
        });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);

        fireEvent.keyDown(dialog, { key: "Escape" });

        await waitFor(() => expect(launcher).toHaveFocus());
    });

    it("announces the assistant's latest message in a polite live region", async () => {
        render(<Chatbot />);

        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-live", "polite");
        // Nothing to announce while the chat is closed.
        expect(status).toBeEmptyDOMElement();

        fireEvent.click(screen.getByRole("button", { name: "openAiChat" }));

        await waitFor(() => expect(status).toHaveTextContent("welcome"));
    });
});

describe("CommandPalette accessibility", () => {
    const openPalette = () => {
        fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    };

    beforeEach(() => {
        document.body.style.overflow = "";
    });

    afterEach(() => {
        document.body.style.overflow = "";
    });

    it("renders as a labelled modal dialog and locks background scrolling", () => {
        render(<CommandPalette />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        openPalette();

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAccessibleName("title");
        expect(document.body.style.overflow).toBe("hidden");
    });

    it("moves focus to the search input and restores it to the opener on close", async () => {
        const opener = document.createElement("button");
        document.body.appendChild(opener);
        opener.focus();

        render(<CommandPalette />);
        openPalette();

        const input = screen.getByRole("combobox");
        await waitFor(() => expect(input).toHaveFocus());

        fireEvent.keyDown(window, { key: "Escape" });

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(opener).toHaveFocus());
        expect(document.body.style.overflow).toBe("");

        opener.remove();
    });

    it("wires the search input to the results listbox with aria-activedescendant", () => {
        render(<CommandPalette />);
        openPalette();

        const input = screen.getByRole("combobox");
        expect(input).toHaveAttribute("aria-controls", "command-palette-listbox");
        expect(input).toHaveAttribute("aria-expanded", "true");

        const options = screen.getAllByRole("option");
        expect(options[0]).toHaveAttribute("aria-selected", "true");
        expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

        // Options are driven by aria-activedescendant, so they stay out of the tab order and
        // focus remains on the input as the user arrows through results.
        expect(options[0]).toHaveAttribute("tabindex", "-1");

        fireEvent.keyDown(input, { key: "ArrowDown" });

        expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
        expect(options[1]).toHaveAttribute("aria-selected", "true");
        expect(options[0]).toHaveAttribute("aria-selected", "false");
    });

    it("announces the number of matching results as the query changes", () => {
        render(<CommandPalette />);
        openPalette();

        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("resultsCount:10");

        fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz" } });

        expect(status).toHaveTextContent("resultsCount:0");
        expect(screen.getByText("noResults")).toBeInTheDocument();
    });
});
