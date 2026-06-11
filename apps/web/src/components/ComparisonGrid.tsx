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

export default function ComparisonGrid({
    medicine1,
    medicine2,
    labels = defaultLabels,
}: {
    medicine1: Medicine | null;
    medicine2: Medicine | null;
    labels?: ComparisonGridLabels;
}) {
    if (!medicine1 && !medicine2) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                {labels.emptyComparison}
            </div>
        );
    }

    const directComparison = getDirectComparison(medicine1, medicine2);

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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            {labels.fieldHeader}
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine1 ? displayName(medicine1) : labels.medicineA}
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine2 ? displayName(medicine2) : labels.medicineB}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ label, getValue }) => (
                        <tr key={label} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-medium text-slate-600">{label}</td>
                            <td className="px-5 py-3 text-center text-slate-800">
                                {medicine1 ? getValue(medicine1) : "—"}
                            </td>
                            <td className="px-5 py-3 text-center text-slate-800">
                                {medicine2 ? getValue(medicine2) : "—"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {medicine1 && medicine2 && (
                <div className="flex justify-end border-t border-slate-200 p-4">
                    <button
                        type="button"
                        onClick={() => shareComparison(medicine1, medicine2)}
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
    );
}
