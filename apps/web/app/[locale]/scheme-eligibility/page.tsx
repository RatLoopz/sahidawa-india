"use client";
import { handleApiError } from "@/lib/apiErrorHandler";
import React, { useState } from "react";
import {
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Printer,
    ArrowRight,
    Info,
    Check,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { checkSchemeEligibility, type EligibleScheme } from "@/lib/api/alternatives";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
];

export default function SchemeEligibilityPage() {
    // Step state: 1 = Demographics, 2 = Income & Family, 3 = Cards, 4 = Results
    const [step, setStep] = useState<number>(1);

    // Form inputs
    const [age, setAge] = useState<string>("35");
    const [state, setState] = useState<string>("Maharashtra");
    const [annualIncome, setAnnualIncome] = useState<string>("120000");
    const [familySize, setFamilySize] = useState<string>("5");
    const [hasBplCard, setHasBplCard] = useState<boolean>(false);
    const [hasAbhaId, setHasAbhaId] = useState<boolean>(false);

    // Results state
    const [loading, setLoading] = useState<boolean>(false);
    const [eligibleSchemes, setEligibleSchemes] = useState<EligibleScheme[]>([]);

    const tSchemeEligibility = useTranslations("SchemeEligibility");

    const handleNext = () => {
        if (step === 1) {
            const parsedAge = parseInt(age, 10);
            if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
                toast.error(tSchemeEligibility("validationAgeError"));
                return;
            }
            if (!state) {
                toast.error(tSchemeEligibility("validationStateError"));
                return;
            }
            setStep(2);
        } else if (step === 2) {
            const parsedIncome = parseFloat(annualIncome);
            const parsedSize = parseInt(familySize, 10);
            if (isNaN(parsedIncome) || parsedIncome < 0) {
                toast.error(tSchemeEligibility("validationIncomeError"));
                return;
            }
            if (isNaN(parsedSize) || parsedSize <= 0 || parsedSize > 30) {
                toast.error(tSchemeEligibility("validationFamilySizeError"));
                return;
            }
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await checkSchemeEligibility({
                age: parseInt(age, 10),
                annual_income: parseFloat(annualIncome),
                family_size: parseInt(familySize, 10),
                state,
                has_bpl_card: hasBplCard,
                has_abha_id: hasAbhaId,
            });
            setEligibleSchemes(res.eligible_schemes);
            setStep(4);
            toast.success(tSchemeEligibility("eligibilityCheckedSuccess"));
        } catch (error) {
            await handleApiError(error, tSchemeEligibility("eligibilityCheckFailed"));
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (typeof window !== "undefined") {
            window.print();
        }
    };

    const handleReset = () => {
        setStep(1);
        setAge("35");
        setState("Maharashtra");
        setAnnualIncome("120000");
        setFamilySize("5");
        setHasBplCard(false);
        setHasAbhaId(false);
        setEligibleSchemes([]);
    };

    return (
        <div className="min-h-screen bg-(--color-surface-muted) font-sans text-(--color-text-primary) transition-colors duration-300">
            {/* Header hidden in print */}
            <div className="no-print">
                <PageHeader backHref="/" variant="light" />
            </div>

            <main className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
                {/* Print Title Block */}
                <div className="mb-8 hidden border-b border-slate-300 pb-6 print:block">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-emerald-800">
                                {tSchemeEligibility("printBrandTitle")}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {tSchemeEligibility("printReportTitle")}
                            </p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                            <p>{tSchemeEligibility("dateGenerated")}: {new Date().toLocaleDateString("en-IN")}</p>
                            <p>{tSchemeEligibility("website")}: www.sahidawa.in</p>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div>
                            <p>
                                <strong>{tSchemeEligibility("age")}:</strong> {age} {tSchemeEligibility("years")}
                            </p>
                            <p>
                                <strong>{tSchemeEligibility("stateOfResidence")}:</strong> {state}
                            </p>
                            <p>
                                <strong>{tSchemeEligibility("annualFamilyIncome")}:</strong> ₹
                                {parseFloat(annualIncome).toLocaleString("en-IN")}
                            </p>
                        </div>
                        <div>
                            <p>
                                <strong>{tSchemeEligibility("familySize")}:</strong> {familySize} {tSchemeEligibility("members")}
                            </p>
                            <p>
                                <strong>{tSchemeEligibility("bplRationCardHolder")}:</strong> {hasBplCard ? tSchemeEligibility("yes") : tSchemeEligibility("no")}
                            </p>
                            <p>
                                <strong>{tSchemeEligibility("abhaHealthIdHolder")}:</strong> {hasAbhaId ? tSchemeEligibility("yes") : tSchemeEligibility("no")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content Box */}
                <div className="relative overflow-hidden rounded-[2.5rem] border border-(--color-border-muted) bg-(--color-surface-page) shadow-2xl print:border-none print:bg-transparent print:shadow-none">
                    {/* Header bar hidden in print */}
                    <div className="no-print absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>

                    <div className="p-8 md:p-12">
                        {/* Page Title - hidden in print */}
                        {step !== 4 && (
                            <div className="no-print mb-8 text-center">
                                <h1 className="text-3xl font-black tracking-tight text-(--color-text-primary) md:text-4xl">
                                    {tSchemeEligibility.rich("title", {
                                        highlight: (chunks) => (
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {chunks}
                                            </span>
                                        ),
                                    })}
                                </h1>
                                <p className="mt-2 text-sm font-medium text-(--color-text-secondary)">
                                    {tSchemeEligibility("description")}
                                </p>
                            </div>
                        )}

                        {/* Step indicator - hidden in print */}
                        {step < 4 && (
                            <div className="no-print mb-8 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                                            step === 1
                                                ? "bg-emerald-600 text-white"
                                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        }`}
                                    >
                                        1
                                    </span>
                                    <span className="hidden text-xs font-bold text-(--color-text-secondary) sm:inline">
                                        {tSchemeEligibility("stepDemographics")}
                                    </span>
                                </div>
                                <div className="mx-4 h-0.5 flex-1 bg-emerald-100 dark:bg-emerald-950/20"></div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                                            step === 2
                                                ? "bg-emerald-600 text-white"
                                                : step > 2
                                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40"
                                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                        }`}
                                    >
                                        2
                                    </span>
                                    <span className="hidden text-xs font-bold text-(--color-text-secondary) sm:inline">
                                        {tSchemeEligibility("stepIncomeFamily")}
                                    </span>
                                </div>
                                <div className="mx-4 h-0.5 flex-1 bg-emerald-100 dark:bg-emerald-950/20"></div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                                            step === 3
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                        }`}
                                    >
                                        3
                                    </span>
                                    <span className="hidden text-xs font-bold text-(--color-text-secondary) sm:inline">
                                        {tSchemeEligibility("stepIdentification")}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Step Forms */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* STEP 1: Basic Demographics */}
                            {step === 1 && (
                                <div className="animate-slideIn no-print space-y-6">
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="age"
                                            className="block text-sm font-bold text-(--color-text-primary)"
                                        >
                                            {tSchemeEligibility("ageLabel")}
                                        </label>
                                        <p className="text-xs text-(--color-text-secondary)">
                                            {tSchemeEligibility("ageDescription")}
                                        </p>
                                        <input
                                            type="number"
                                            id="age"
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                            placeholder={tSchemeEligibility("agePlaceholder")}
                                            className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-5 py-4 text-base font-medium outline-hidden transition-all focus:border-emerald-500 focus:bg-(--color-surface-page) dark:bg-slate-800/50"
                                            min="1"
                                            max="120"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label
                                            htmlFor="state"
                                            className="block text-sm font-bold text-(--color-text-primary)"
                                        >
                                            {tSchemeEligibility("stateLabel")}
                                        </label>
                                        <p className="text-xs text-(--color-text-secondary)">
                                            {tSchemeEligibility("stateDescription")}
                                        </p>
                                        <select
                                            id="state"
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-5 py-4 text-base font-medium outline-hidden transition-all focus:border-emerald-500 focus:bg-(--color-surface-page) dark:bg-slate-800/50"
                                            required
                                        >
                                            {INDIAN_STATES.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Income & Family */}
                            {step === 2 && (
                                <div className="animate-slideIn no-print space-y-6">
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="annualIncome"
                                            className="block text-sm font-bold text-(--color-text-primary)"
                                        >
                                            {tSchemeEligibility("incomeLabel")}
                                        </label>
                                        <p className="text-xs text-(--color-text-secondary)">
                                            {tSchemeEligibility("incomeDescription")}
                                        </p>
                                        <div className="relative">
                                            <span className="absolute top-1/2 left-5 -translate-y-1/2 text-base font-bold text-(--color-text-secondary)">
                                                ₹
                                            </span>
                                            <input
                                                type="number"
                                                id="annualIncome"
                                                value={annualIncome}
                                                onChange={(e) => setAnnualIncome(e.target.value)}
                                                placeholder={tSchemeEligibility("incomePlaceholder")}
                                                className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) py-4 pr-5 pl-10 text-base font-medium outline-hidden transition-all focus:border-emerald-500 focus:bg-(--color-surface-page) dark:bg-slate-800/50"
                                                min="0"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label
                                            htmlFor="familySize"
                                            className="block text-sm font-bold text-(--color-text-primary)"
                                        >
                                            {tSchemeEligibility("familySizeLabel")}
                                        </label>
                                        <p className="text-xs text-(--color-text-secondary)">
                                            {tSchemeEligibility("familySizeDescription")}
                                        </p>
                                        <input
                                            type="number"
                                            id="familySize"
                                            value={familySize}
                                            onChange={(e) => setFamilySize(e.target.value)}
                                            placeholder={tSchemeEligibility("familySizePlaceholder")}
                                            className="w-full rounded-2xl border border-(--color-border-muted) bg-(--color-surface-muted) px-5 py-4 text-base font-medium outline-hidden transition-all focus:border-emerald-500 focus:bg-(--color-surface-page) dark:bg-slate-800/50"
                                            min="1"
                                            max="30"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Identification */}
                            {step === 3 && (
                                <div className="animate-slideIn no-print space-y-6">
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-(--color-text-primary)">
                                            {tSchemeEligibility("bplQuestion")}
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setHasBplCard(true)}
                                                className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-base font-bold transition-all ${
                                                    hasBplCard
                                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                        : "border-(--color-border-muted) bg-(--color-surface-muted) hover:bg-(--color-border-muted)"
                                                }`}
                                            >
                                                {hasBplCard && <Check size={18} />}
                                                <span>{tSchemeEligibility("yesOption")}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHasBplCard(false)}
                                                className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-base font-bold transition-all ${
                                                    !hasBplCard
                                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                        : "border-(--color-border-muted) bg-(--color-surface-muted) hover:bg-(--color-border-muted)"
                                                }`}
                                            >
                                                {!hasBplCard && <Check size={18} />}
                                                <span>{tSchemeEligibility("noOption")}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-(--color-text-primary)">
                                            {tSchemeEligibility("abhaQuestion")}
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setHasAbhaId(true)}
                                                className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-base font-bold transition-all ${
                                                    hasAbhaId
                                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                        : "border-(--color-border-muted) bg-(--color-surface-muted) hover:bg-(--color-border-muted)"
                                                }`}
                                            >
                                                {hasAbhaId && <Check size={18} />}
                                                <span>{tSchemeEligibility("yesOption")}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHasAbhaId(false)}
                                                className={`flex items-center justify-center gap-2 rounded-2xl border py-4 text-base font-bold transition-all ${
                                                    !hasAbhaId
                                                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                        : "border-(--color-border-muted) bg-(--color-surface-muted) hover:bg-(--color-border-muted)"
                                                }`}
                                            >
                                                {!hasAbhaId && <Check size={18} />}
                                                <span>{tSchemeEligibility("noOption")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Navigation buttons - hidden in print */}
                            {step < 4 && (
                                <div className="no-print mt-8 flex items-center justify-between border-t border-(--color-border-muted) pt-6">
                                    {step > 1 ? (
                                        <button
                                            type="button"
                                            onClick={handleBack}
                                            className="flex items-center gap-2 rounded-2xl border border-(--color-border-muted) px-6 py-3.5 text-sm font-bold hover:bg-(--color-surface-muted)"
                                        >
                                            <ChevronLeft size={16} />
                                            <span>{tSchemeEligibility("backButton")}</span>
                                        </button>
                                    ) : (
                                        <div />
                                    )}

                                    {step < 3 ? (
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-500"
                                        >
                                            <span>{tSchemeEligibility("nextButton")}</span>
                                            <ChevronRight size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                    <span>{tSchemeEligibility("checkingButton")}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{tSchemeEligibility("findSchemesButton")}</span>
                                                    <ArrowRight size={16} />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>

                        {/* STEP 4: Results Screen */}
                        {step === 4 && (
                            <div className="animate-slideIn space-y-8">
                                {/* Success Header - hidden in print */}
                                <div className="no-print text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                        <CheckCircle size={32} strokeWidth={2.5} />
                                    </div>
                                    <h2 className="text-3xl font-black text-(--color-text-primary)">
                                        {tSchemeEligibility("resultsTitle")}
                                    </h2>
                                    <p className="mt-2 text-sm font-medium text-(--color-text-secondary)">
                                        {tSchemeEligibility.rich("resultsDescription", {
                                            count: eligibleSchemes.length,
                                            countTag: (chunks) => (
                                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                                    {chunks}
                                                </span>
                                            ),
                                        })}
                                    </p>
                                </div>

                                {/* Schemes List */}
                                <div className="space-y-6">
                                    {eligibleSchemes.map((scheme, idx) => (
                                        <div
                                            key={idx}
                                            className="print:border-slate-350 relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-linear-to-b from-white to-emerald-50/5 p-6 shadow-md dark:border-emerald-500/10 dark:from-slate-900 print:bg-white print:shadow-none"
                                        >
                                            <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-500 print:hidden"></div>

                                            <div className="flex flex-col space-y-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-300 print:text-slate-800">
                                                            {scheme.name}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-(--color-text-secondary) print:text-slate-600">
                                                            {scheme.description}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 print:border print:border-slate-300 print:bg-slate-100 print:text-slate-700">
                                                        {tSchemeEligibility("eligibleBadge")}
                                                    </span>
                                                </div>

                                                {/* Coverage Callout */}
                                                <div className="border-emerald-250 rounded-2xl border bg-emerald-50/40 p-4 dark:border-emerald-900/20 dark:bg-emerald-950/10 print:border-slate-300 print:bg-slate-50">
                                                    <h4 className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400 print:text-slate-700">
                                                        {tSchemeEligibility("benefitsCoverage")}
                                                    </h4>
                                                    <p className="mt-1 text-sm font-extrabold text-emerald-900 dark:text-emerald-300 print:text-slate-900">
                                                        {scheme.coverage}
                                                    </p>
                                                </div>

                                                {/* How to Apply */}
                                                <div>
                                                    <h4 className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase print:text-slate-700">
                                                        {tSchemeEligibility("howToApply")}
                                                    </h4>
                                                    <p className="mt-1 text-sm leading-relaxed text-(--color-text-primary) print:text-slate-700">
                                                        {scheme.how_to_apply}
                                                    </p>
                                                </div>

                                                {/* Portal Link - hidden in print */}
                                                <div className="no-print pt-2">
                                                    <a
                                                        href={scheme.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 px-4 py-2 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400"
                                                    >
                                                        <span>{tSchemeEligibility("visitOfficialPortal")}</span>
                                                        <ChevronRight size={14} />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {eligibleSchemes.length === 0 && (
                                        <div className="rounded-3xl border border-(--color-border-muted) bg-(--color-surface-muted) p-8 text-center">
                                            <Info
                                                size={36}
                                                className="mx-auto mb-2 text-(--color-text-muted)"
                                            />
                                            <p className="font-bold text-(--color-text-primary)">
                                                {tSchemeEligibility("noSchemesTitle")}
                                            </p>
                                            <p className="text-sm text-(--color-text-secondary)">
                                                {tSchemeEligibility("noSchemesDescription")}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Results Action buttons - hidden in print */}
                                <div className="no-print flex flex-col gap-4 border-t border-(--color-border-muted) pt-8 sm:flex-row">
                                    <button
                                        onClick={handlePrint}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/15 hover:bg-emerald-500"
                                    >
                                        <Printer size={16} />
                                        <span>{tSchemeEligibility("printPdfButton")}</span>
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-(--color-border-muted) py-3.5 text-sm font-black hover:bg-(--color-surface-muted)"
                                    >
                                        <span>{tSchemeEligibility("checkAgainButton")}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
