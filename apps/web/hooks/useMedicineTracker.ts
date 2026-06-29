/**
 * useMedicineTracker.ts
 * Custom hook that owns all medicine CRUD state, data-persistence, and notification logic.
 *
 * Auth path  → reads/writes to Supabase table `expiry_tracker_items`
 * Guest path → reads/writes to localStorage key `sahidawa_expiry_tracker`
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
    syncMedicinesToIndexedDB,
    checkAndTriggerLocalNotifications as checkAndTriggerNotificationsHelper,
    cancelNotificationsForMedicine,
} from "@/lib/expiry-notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Medicine {
    id: string;
    name: string;
    expiryDate: string;
    batchNumber?: string;
    notes?: string;
}

export interface AddMedicineFields {
    name: string;
    expiryDate: string;
    batchNumber?: string;
    notes?: string;
}

export interface UseMedicineTrackerReturn {
    medicines: Medicine[];
    userId: string | null;
    isLoaded: boolean;
    addMedicine: (fields: AddMedicineFields) => Promise<void>;
    editMedicine: (id: string, fields: AddMedicineFields) => Promise<void>;
    deleteMedicine: (id: string) => Promise<void>;
    bulkDeleteMedicines: (ids: string[]) => Promise<void>;
    importMedicines: (newItems: Medicine[]) => Promise<void>;
}

// ─── Local-storage helpers ────────────────────────────────────────────────────

const LS_KEY = "sahidawa_expiry_tracker";

function lsRead(): Medicine[] {
    try {
        if (typeof window === "undefined") return [];
        const raw = window.localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) as Medicine[]) : [];
    } catch {
        return [];
    }
}

function lsWrite(list: Medicine[]): void {
    try {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(LS_KEY, JSON.stringify(list));
        }
    } catch (e) {
        console.error("Failed to save medicines to localStorage:", e);
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMedicineTracker(): UseMedicineTrackerReturn {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const scheduleNotificationsForMedicine = async (medicine: Medicine) => {
        await checkAndTriggerNotificationsHelper([medicine]);
    };

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        const loadData = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                let loadedMedicines: Medicine[] = [];

                if (session?.user) {
                    setUserId(session.user.id);

                    const { data, error } = await supabase
                        .from("expiry_tracker_items")
                        .select("*")
                        .order("created_at", { ascending: false });

                    if (!error && data) {
                        loadedMedicines = data.map((item) => ({
                            id: item.id as string,
                            name: item.brand_name as string,
                            expiryDate: item.expiry_date as string,
                            batchNumber: (item.batch_number as string) ?? "",
                            notes: (item.notes as string) ?? "",
                        }));
                    }
                } else {
                    loadedMedicines = lsRead();
                }

                setMedicines(loadedMedicines);
                checkAndTriggerNotificationsHelper(loadedMedicines);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoaded(true);
            }
        };

        loadData();
    }, []);

    // Sync medicines to IndexedDB whenever the list updates
    useEffect(() => {
        if (isLoaded) {
            syncMedicinesToIndexedDB(medicines);
        }
    }, [medicines, isLoaded]);

    // ── Add ───────────────────────────────────────────────────────────────────
    const addMedicine = useCallback(
        async ({ name, expiryDate, batchNumber, notes }: AddMedicineFields) => {
            if (userId) {
                const { data, error } = await supabase
                    .from("expiry_tracker_items")
                    .insert({
                        user_id: userId,
                        brand_name: name,
                        batch_number: batchNumber || null,
                        expiry_date: expiryDate,
                        notes: notes || null,
                    })
                    .select()
                    .single();

                if (!error && data) {
                    const newMed: Medicine = {
                        id: data.id as string,
                        name: data.brand_name as string,
                        expiryDate: data.expiry_date as string,
                        batchNumber: (data.batch_number as string) ?? "",
                        notes: (data.notes as string) ?? "",
                    };
                    setMedicines((prev) => [...prev, newMed]);
                    scheduleNotificationsForMedicine(newMed);
                }
            } else {
                const newMed: Medicine = {
                    id: Date.now().toString(),
                    name,
                    expiryDate,
                    batchNumber,
                    notes,
                };
                setMedicines((prev) => {
                    const updated = [...prev, newMed];
                    lsWrite(updated);
                    return updated;
                });
                scheduleNotificationsForMedicine(newMed);
            }
        },
        [userId]
    );

    // ── Edit ──────────────────────────────────────────────────────────────────
    const editMedicine = useCallback(
        async (id: string, { name, expiryDate, batchNumber, notes }: AddMedicineFields) => {
            const updatedMed = { id, name, expiryDate, batchNumber, notes };

            if (userId) {
                const { error } = await supabase
                    .from("expiry_tracker_items")
                    .update({
                        brand_name: name,
                        batch_number: batchNumber || null,
                        expiry_date: expiryDate,
                        notes: notes || null,
                    })
                    .eq("id", id);

                if (!error) {
                    setMedicines((prev) => prev.map((m) => (m.id === id ? updatedMed : m)));
                    await cancelNotificationsForMedicine(id);
                    scheduleNotificationsForMedicine(updatedMed);
                }
            } else {
                setMedicines((prev) => {
                    const updated = prev.map((m) => (m.id === id ? updatedMed : m));
                    lsWrite(updated);
                    return updated;
                });
                await cancelNotificationsForMedicine(id);
                scheduleNotificationsForMedicine(updatedMed);
            }
        },
        [userId]
    );

    // ── Delete ────────────────────────────────────────────────────────────────
    const deleteMedicine = useCallback(
        async (id: string) => {
            if (userId) {
                const itemToDelete = medicines.find((med) => med.id === id);
                await supabase.from("expiry_tracker_items").delete().eq("id", id);

                const saved = localStorage.getItem("sahidawa_expiry_tracker");
                if (saved) {
                    try {
                        const localMeds: Medicine[] = JSON.parse(saved);
                        const updatedLocal = localMeds.filter((med) => {
                            const isMatch =
                                med.id === id ||
                                (itemToDelete &&
                                    med.name === itemToDelete.name &&
                                    med.expiryDate === itemToDelete.expiryDate &&
                                    med.batchNumber === itemToDelete.batchNumber);
                            return !isMatch;
                        });
                        localStorage.setItem(
                            "sahidawa_expiry_tracker",
                            JSON.stringify(updatedLocal)
                        );
                    } catch (e) {
                        console.error("Failed to clean up localStorage on delete:", e);
                    }
                }

                setMedicines((prev) => prev.filter((m) => m.id !== id));
            } else {
                setMedicines((prev) => {
                    const updated = prev.filter((m) => m.id !== id);
                    lsWrite(updated);
                    return updated;
                });
            }
            cancelNotificationsForMedicine(id);
        },
        [userId, medicines]
    );

    // ── Bulk Delete ───────────────────────────────────────────────────────────
    const bulkDeleteMedicines = useCallback(
        async (ids: string[]) => {
            if (userId) {
                await supabase.from("expiry_tracker_items").delete().in("id", ids);
                setMedicines((prev) => prev.filter((m) => !ids.includes(m.id)));
            } else {
                setMedicines((prev) => {
                    const updated = prev.filter((m) => !ids.includes(m.id));
                    lsWrite(updated);
                    return updated;
                });
            }
            ids.forEach((id) => {
                cancelNotificationsForMedicine(id);
            });
        },
        [userId]
    );

    // ── Import ────────────────────────────────────────────────────────────────
    const importMedicines = useCallback(
        async (newItems: Medicine[]) => {
            if (userId) {
                const rowsToInsert = newItems.map((item) => ({
                    user_id: userId,
                    brand_name: item.name,
                    batch_number: item.batchNumber || null,
                    expiry_date: item.expiryDate,
                    notes: item.notes || null,
                }));

                const { data, error } = await supabase
                    .from("expiry_tracker_items")
                    .insert(rowsToInsert)
                    .select();

                if (!error && data) {
                    const mapped = data.map((item) => ({
                        id: item.id as string,
                        name: item.brand_name as string,
                        expiryDate: item.expiry_date as string,
                        batchNumber: (item.batch_number as string) ?? "",
                        notes: (item.notes as string) ?? "",
                    }));
                    setMedicines((prev) => {
                        const updated = [...prev, ...mapped];
                        checkAndTriggerNotificationsHelper(updated);
                        return updated;
                    });
                } else {
                    throw new Error("Failed to import to Supabase");
                }
            } else {
                setMedicines((prev) => {
                    const updated = [...prev, ...newItems];
                    lsWrite(updated);
                    checkAndTriggerNotificationsHelper(updated);
                    return updated;
                });
            }
        },
        [userId]
    );

    return {
        medicines,
        userId,
        isLoaded,
        addMedicine,
        editMedicine,
        deleteMedicine,
        bulkDeleteMedicines,
        importMedicines,
    };
}
