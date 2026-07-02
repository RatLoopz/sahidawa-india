import { renderToStaticMarkup } from "react-dom/server";

import { MedicineVerificationResultCard } from "../components/scanner/results/MedicineVerificationResultCard";

describe("MedicineVerificationResultCard", () => {
    const defaultProps = {
        title: "Paracetamol 500mg",
        subtitle: "Verified by CDSCO Database",
        manufacturer: "ABC Pharma",
        batchNumber: "B12345",
        expiryDate: "12/2027",
        onScanAgain: () => undefined,
        onShare: () => undefined,
        shareLabel: "Share",
    };

    it("renders real status", () => {
        const markup = renderToStaticMarkup(
            <MedicineVerificationResultCard {...defaultProps} status="real" />
        );

        expect(markup).toContain("Paracetamol 500mg");
        expect(markup).toContain("Verified by CDSCO Database");
        expect(markup).toContain('role="status"');
    });

    it("renders suspicious status", () => {
        const markup = renderToStaticMarkup(
            <MedicineVerificationResultCard {...defaultProps} status="suspicious" />
        );

        expect(markup).toContain("Paracetamol 500mg");
        expect(markup).toContain('role="status"');
    });

    it("renders fake status", () => {
        const markup = renderToStaticMarkup(
            <MedicineVerificationResultCard {...defaultProps} status="fake" />
        );

        expect(markup).toContain("Paracetamol 500mg");
        expect(markup).toContain('role="status"');
    });

    it("renders medicine details", () => {
        const markup = renderToStaticMarkup(
            <MedicineVerificationResultCard {...defaultProps} status="real" />
        );

        expect(markup).toContain("ABC Pharma");
        expect(markup).toContain("B12345");
    });
});
