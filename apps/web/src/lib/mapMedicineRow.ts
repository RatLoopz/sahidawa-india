import type { Medicine } from "../components/ComparisonGrid";

export function mapMedicineRow(
  row: Record<string, unknown>
): Medicine {
  return {
    id: String(row.id ?? ""),
    brand_name: String(row.brand_name ?? ""),
    generic_name: String(row.generic_name ?? ""),
    composition: String(row.composition ?? ""),
    manufacturer: String(row.manufacturer ?? ""),
    cdsco_approval_status: String(
      row.cdsco_approval_status ?? ""
    ),
    expiry_date: row.expiry_date
      ? String(row.expiry_date)
      : undefined,
  };
}