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

export type ComparisonGridCopy = {
    approved: string;
    banned: string;
    brand: string;
    brandName: string;
    cdscoStatus: string;
    composition: string;
    emptyState: string;
    expiryDate: string;
    field: string;
    generic: string;
    genericName: string;
    janAushadhiPrice: string;
    manufacturer: string;
    marketPrice: string;
    medicineA: string;
    medicineB: string;
    noSavings: string;
    priceUnavailable: string;
    recalled: string;
    savingsVsMrp: string;
    saveAmount: (amount: string, percent: string) => string;
    type: string;
};

const defaultCopy: ComparisonGridCopy = {
    approved: "Approved",
    banned: "Banned",
    brand: "Brand",
    brandName: "Brand name",
    cdscoStatus: "CDSCO status",
    composition: "Composition",
    emptyState: "Select two medicines above to see the comparison.",
    expiryDate: "Expiry date",
    field: "Field",
    generic: "Generic",
    genericName: "Generic name",
    janAushadhiPrice: "Jan Aushadhi price",
    manufacturer: "Manufacturer",
    marketPrice: "Market price (MRP)",
    medicineA: "Medicine A",
    medicineB: "Medicine B",
    noSavings: "No savings",
    priceUnavailable: "Price unavailable",
    recalled: "Recalled",
    savingsVsMrp: "Savings vs MRP",
    saveAmount: (amount, percent) => `Save ${amount} (${percent}%)`,
    type: "Type",
};

function hasValidMrp(m: Medicine | null | undefined): m is Medicine & { mrp: number } {
    return m != null && m.mrp != null && Number.isFinite(m.mrp) && m.mrp >= 0;
}

function formatExpiry(iso: string | null | undefined): string {
    if (!iso) return "-";
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

function formatStatus(status: string, copy: ComparisonGridCopy): string {
    const map: Record<string, string> = {
        approved: copy.approved,
        recalled: copy.recalled,
        banned: copy.banned,
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

function formatPrice(value: number | null | undefined, copy: ComparisonGridCopy): string {
    return value != null ? `₹${value.toFixed(2)}` : copy.priceUnavailable;
}

function getSavingsText(medicine: Medicine | null, copy: ComparisonGridCopy): string {
    if (!medicine || !hasValidMrp(medicine) || !hasValidJanAushadhiPrice(medicine)) {
        return copy.priceUnavailable;
    }

    if (medicine.mrp <= medicine.jan_aushadhi_price) {
        return copy.noSavings;
    }

    const amount = medicine.mrp - medicine.jan_aushadhi_price;
    const percent = computeSavingsPercent(medicine.mrp, medicine.jan_aushadhi_price);
    return copy.saveAmount(`₹${amount.toFixed(2)}`, percent.toFixed(1));
}

export default function ComparisonGrid({
    medicine1,
    medicine2,
    copy = defaultCopy,
}: {
    medicine1: Medicine | null;
    medicine2: Medicine | null;
    copy?: ComparisonGridCopy;
}) {
    if (!medicine1 && !medicine2) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                {copy.emptyState}
            </div>
        );
    }

    const rows: { label: string; getValue: (m: Medicine) => string }[] = [
        { label: copy.brandName, getValue: (m) => m.brand_name?.trim() || "-" },
        { label: copy.genericName, getValue: (m) => m.generic_name },
        { label: copy.composition, getValue: (m) => m.composition?.trim() || "-" },
        { label: copy.manufacturer, getValue: (m) => m.manufacturer },
        {
            label: copy.type,
            getValue: (m) =>
                m.medicine_type
                    ? m.medicine_type === "brand"
                        ? copy.brand
                        : copy.generic
                    : m.brand_name?.trim()
                      ? copy.brand
                      : copy.generic,
        },
        {
            label: copy.cdscoStatus,
            getValue: (m) => formatStatus(m.cdsco_approval_status, copy),
        },
        { label: copy.expiryDate, getValue: (m) => formatExpiry(m.expiry_date) },
        { label: copy.marketPrice, getValue: (m) => formatPrice(m.mrp, copy) },
        {
            label: copy.janAushadhiPrice,
            getValue: (m) => formatPrice(m.jan_aushadhi_price, copy),
        },
        { label: copy.savingsVsMrp, getValue: (m) => getSavingsText(m, copy) },
    ];

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            {copy.field}
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine1 ? displayName(medicine1) : copy.medicineA}
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine2 ? displayName(medicine2) : copy.medicineB}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ label, getValue }) => (
                        <tr key={label} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-medium text-slate-600">{label}</td>
                            <td className="px-5 py-3 text-center text-slate-800">
                                {medicine1 ? getValue(medicine1) : "-"}
                            </td>
                            <td className="px-5 py-3 text-center text-slate-800">
                                {medicine2 ? getValue(medicine2) : "-"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
