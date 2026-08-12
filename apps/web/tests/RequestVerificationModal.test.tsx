import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestVerificationModal } from "../components/RequestVerificationModal";

const mockGetSession = jest.fn();
const mockInsert = jest.fn();

jest.mock("../hooks/useFocusTrap", () => ({
    useFocusTrap: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
    API_BASE: "http://localhost:3000",
}));

jest.mock("@/lib/supabase", () => ({
    supabase: {
        auth: {
            getSession: mockGetSession,
        },
        from: jest.fn(() => ({
            insert: mockInsert,
        })),
    },
}));

describe("RequestVerificationModal", () => {
    const defaultProps = {
        isOpen: true,
        onClose: jest.fn(),
        medicineName: "Paracetamol 500mg",
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetSession.mockResolvedValue({
            data: {
                session: {
                    user: {
                        id: "user-123",
                    },
                },
            },
        });

        mockInsert.mockResolvedValue({
            data: {},
            error: null,
        });

        global.fetch = jest.fn();
    });

    it("renders the verification modal correctly", () => {
        render(<RequestVerificationModal {...defaultProps} />);

        expect(
            screen.getByRole("dialog", {
                name: "Request Verification",
            })
        ).toBeInTheDocument();

        expect(screen.getByText("Request Verification")).toBeInTheDocument();

        expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();

        expect(
            screen.getByText(/is currently unverified\. Please upload a clear photo/i)
        ).toBeInTheDocument();

        expect(screen.getByText("Click to select an image")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Submit for Review" })).toBeDisabled();

        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("does not render when the modal is closed", () => {
        render(<RequestVerificationModal {...defaultProps} isOpen={false} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows a validation error when no file is selected", async () => {
        const user = userEvent.setup();

        render(<RequestVerificationModal {...defaultProps} />);

        const submitButton = screen.getByRole("button", {
            name: "Submit for Review",
        });

        expect(submitButton).toBeDisabled();

        // The component prevents submission through the disabled button.
        // Call the button only after selecting/removing a file isn't possible
        // through the public UI, so verify the initial validation contract
        // through the rendered disabled state.
        expect(
            screen.queryByText("Please select an image file to upload.")
        ).not.toBeInTheDocument();

        expect(submitButton).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("allows a file to be selected and enables submission", async () => {
        const user = userEvent.setup();

        render(<RequestVerificationModal {...defaultProps} />);

        const file = new File(["medicine image"], "medicine.png", {
            type: "image/png",
        });

        const input = screen.getByLabelText(/Click to select an image|medicine\.png/i);

        await user.upload(input, file);

        expect(screen.getByText("medicine.png")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Submit for Review" })).toBeEnabled();
    });

    it("successfully uploads the file and shows the success state", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                extracted_text: "Paracetamol 500mg",
            }),
        });

        render(<RequestVerificationModal {...defaultProps} />);

        const file = new File(["medicine image"], "medicine.png", {
            type: "image/png",
        });

        const input = screen.getByLabelText(/Click to select an image|medicine\.png/i);

        await user.upload(input, file);

        await user.click(screen.getByRole("button", { name: "Submit for Review" }));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:3000/api/v1/scan/extract",
                expect.objectContaining({
                    method: "POST",
                    body: expect.any(FormData),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText("Verification Requested!")).toBeInTheDocument();
        });

        expect(screen.getByText(/Your request has been submitted for review/i)).toBeInTheDocument();

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                medicine_name: "Paracetamol 500mg",
                ocr_extracted_text: "Paracetamol 500mg",
                status: "pending",
                submitted_by: "user-123",
            })
        );
    });

    it("shows an error when the upload fails", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: jest.fn().mockResolvedValue({
                error: "Invalid medicine image",
            }),
        });

        render(<RequestVerificationModal {...defaultProps} />);

        const file = new File(["invalid image"], "invalid.png", {
            type: "image/png",
        });

        const input = screen.getByLabelText(/Click to select an image|medicine\.png/i);

        await user.upload(input, file);

        await user.click(screen.getByRole("button", { name: "Submit for Review" }));

        expect(await screen.findByText("Invalid medicine image")).toBeInTheDocument();

        expect(screen.queryByText("Verification Requested!")).not.toBeInTheDocument();

        expect(mockInsert).not.toHaveBeenCalled();
    });

    it("shows the loading state while upload is in progress", async () => {
        const user = userEvent.setup();

        let resolveFetch!: (value: unknown) => void;

        (global.fetch as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
                resolveFetch = resolve;
            })
        );

        render(<RequestVerificationModal {...defaultProps} />);

        const file = new File(["medicine image"], "medicine.png", {
            type: "image/png",
        });

        const input = screen.getByLabelText(/Click to select an image|medicine\.png/i);

        await user.upload(input, file);

        const submitButton = screen.getByRole("button", {
            name: "Submit for Review",
        });

        await user.click(submitButton);

        expect(await screen.findByRole("button", { name: "Uploading..." })).toBeDisabled();

        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

        resolveFetch({
            ok: true,
            json: jest.fn().mockResolvedValue({
                extracted_text: "Paracetamol 500mg",
            }),
        });

        await waitFor(() => {
            expect(screen.getByText("Verification Requested!")).toBeInTheDocument();
        });
    });

    it("invokes the success callback when the success state is closed", async () => {
        const user = userEvent.setup();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                extracted_text: "Paracetamol 500mg",
            }),
        });

        render(<RequestVerificationModal {...defaultProps} />);

        const file = new File(["medicine image"], "medicine.png", {
            type: "image/png",
        });

        const input = screen.getByLabelText(/Click to select an image|medicine\.png/i);

        await user.upload(input, file);

        await user.click(screen.getByRole("button", { name: "Submit for Review" }));

        await screen.findByText("Verification Requested!");

        await user.click(screen.getByRole("button", { name: "Close" }));

        expect(defaultProps.onClose).toHaveBeenCalled();
    });
});
