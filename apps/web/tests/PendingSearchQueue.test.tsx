import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { PendingSearchQueue } from "@/components/SearchBar/PendingSearchQueue";

const entries = [
    { id: "one", query: "paracetamol", timestamp: 1 },
    { id: "two", query: "paracetamol", timestamp: 2 },
];

describe("PendingSearchQueue", () => {
    it("renders an empty state", () => {
        render(<PendingSearchQueue pending={[]} onExecute={jest.fn()} />);
        expect(screen.getByText("No saved offline searches")).toBeInTheDocument();
    });

    it("disables every duplicate-query action while one item is running", () => {
        const onExecute = jest.fn();

        render(<PendingSearchQueue pending={entries} executingId="one" onExecute={onExecute} />);

        const buttons = screen.getAllByRole("button", { name: "Run saved search for paracetamol" });

        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeDisabled();

        fireEvent.click(buttons[1]);

        expect(onExecute).not.toHaveBeenCalled();
        expect(screen.getByText("Running...")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("executes the selected saved search", () => {
        const onExecute = jest.fn();

        render(<PendingSearchQueue pending={entries} onExecute={onExecute} />);

        fireEvent.click(
            screen.getAllByRole("button", {
                name: "Run saved search for paracetamol",
            })[1]
        );

        expect(onExecute).toHaveBeenCalledTimes(1);
        expect(onExecute).toHaveBeenCalledWith(entries[1]);
    });
});
