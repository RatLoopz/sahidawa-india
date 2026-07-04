/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";

describe("UI component class merging", () => {
    it("lets Button className override conflicting variant and size classes", () => {
        render(<Button className="bg-red-500 px-8 text-black">Save</Button>);

        const button = screen.getByRole("button", { name: "Save" });

        expect(button).toHaveClass("bg-red-500", "px-8", "text-black");
        expect(button).not.toHaveClass("bg-emerald-600", "px-4", "text-white");
    });

    it("lets Badge className override conflicting variant colors", () => {
        render(<Badge className="border-blue-500 bg-red-500 text-white">Live</Badge>);

        const badge = screen.getByText("Live");

        expect(badge).toHaveClass("border-blue-500", "bg-red-500", "text-white");
        expect(badge).not.toHaveClass("border-emerald-300", "bg-emerald-100", "text-emerald-700");
    });

    it("lets Spinner className override conflicting size and border classes", () => {
        render(<Spinner className="h-12 w-12 border-4 border-red-500 border-t-blue-500" />);

        const spinner = screen.getByRole("status", { name: "Loading" });

        expect(spinner).toHaveClass(
            "h-12",
            "w-12",
            "border-4",
            "border-red-500",
            "border-t-blue-500"
        );
        expect(spinner).not.toHaveClass(
            "h-6",
            "w-6",
            "border-2",
            "border-emerald-500",
            "border-t-transparent"
        );
    });
});
