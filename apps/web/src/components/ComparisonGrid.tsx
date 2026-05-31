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

function formatStatus(status: string): string {
    const map: Record<string, string> = {
        approved: "Approved",
        recalled: "Recalled",
        banned: "Banned",
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

function formatPrice(value: number | null | undefined): string {
    return value != null ? `₹${value.toFixed(2)}` : "Price unavailable";
}

function getSavingsText(medicine: Medicine | null): string {
    if (!medicine || !hasValidMrp(medicine) || !hasValidJanAushadhiPrice(medicine)) {
        return "Price unavailable";
    }

    if (medicine.mrp <= medicine.jan_aushadhi_price) {
        return "No savings";
    }

    const amount = medicine.mrp - medicine.jan_aushadhi_price;
    const percent = computeSavingsPercent(medicine.mrp, medicine.jan_aushadhi_price);
    return `Save ₹${amount.toFixed(2)} (${percent.toFixed(1)}%)`;
}

export default function ComparisonGrid({
    medicine1,
    medicine2,
}: {
    medicine1: Medicine | null;
    medicine2: Medicine | null;
}) {
    if (!medicine1 && !medicine2) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center text-slate-500">
                Select two medicines above to see the comparison.
            </div>
        );
    }

    const rows: { label: string; getValue: (m: Medicine) => string }[] = [
        { label: "Brand name", getValue: (m) => m.brand_name?.trim() || "—" },
        { label: "Generic name", getValue: (m) => m.generic_name },
        { label: "Composition", getValue: (m) => m.composition?.trim() || "—" },
        { label: "Manufacturer", getValue: (m) => m.manufacturer },
        {
            label: "Type",
            getValue: (m) => m.medicine_type ?? (m.brand_name?.trim() ? "Brand" : "Generic"),
        },
        {
            label: "CDSCO status",
            getValue: (m) => formatStatus(m.cdsco_approval_status),
        },
        { label: "Expiry date", getValue: (m) => formatExpiry(m.expiry_date) },
        { label: "Market price (MRP)", getValue: (m) => formatPrice(m.mrp) },
        {
            label: "Jan Aushadhi price",
            getValue: (m) => formatPrice(m.jan_aushadhi_price),
        },
        { label: "Savings vs MRP", getValue: (m) => getSavingsText(m) },
    ];

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Field
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine1 ? displayName(medicine1) : "Medicine A"}
                        </th>
                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-800">
                            {medicine2 ? displayName(medicine2) : "Medicine B"}
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
        </div>
    );
}
