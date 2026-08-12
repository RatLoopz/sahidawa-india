"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    PharmacyPartnerRegistrationSchema,
    PharmacyPartnerRegistrationInput,
} from "@sahidawa/validators";
import { registerPartner } from "../../../lib/api/partner";
import { PageHeader } from "../components/PageHeader";
import {
    Store,
    CheckCircle,
    AlertCircle,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Users,
    ArrowRight,
} from "lucide-react";

export default function PartnerRegistrationPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [pincodeLoading, setPincodeLoading] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<PharmacyPartnerRegistrationInput>({
        resolver: zodResolver(PharmacyPartnerRegistrationSchema),
        defaultValues: {
            pharmacy_name: "",
            pharmacist_name: "",
            license_number: "",
            phone_number: "",
            email: "",
            address: "",
            city: "",
            state: "",
            pincode: "",
        },
    });

    const pincode = watch("pincode");

    // Auto-fetch city/state on valid pincode entry
    useEffect(() => {
        if (pincode && /^[0-9]{6}$/.test(pincode)) {
            const fetchLocation = async () => {
                setPincodeLoading(true);
                try {
                    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
                    const data = await response.json();
                    if (data && data[0] && data[0].Status === "Success") {
                        const postOffice = data[0].PostOffice[0];
                        if (postOffice) {
                            setValue("city", postOffice.District, { shouldValidate: true });
                            setValue("state", postOffice.State, { shouldValidate: true });
                        }
                    }
                } catch (err) {
                    console.error("Error fetching pincode data:", err);
                } finally {
                    setPincodeLoading(false);
                }
            };
            fetchLocation();
        }
    }, [pincode, setValue]);

    const onSubmit = async (data: PharmacyPartnerRegistrationInput) => {
        setIsSubmitting(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            const result = await registerPartner(data);
            if (result.success) {
                setSuccessMessage(result.message || "Registration successful!");
            } else {
                setErrorMessage(result.error || "Registration failed.");
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Something went wrong.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (successMessage) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 text-(--color-text-primary) dark:from-slate-950 dark:to-slate-900">
                <PageHeader backHref="/" variant="light" hideBackButton />
                <div className="mx-auto max-w-2xl px-4 py-24 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <CheckCircle className="h-12 w-12" />
                    </div>
                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight">
                        Registration Received!
                    </h1>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                        <p className="text-lg font-medium text-emerald-800 dark:text-emerald-300">
                            {successMessage}
                        </p>
                    </div>
                    <p className="mx-auto mt-6 max-w-md text-(--color-text-secondary)">
                        Our compliance team will verify your Drug License certificate details. You
                        will receive an SMS and Email confirmation once approved.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                        <a
                            href="/"
                            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                        >
                            Return Home
                        </a>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-(--color-text-primary) dark:from-slate-950 dark:to-slate-900">
            <PageHeader backHref="/" variant="light" hideBackButton />

            {/* Header section with modern background */}
            <div className="relative overflow-hidden bg-slate-900 py-16 text-white dark:bg-black">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_40%)]" />
                <div className="relative z-10 mx-auto max-w-6xl px-4">
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
                            <Store className="h-6 w-6" />
                        </span>
                        <span className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">
                            SahiDawa Partner network
                        </span>
                    </div>
                    <h1 className="text-center text-4xl font-black tracking-tight sm:text-5xl">
                        Grow Your Pharmacy, <span className="text-emerald-400">Digitally</span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-300">
                        Register as a verified pharmacy partner to list generic stock, display your
                        verified badge, and connect directly with local patients.
                    </p>
                </div>
            </div>

            <section className="mx-auto max-w-6xl px-4 py-16">
                <div className="grid items-start gap-12 lg:grid-cols-12">
                    {/* Left Column: Benefits & Trust elements */}
                    <div className="space-y-8 lg:col-span-5">
                        <div>
                            <h2 className="mb-2 text-2xl font-bold">Why partner with SahiDawa?</h2>
                            <p className="text-(--color-text-secondary)">
                                We bridge the gap between rural/urban patients looking for
                                affordable, high-quality generic substitutions and verified local
                                chemists.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <Users className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Acquire New Customers</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Get discovered by patients looking for specific generic
                                        alternatives (Jan Aushadhi equivalents) right in your
                                        neighborhood.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Verified Partner Badge</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Stand out on SahiDawa's interactive map with a verified
                                        green badge, building ultimate trust with patients.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <TrendingUp className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Upload Stock & Pricing</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Upload your medicine inventories via CSV to let nearby users
                                        know what is in stock in real-time.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wider text-(--color-text-muted) uppercase">
                                <Sparkles className="h-4 w-4 text-amber-500" /> Free Registration
                            </h4>
                            <p className="text-sm text-(--color-text-secondary)">
                                Listing on SahiDawa is 100% free. We do not charge commissions or
                                subscription fees. Our mission is to democratize generic healthcare
                                in India.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Registration Form */}
                    <div className="lg:col-span-7">
                        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10 dark:border-slate-800/80 dark:bg-slate-900">
                            <div className="mb-8">
                                <h3 className="text-xl font-bold">Apply for Verification</h3>
                                <p className="mt-1 text-sm text-(--color-text-secondary)">
                                    Fields marked with (*) are required
                                </p>
                            </div>

                            {errorMessage && (
                                <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200/50 bg-red-50 p-4 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <p className="text-sm font-medium">{errorMessage}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            Pharmacy Name *
                                        </label>
                                        <input
                                            {...register("pharmacy_name")}
                                            placeholder="e.g. Apollo Pharmacy"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                        />
                                        {errors.pharmacy_name && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.pharmacy_name.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            Pharmacist Name *
                                        </label>
                                        <input
                                            {...register("pharmacist_name")}
                                            placeholder="e.g. Dr. Rajesh Kumar"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                        />
                                        {errors.pharmacist_name && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.pharmacist_name.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                        Drug License Number *
                                    </label>
                                    <input
                                        {...register("license_number")}
                                        placeholder="e.g. DL-12345-XX"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                    />
                                    {errors.license_number && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {errors.license_number.message}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-6 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            Phone Number *
                                        </label>
                                        <input
                                            {...register("phone_number")}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                            placeholder="10-digit Mobile number"
                                        />
                                        {errors.phone_number && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.phone_number.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            Email Address
                                        </label>
                                        <input
                                            {...register("email")}
                                            placeholder="e.g. contact@pharmacy.com"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                        />
                                        {errors.email && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.email.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                        Full Address *
                                    </label>
                                    <textarea
                                        {...register("address")}
                                        rows={3}
                                        placeholder="Shop number, Street, Locality"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                    />
                                    {errors.address && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {errors.address.message}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-6 sm:grid-cols-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            Pincode *
                                        </label>
                                        <div className="relative">
                                            <input
                                                {...register("pincode")}
                                                placeholder="6-digits"
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                            />
                                            {pincodeLoading && (
                                                <span className="absolute top-3 right-3 h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                            )}
                                        </div>
                                        {errors.pincode && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.pincode.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            City *
                                        </label>
                                        <input
                                            {...register("city")}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                        />
                                        {errors.city && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.city.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                            State *
                                        </label>
                                        <input
                                            {...register("state")}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                        />
                                        {errors.state && (
                                            <p className="mt-1 text-xs text-red-500">
                                                {errors.state.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-500 focus:ring-4 focus:ring-emerald-500/20 focus:outline-none active:scale-[0.98] disabled:opacity-70 dark:focus:ring-emerald-800"
                                >
                                    {isSubmitting
                                        ? "Submitting Application..."
                                        : "Submit Verification Application"}
                                    {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
