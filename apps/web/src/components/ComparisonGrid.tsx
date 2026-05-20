import React from "react";

export interface Medicine {
  id: string;
  brand_name: string | null;
  generic_name: string;
  composition: string | null;
  manufacturer: string;
  mrp?: number | null;
  expiry_date?: string | null;
  medicine_type?: "brand" | "generic";
  cdsco_approval_status: string;
}

function hasValidMrp(m: Medicine | null | undefined): m is Medicine & { mrp: number } {
  return (
    m != null &&
    m.mrp != null &&
    Number.isFinite(m.mrp) &&
    m.mrp > 0
  );
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

function SavingsTag({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <span className="mt-1 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      {percent.toFixed(1)}% lower
    </span>
  );
}

function computeSavingsPercent(higher: number, lower: number): number {
  if (higher <= 0) return 0;
  return ((higher - lower) / higher) * 100;
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

  const m1HasMrp = hasValidMrp(medicine1);
  const m2HasMrp = hasValidMrp(medicine2);
  const bothHaveMrp = m1HasMrp && m2HasMrp;

  const savingsOnCol2 =
    bothHaveMrp && medicine1!.mrp > medicine2!.mrp
      ? computeSavingsPercent(medicine1!.mrp, medicine2!.mrp)
      : 0;

  const savingsOnCol1 =
    bothHaveMrp && medicine2!.mrp > medicine1!.mrp
      ? computeSavingsPercent(medicine2!.mrp, medicine1!.mrp)
      : 0;

  const rows: { label: string; getValue: (m: Medicine) => string }[] = [
    { label: "Brand name", getValue: (m) => m.brand_name?.trim() || "—" },
    { label: "Generic name", getValue: (m) => m.generic_name },
    { label: "Composition", getValue: (m) => m.composition?.trim() || "—" },
    { label: "Manufacturer", getValue: (m) => m.manufacturer },
    {
      label: "Type",
      getValue: (m) =>
        m.medicine_type ?? (m.brand_name?.trim() ? "Brand" : "Generic"),
    },
    {
      label: "CDSCO status",
      getValue: (m) => formatStatus(m.cdsco_approval_status),
    },
    { label: "Expiry date", getValue: (m) => formatExpiry(m.expiry_date) },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="w-1/4 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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

          <tr className="bg-slate-50">
            <td className="px-5 py-3 font-medium text-slate-600">MRP</td>
            <td className="px-5 py-3 text-center">
              {medicine1 ? (
                m1HasMrp ? (
                  <div>
                    <span className="text-lg font-semibold text-slate-900">
                      ₹{medicine1.mrp.toFixed(2)}
                    </span>
                    <SavingsTag percent={savingsOnCol1} />
                  </div>
                ) : (
                  <span className="text-slate-500">Not in database</span>
                )
              ) : (
                "—"
              )}
            </td>
            <td className="px-5 py-3 text-center">
              {medicine2 ? (
                m2HasMrp ? (
                  <div>
                    <span className="text-lg font-semibold text-slate-900">
                      ₹{medicine2.mrp.toFixed(2)}
                    </span>
                    <SavingsTag percent={savingsOnCol2} />
                  </div>
                ) : (
                  <span className="text-slate-500">Not in database</span>
                )
              ) : (
                "—"
              )}
            </td>
          </tr>

          {bothHaveMrp && medicine1 && medicine2 && (
            <tr className="border-t border-slate-200 bg-emerald-50/60">
              <td
                colSpan={3}
                className="px-5 py-3 text-center text-sm text-slate-700"
              >
                {medicine1.mrp === medicine2.mrp ? (
                  "Both medicines have the same listed MRP."
                ) : medicine1.mrp! < medicine2.mrp! ? (
                  <>
                    <span className="font-medium">{displayName(medicine1)}</span>{" "}
                    is ₹{(medicine2.mrp! - medicine1.mrp!).toFixed(2)} less (
                    {savingsOnCol1.toFixed(1)}% vs the other).
                  </>
                ) : (
                  <>
                    <span className="font-medium">{displayName(medicine2)}</span>{" "}
                    is ₹{(medicine1.mrp! - medicine2.mrp!).toFixed(2)} less (
                    {savingsOnCol2.toFixed(1)}% vs the other).
                  </>
                )}
              </td>
            </tr>
          )}

          {medicine1 && medicine2 && !bothHaveMrp && (
            <tr className="border-t border-amber-100 bg-amber-50/50">
              <td
                colSpan={3}
                className="px-5 py-2.5 text-center text-xs text-amber-900"
              >
                Price comparison requires an{" "}
                <code className="rounded bg-amber-100 px-1">mrp</code> column on
                the medicines table.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}