import { AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { exportComparisonToCSV, exportComparisonToPDF } from "@/src/lib/comparisonExport";

export interface Medicine {
    id: string;
    brand_name: string | null;
    generic_name: string;
    composition: string | null;
    manufacturer: string;
    mrp?: number | null;
    jan_aushadhi_price?: number | null;
    expiry_date?: string | null;
    medicine_type?: "brand" | "generic";
    cdsco_approval_status: string;
}

export interface ComparisonGridLabels {
    emptyComparison: string;
    fieldHeader: string;
    medicineA: string;
    medicineB: string;
    priceUnavailable: string;
    noSavings: string;
    saveAmount: (amount: string, percent: string) => string;
    rows: {
        brandName: string;
        genericName: string;
        composition: string;
        manufacturer: string;
        type: string;
        cdscoStatus: string;
        expiryDate: string;
        marketPrice: string;
        janAushadhiPrice: string;
        savings: string;
    };
    medicineTypes: {
        brand: string;
        generic: string;
    };
    status: {
        approved: string;
        recalled: string;
        banned: string;
    };
}

const defaultLabels: ComparisonGridLabels = {
    emptyComparison: "Select two medicines above to see the comparison.",
    fieldHeader: "Field",
    medicineA: "Medicine A",
    medicineB: "Medicine B",
    priceUnavailable: "Price unavailable",
    noSavings: "No savings",
    saveAmount: (amount, percent) => `Save ₹${amount} (${percent}%)`,
    rows: {
        brandName: "Brand name",
        genericName: "Generic name",
        composition: "Composition",
        manufacturer: "Manufacturer",
        type: "Type",
        cdscoStatus: "CDSCO status",
        expiryDate: "Expiry date",
        marketPrice: "Market price (MRP)",
        janAushadhiPrice: "Jan Aushadhi price",
        savings: "Savings vs MRP",
    },
    medicineTypes: {
        brand: "brand",
        generic: "generic",
    },
    status: {
        approved: "Approved",
        recalled: "Recalled",
        banned: "Banned",
    },
};

function hasValidMrp(m: Medicine | null | undefined): m is Medicine & { mrp: number } {
    return m != null && m.mrp != null && Number.isFinite(m.mrp) && m.mrp >= 0;
}

function formatExpiry(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function displayName(m: Medicine): string {
    return m.brand_name?.trim() || m.generic_name;
}

function formatStatus(status: string, labels: ComparisonGridLabels): string {
    const map: Record<string, string> = {
        approved: labels.status.approved,
        recalled: labels.status.recalled,
        banned: labels.status.banned,
    };
    return map[status.toLowerCase()] ?? status;
}

function isFlaggedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized === "recalled" || normalized === "banned";
}
function CdscoStatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();
    const config: Record<string, { label: string; className: string }> = {
        approved: {
            label: "Approved",
            className: "bg-emerald-100 text-emerald-800 border-emerald-200",
        },
        recalled: {
            label: "Recalled",
            className: "bg-amber-100 text-amber-800 border-amber-200",
        },
        banned: {
            label: "Banned",
            className: "bg-red-100 text-red-800 border-red-200",
        },
    };
    const c = config[normalized] ?? {
        label: status,
        className: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return (
        <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${c.className}`}
        >
            {c.label}
        </span>
    );
}
function hasValidJanAushadhiPrice(
    m: Medicine | null | undefined
): m is Medicine & { jan_aushadhi_price: number } {
    return (
        m != null &&
        m.jan_aushadhi_price != null &&
        Number.isFinite(m.jan_aushadhi_price) &&
        m.jan_aushadhi_price >= 0
    );
}

function computeSavingsPercent(higher: number, lower: number): number {
    if (higher <= 0) return 0;
    return ((higher - lower) / higher) * 100;
}

function formatPrice(value: number | null | undefined, unavailableText: string): string {
    return value != null ? `₹${value.toFixed(2)}` : unavailableText;
}

function getSavingsText(medicine: Medicine | null, labels: ComparisonGridLabels): string {
    if (!medicine || !hasValidMrp(medicine) || !hasValidJanAushadhiPrice(medicine)) {
        return labels.priceUnavailable;
    }

    if (medicine.mrp <= medicine.jan_aushadhi_price) {
        return labels.noSavings;
    }

    const amount = medicine.mrp - medicine.jan_aushadhi_price;
    const percent = computeSavingsPercent(medicine.mrp, medicine.jan_aushadhi_price);
    return labels.saveAmount(amount.toFixed(2), percent.toFixed(1));
}
function getDirectComparison(medicine1: Medicine | null, medicine2: Medicine | null) {
    if (!medicine1 || !medicine2) return null;

    if (!hasValidMrp(medicine1) || !hasValidMrp(medicine2)) {
        return null;
    }

    if (medicine1.mrp === medicine2.mrp) {
        return {
            type: "equal" as const,
        };
    }

    const cheaper = medicine1.mrp < medicine2.mrp ? medicine1 : medicine2;
    const expensive = medicine1.mrp > medicine2.mrp ? medicine1 : medicine2;

    const savings = expensive.mrp - cheaper.mrp;

    const percentage = computeSavingsPercent(expensive.mrp, cheaper.mrp);

    return {
        type: "savings" as const,
        cheaper,
        expensive,
        savings,
        percentage,
    };
}

function shareComparison(medicine1: Medicine | null, medicine2: Medicine | null) {
    if (!medicine1 || !medicine2) return;

    const url =
        `${window.location.origin}${window.location.pathname}` +
        `?m1=${medicine1.id}&m2=${medicine2.id}`;

    navigator.clipboard.writeText(url);
}

function handleExportCSV(
    medicines: Medicine[],
    rows: { label: string; getValue: (m: Medicine) => string }[]
) {
    exportComparisonToCSV(medicines, rows);
}

function handleExportPDF(
    medicines: Medicine[],
    rows: { label: string; getValue: (m: Medicine) => string }[]
) {
    exportComparisonToPDF(medicines, rows);
}

export default function ComparisonGrid({
    medicines,
    labels = defaultLabels,
}: {
    medicines: (Medicine | null)[];
    labels?: ComparisonGridLabels;
}) {
    const validMedicines = medicines.filter((m): m is Medicine => m !== null);

    if (validMedicines.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                {labels.emptyComparison}
            </div>
        );
    }

    const directComparison =
        validMedicines.length >= 2
            ? getDirectComparison(
                  validMedicines.reduce((a, b) =>
                      (a.mrp ?? Infinity) < (b.mrp ?? Infinity) ? a : b
                  ),
                  validMedicines.reduce((a, b) => ((a.mrp ?? 0) > (b.mrp ?? 0) ? a : b))
              )
            : null;

    const flaggedMedicines = validMedicines.filter((m) => isFlaggedStatus(m.cdsco_approval_status));

    const rows: { label: string; getValue: (m: Medicine) => string }[] = [
        { label: labels.rows.brandName, getValue: (m) => m.brand_name?.trim() || "—" },
        { label: labels.rows.genericName, getValue: (m) => m.generic_name },
        { label: labels.rows.composition, getValue: (m) => m.composition?.trim() || "—" },
        { label: labels.rows.manufacturer, getValue: (m) => m.manufacturer },
        {
            label: labels.rows.type,
            getValue: (m) =>
                m.medicine_type ??
                (m.brand_name?.trim() ? labels.medicineTypes.brand : labels.medicineTypes.generic),
        },
        {
            label: labels.rows.cdscoStatus,
            getValue: (m) => formatStatus(m.cdsco_approval_status, labels),
        },
        { label: labels.rows.expiryDate, getValue: (m) => formatExpiry(m.expiry_date) },
        {
            label: labels.rows.marketPrice,
            getValue: (m) => formatPrice(m.mrp, labels.priceUnavailable),
        },
        {
            label: labels.rows.janAushadhiPrice,
            getValue: (m) => formatPrice(m.jan_aushadhi_price, labels.priceUnavailable),
        },
        { label: labels.rows.savings, getValue: (m) => getSavingsText(m, labels) },
    ];

    return (
        <div className="space-y-4">
            {flaggedMedicines.length > 0 && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-700 bg-red-600 p-4 text-white shadow-sm"
                >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold tracking-wide uppercase">Safety alert</p>
                        {flaggedMedicines.map((m) => (
                            <p key={m.id} className="text-sm font-medium">
                                {displayName(m)} has been flagged as{" "}
                                <span className="font-bold">
                                    {formatStatus(m.cdsco_approval_status, labels)}
                                </span>{" "}
                                by CDSCO.
                            </p>
                        ))}
                    </div>
                </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                {labels.fieldHeader}
                            </th>
                            {validMedicines.map((medicine) => (
                                <th
                                    key={medicine.id}
                                    className="px-5 py-3 text-center text-sm font-semibold text-slate-800"
                                >
                                    {displayName(medicine)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ label, getValue }) => {
                            const isCdsco = label === labels.rows.cdscoStatus;
                            return (
                                <tr key={label} className="border-b border-slate-100 last:border-0">
                                    <td className="px-5 py-3 font-medium text-slate-600">
                                        {label}
                                    </td>
                                    {validMedicines.map((medicine) => (
                                        <td
                                            key={medicine.id}
                                            className="px-5 py-3 text-center text-slate-800"
                                        >
                                            {isCdsco ? (
                                                <CdscoStatusBadge
                                                    status={medicine.cdsco_approval_status}
                                                />
                                            ) : (
                                                getValue(medicine)
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {validMedicines.length >= 2 && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 print:hidden">
                        <button
                            type="button"
                            onClick={() => handleExportCSV(validMedicines, rows)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            aria-label="Export comparison as CSV"
                        >
                            <FileSpreadsheet size={16} />
                            Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExportPDF(validMedicines, rows)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            aria-label="Export comparison as PDF"
                        >
                            <Download size={16} />
                            Export PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => shareComparison(validMedicines[0], validMedicines[1])}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Share Comparison
                        </button>
                    </div>
                )}
                {directComparison && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                        {directComparison.type === "equal" ? (
                            <p className="text-center text-sm text-slate-700">
                                Both medicines have the same market price.
                            </p>
                        ) : (
                            <p className="text-center text-sm font-medium text-slate-800">
                                By choosing{" "}
                                <span className="font-semibold">
                                    {displayName(directComparison.cheaper)}
                                </span>{" "}
                                instead of{" "}
                                <span className="font-semibold">
                                    {displayName(directComparison.expensive)}
                                </span>
                                , you save ₹{directComparison.savings.toFixed(2)}
                                {" ("}
                                {directComparison.percentage.toFixed(1)}
                                %).
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
