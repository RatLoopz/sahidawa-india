"use client";

import { CalendarDays, Download, Pill, Printer, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "../components/PageHeader";
import Footer from "../components/Footer";

type MedicineComparison = {
    brandName: string;
    genericName: string;
    manufacturer: string;
    strength: string;
    packSize: string;
    batchNumber: string;
    verifiedStatus: string;
    listedPrice: string;
    janAushadhiPrice: string;
    savings: string;
};

const comparisonRows: MedicineComparison[] = [
    {
        brandName: "Dolo 650",
        genericName: "Paracetamol",
        manufacturer: "Micro Labs Ltd.",
        strength: "650 mg",
        packSize: "15 tablets",
        batchNumber: "DL650A24",
        verifiedStatus: "CDSCO verified",
        listedPrice: "INR 33.60",
        janAushadhiPrice: "INR 14.00",
        savings: "58%",
    },
    {
        brandName: "Azithral 500",
        genericName: "Azithromycin",
        manufacturer: "Alembic Pharmaceuticals",
        strength: "500 mg",
        packSize: "3 tablets",
        batchNumber: "AZ500B11",
        verifiedStatus: "CDSCO verified",
        listedPrice: "INR 119.50",
        janAushadhiPrice: "INR 42.00",
        savings: "65%",
    },
    {
        brandName: "Pantocid 40",
        genericName: "Pantoprazole",
        manufacturer: "Sun Pharma",
        strength: "40 mg",
        packSize: "15 tablets",
        batchNumber: "PN40C07",
        verifiedStatus: "CDSCO verified",
        listedPrice: "INR 168.00",
        janAushadhiPrice: "INR 31.50",
        savings: "81%",
    },
];

const generatedOn = "19 May 2026";

export default function ComparePage() {
    return (
        <div className="print-page flex min-h-screen flex-col bg-slate-50 text-slate-950">
            <PageHeader
                title="Medicine Compare"
                subtitle="Verified price receipt"
                backHref="/"
                variant="light"
            />

            <main className="print-container mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="print-receipt rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                <ShieldCheck size={14} />
                                Verified medicine report
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-950">
                                Medicine Price Comparison
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Printable comparison for health volunteers to share lower-cost
                                equivalent medicine options with patients.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <CalendarDays size={16} />
                                Generated: {generatedOn}
                            </div>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="no-print inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                            >
                                <Printer size={16} />
                                Print receipt
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                                Medicines checked
                            </p>
                            <p className="mt-2 text-3xl font-black text-slate-950">
                                {comparisonRows.length}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                                Report type
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-950">
                                Price comparison
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                                Use case
                            </p>
                            <p className="mt-2 text-lg font-black text-slate-950">
                                Patient handout
                            </p>
                        </div>
                    </div>
                </section>

                <section className="comparison-grid grid gap-5 lg:grid-cols-3">
                    {comparisonRows.map((medicine) => (
                        <article
                            key={medicine.batchNumber}
                            className="comparison-card rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                    <Pill size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-950">
                                        {medicine.brandName}
                                    </h2>
                                    <p className="text-sm font-semibold text-slate-500">
                                        {medicine.genericName}
                                    </p>
                                </div>
                            </div>

                            <table className="mt-4 text-sm">
                                <tbody>
                                    <tr>
                                        <th scope="row">Manufacturer</th>
                                        <td>{medicine.manufacturer}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Strength</th>
                                        <td>{medicine.strength}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Pack size</th>
                                        <td>{medicine.packSize}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Batch</th>
                                        <td>{medicine.batchNumber}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Status</th>
                                        <td>{medicine.verifiedStatus}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Market price</th>
                                        <td>{medicine.listedPrice}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Jan Aushadhi</th>
                                        <td>{medicine.janAushadhiPrice}</td>
                                    </tr>
                                    <tr>
                                        <th scope="row">Potential saving</th>
                                        <td>{medicine.savings}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </article>
                    ))}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-black text-slate-950">Volunteer note</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Prices are examples for print layout verification. Confirm medicine, dosage,
                        substitution, and final pricing with a licensed pharmacist or doctor before
                        changing treatment.
                    </p>
                    <div className="no-print mt-4 flex flex-wrap gap-3">
                        <Link
                            href="/scan"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                            <Pill size={16} />
                            Verify another medicine
                        </Link>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                            <Download size={16} />
                            Save as PDF
                        </button>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
