import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Medicine } from "@/src/components/ComparisonGrid";

export interface ComparisonExportRow {
    label: string;
    getValue: (m: Medicine) => string;
}

function displayName(m: Medicine): string {
    return m.brand_name?.trim() || m.generic_name;
}

function escapeCsvValue(value: string): string {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export function buildComparisonTable(
    medicines: Medicine[],
    rows: ComparisonExportRow[]
): { headers: string[]; body: string[][] } {
    const headers = ["Field", ...medicines.map(displayName)];
    const body = rows.map(({ label, getValue }) => [
        label,
        ...medicines.map((m) => getValue(m)),
    ]);
    return { headers, body };
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportComparisonToCSV(
    medicines: Medicine[],
    rows: ComparisonExportRow[],
    filename = "medicine-comparison.csv"
): void {
    const { headers, body } = buildComparisonTable(medicines, rows);
    const lines = [headers, ...body].map((row) =>
        row.map((cell) => escapeCsvValue(cell)).join(",")
    );
    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, filename);
}

export function exportComparisonToPDF(
    medicines: Medicine[],
    rows: ComparisonExportRow[],
    filename = "medicine-comparison.pdf"
): void {
    const { headers, body } = buildComparisonTable(medicines, rows);
    const doc = new jsPDF({
        orientation: medicines.length > 3 ? "landscape" : "portrait",
    });

    doc.setFontSize(14);
    doc.text("Medicine Comparison Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 21);

    autoTable(doc, {
        head: [headers],
        body,
        startY: 26,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(filename);
}