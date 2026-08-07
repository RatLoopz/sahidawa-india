import { render, screen, fireEvent } from "@testing-library/react";

import { useUpload } from "../components/medicine/useUpload";

import { renderToStaticMarkup } from "react-dom/server";
import { MedicinePhotoUpload } from "../components/medicine/MedicinePhotoUpload";

jest.mock("../components/medicine/useUpload");

const mockUpload = jest.fn();
const mockReset = jest.fn();
const mockCancel = jest.fn();

const mockedUseUpload = useUpload as jest.MockedFunction<typeof useUpload>;

describe("MedicinePhotoUpload", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockedUseUpload.mockReturnValue({
            state: { status: "idle" },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });
    });
    it("renders the dropzone with file input constraints and accessibility attributes", () => {
        const markup = renderToStaticMarkup(
            <MedicinePhotoUpload onUploadComplete={() => undefined} label="Upload Medicine Photo" />
        );

        expect(markup).toContain('accept="image/jpeg,image/png,image/webp"');
        expect(markup).toContain('capture="environment"');
        expect(markup).not.toContain("multiple");
        expect(markup).toContain('aria-label="Upload Medicine Photo — click or drag and drop"');
        expect(markup).toContain("Upload medicine photo");
        expect(markup).toContain('aria-live="polite"');
        expect(markup).toContain("Upload Medicine Photo");
    });

    it("renders disabled dropzone semantics when disabled", () => {
        const markup = renderToStaticMarkup(
            <MedicinePhotoUpload onUploadComplete={() => undefined} disabled />
        );

        expect(markup).toContain('aria-disabled="true"');
        expect(markup).toContain("disabled");
    });

    it("calls upload when a valid file is selected", () => {
        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;

        const file = new File(["abc"], "test.jpg", {
            type: "image/jpeg",
        });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        expect(mockUpload).toHaveBeenCalledWith(file);
    });

    it("does not call upload when an invalid file type is selected", () => {
        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;

        const file = new File(["abc"], "test.txt", {
            type: "text/plain",
        });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("renders upload progress while uploading", () => {
        mockedUseUpload.mockReturnValue({
            state: {
                status: "uploading",
                progress: 50,
            },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });

        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");

        expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("calls cancel when the cancel upload button is clicked", () => {
        mockedUseUpload.mockReturnValue({
            state: {
                status: "uploading",
                progress: 40,
            },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });

        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /cancel upload/i,
            })
        );

        expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it("renders an error message when upload fails", () => {
        mockedUseUpload.mockReturnValue({
            state: {
                status: "error",
                message: "Upload failed",
            },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });

        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });

    it("resets upload when try again is clicked", () => {
        mockedUseUpload.mockReturnValue({
            state: {
                status: "error",
                message: "Upload failed",
            },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });

        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /try uploading again/i,
            })
        );

        expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("renders uploaded medicine preview when upload is successful", () => {
        mockedUseUpload.mockReturnValue({
            state: { status: "success" },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });
        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);
        expect(screen.getByAltText(/uploaded medicine preview/i)).toBeInTheDocument();
    });

    it("resets upload when remove button is clicked", () => {
        mockedUseUpload.mockReturnValue({
            state: {
                status: "success",
                secureUrl: "https://example.com/image.jpg",
            },
            upload: mockUpload,
            reset: mockReset,
            cancel: mockCancel,
        });

        render(<MedicinePhotoUpload onUploadComplete={jest.fn()} />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /remove uploaded photo/i,
            })
        );

        expect(mockReset).toHaveBeenCalledTimes(1);
    });
});
