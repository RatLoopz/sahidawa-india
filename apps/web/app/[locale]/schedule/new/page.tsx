"use client";

import { useRouter } from "@/i18n/routing";
import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "../../components/PageHeader";
import Card from "@/components/Card";
import MedicineSearchSelect from "@/src/components/MedicineSearchSelect";
import { createSchedule } from "@/lib/scheduleApi";
import { Medicine } from "@/src/components/ComparisonGrid";
import { COMPARE_SELECT_FIELDS } from "@/src/lib/compareSelectFields";
import { supabase } from "@/lib/supabase";
import { mapMedicineRow } from "@/src/lib/mapMedicineRow";

const DEFAULT_TIMES = ["08:00", "20:00"];

async function searchMedicines(query: string): Promise<Medicine[]> {
    // Strip double quotes to prevent breaking the PostgREST filter structure in the .or() builder
    const q = query.replace(/"/g, "").trim();
    if (q.length < 2) return [];

    const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const { data, error } = await supabase
        .from("medicines")
        .select(COMPARE_SELECT_FIELDS)
        .or(`brand_name.ilike."${pattern}",generic_name.ilike."${pattern}"`)
        .limit(25);

    if (error) {
        console.error(error.message);
        return [];
    }
    return ((data ?? []) as Record<string, unknown>[]).map((row) => mapMedicineRow(row));
}

export default function NewSchedulePage() {
    const router = useRouter();
    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
    const [dosage, setDosage] = useState("1 tablet");
    const [frequency, setFrequency] = useState(2);
    const [times, setTimes] = useState<string[]>(DEFAULT_TIMES);
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSearch = useCallback((q: string) => searchMedicines(q), []);

    const handleTimeChange = (index: number, value: string) => {
        const updated = [...times];
        updated[index] = value;
        setTimes(updated);
    };

    const addTime = () => {
        setTimes([...times, "12:00"]);
        setFrequency(times.length + 1);
    };

    const removeTime = (index: number) => {
        if (times.length <= 1) return;
        const updated = times.filter((_, i) => i !== index);
        setTimes(updated);
        setFrequency(updated.length);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!selectedMedicine) {
            setError("Medicine is required");
            return;
        }

        setSaving(true);
        try {
            await createSchedule({
                medicine_name: selectedMedicine.brand_name || selectedMedicine.generic_name,
                medicine_id: selectedMedicine.id,
                dosage: dosage.trim(),
                frequency,
                times,
                start_date: startDate,
                end_date: endDate || null,
                notes: notes.trim() || undefined,
            });
            router.push("/schedule");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create schedule");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-(--color-surface-muted) font-sans text-(--color-text-primary)">
            <PageHeader
                title="Add Medicine"
                subtitle="Set up a new medicine schedule"
                backHref="/schedule"
                variant="light"
            />

            <main className="container mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:px-6 md:py-10">
                <Card className="border-(--color-border-muted) bg-(--color-surface-page) dark:bg-slate-900 dark:border-slate-700">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
                        {error && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <MedicineSearchSelect
                                label="Medicine Name"
                                value={selectedMedicine}
                                onChange={setSelectedMedicine}
                                onSearch={handleSearch}
                                placeholder="e.g. Paracetamol, Amoxicillin"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="dosage"
                                className="text-sm font-bold text-(--color-text-primary)"
                            >
                                Dosage
                            </label>
                            <input
                                id="dosage"
                                type="text"
                                value={dosage}
                                onChange={(e) => setDosage(e.target.value)}
                                placeholder="e.g. 1 tablet, 5ml"
                                className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-(--color-text-primary)">
                                Dose Times
                            </label>
                            <p className="mb-1 text-xs text-(--color-text-secondary)">
                                When do you need to take this medicine?
                            </p>
                            <div className="flex flex-col gap-2">
                                {times.map((time, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) =>
                                                handleTimeChange(index, e.target.value)
                                            }
                                            className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm text-(--color-text-primary) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                                        />
                                        {times.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTime(index)}
                                                className="rounded-full p-1.5 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                aria-label="Remove time"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={addTime}
                                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
                            >
                                <Plus size={14} />
                                Add another time
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="start_date"
                                className="text-sm font-bold text-(--color-text-primary)"
                            >
                                Start Date
                            </label>
                            <input
                                id="start_date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm text-(--color-text-primary) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="end_date"
                                className="text-sm font-bold text-(--color-text-primary)"
                            >
                                End Date{" "}
                                <span className="font-normal text-(--color-text-muted)">
                                    (optional)
                                </span>
                            </label>
                            <input
                                id="end_date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="notes"
                                className="text-sm font-bold text-(--color-text-primary)"
                            >
                                Notes{" "}
                                <span className="font-normal text-(--color-text-muted)">
                                    (optional)
                                </span>
                            </label>
                            <textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Take after food"
                                rows={3}
                                className="rounded-lg border border-(--color-border-muted) bg-(--color-surface-muted) px-3 py-2.5 text-sm text-(--color-text-primary) placeholder-(--color-text-muted) focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Schedule"}
                            </button>
                        </div>
                    </form>
                </Card>
            </main>
        </div>
    );
}
