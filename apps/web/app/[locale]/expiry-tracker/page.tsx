"use client";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "../components/PageHeader";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { verifyMedicine } from "@/lib/api";
import { toast } from "sonner";
import { ExpiryForm } from "./components/ExpiryForm";
import { ExpiryModal } from "./components/ExpiryModal";
import { ExpirySummary } from "./components/ExpirySummary";
import { ExpiryTable } from "./components/ExpiryTable";
import { formatDateInputValue, isValidDateString, parseLocalDate } from "./components/dateUtils";
import type { FilterStatus, Medicine, SortOption } from "./components/types";

export default function ExpiryTrackerPage() {
    const t = useTranslations("ExpiryTracker");
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [batchNumber, setBatchNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [dateError, setDateError] = useState("");
    const [isExpired, setIsExpired] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("expirySoonest");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [importError, setImportError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<string>("default");

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const requestNotificationPermission = async () => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return "unsupported";
        }
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === "granted") {
                toast.success(
                    "Notifications enabled! You will be alerted before medicines expire."
                );
                // Schedule notifications for all loaded medicines
                medicines.forEach((med) => {
                    scheduleNotificationsForMedicine(med);
                });
            } else if (permission === "denied") {
                toast.error(
                    "Notification permission denied. Please enable alerts in your browser settings."
                );
            }
            return permission;
        } catch (error) {
            console.error("Error requesting notification permission:", error);
            return Notification.permission;
        }
    };

    const getNotificationTargets = (expiryDateStr: string) => {
        const expiryDate = parseLocalDate(expiryDateStr);

        // 7 days before
        const sevenDaysBefore = new Date(expiryDate);
        sevenDaysBefore.setDate(expiryDate.getDate() - 7);
        sevenDaysBefore.setHours(9, 0, 0, 0); // 9 AM

        // 1 day before
        const oneDayBefore = new Date(expiryDate);
        oneDayBefore.setDate(expiryDate.getDate() - 1);
        oneDayBefore.setHours(9, 0, 0, 0); // 9 AM

        return { sevenDaysBefore, oneDayBefore };
    };

    const scheduleNotificationsForMedicine = async (medicine: Medicine) => {
        if (
            typeof window === "undefined" ||
            !("Notification" in window) ||
            Notification.permission !== "granted"
        ) {
            return;
        }

        const { sevenDaysBefore, oneDayBefore } = getNotificationTargets(medicine.expiryDate);
        const now = new Date();

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Check if TimestampTrigger is supported (experimental Notification Trigger API)
        const isTimestampTriggerSupported =
            typeof window !== "undefined" && "TimestampTrigger" in window;

        // 7 days before notification
        if (sevenDaysBefore > now) {
            const title = `Medicine Expiring Soon: ${medicine.name}`;
            const body = `Your tracked medicine ${medicine.name} will expire in 7 days (on ${new Date(medicine.expiryDate).toLocaleDateString()}).`;
            const tag = `${medicine.id}-7days`;

            if (isTimestampTriggerSupported) {
                try {
                    // @ts-expect-error: TimestampTrigger is experimental
                    const trigger = new TimestampTrigger(sevenDaysBefore.getTime());
                    await registration.showNotification(title, {
                        body,
                        tag,
                        icon: "/icons/icon-192.png",
                        badge: "/icons/icon-192.png",
                        // @ts-expect-error: showTrigger is experimental
                        showTrigger: trigger,
                        data: { url: window.location.pathname, medicineId: medicine.id },
                    });
                } catch (err) {
                    console.error("Failed to schedule with TimestampTrigger:", err);
                }
            }
        }

        // 1 day before notification
        if (oneDayBefore > now) {
            const title = `Medicine Expiring Tomorrow: ${medicine.name}`;
            const body = `Your tracked medicine ${medicine.name} will expire tomorrow (on ${new Date(medicine.expiryDate).toLocaleDateString()}).`;
            const tag = `${medicine.id}-1day`;

            if (isTimestampTriggerSupported) {
                try {
                    // @ts-expect-error: TimestampTrigger is experimental
                    const trigger = new TimestampTrigger(oneDayBefore.getTime());
                    await registration.showNotification(title, {
                        body,
                        tag,
                        icon: "/icons/icon-192.png",
                        badge: "/icons/icon-192.png",
                        // @ts-expect-error: showTrigger is experimental
                        showTrigger: trigger,
                        data: { url: window.location.pathname, medicineId: medicine.id },
                    });
                } catch (err) {
                    console.error("Failed to schedule with TimestampTrigger:", err);
                }
            }
        }
    };

    const cancelNotificationsForMedicine = async (id: string) => {
        // 1. Remove from localStorage shown map
        try {
            const savedShown = localStorage.getItem("sahidawa_shown_notifications");
            if (savedShown) {
                const shownMap = JSON.parse(savedShown);
                if (shownMap[id]) {
                    delete shownMap[id];
                    localStorage.setItem("sahidawa_shown_notifications", JSON.stringify(shownMap));
                }
            }
        } catch (e) {
            console.error("Failed to update shown notifications map:", e);
        }

        // 2. Cancel in service worker if possible
        if (typeof window !== "undefined" && "Notification" in window) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                try {
                    const notifications = await (registration as any).getNotifications({
                        includeTriggered: true,
                    });
                    const tagsToCancel = [`${id}-7days`, `${id}-1day`];
                    notifications.forEach((n: any) => {
                        if (tagsToCancel.includes(n.tag)) {
                            n.close();
                        }
                    });
                } catch (e) {
                    console.error("Failed to fetch/close notifications from SW registration:", e);
                }
            }
        }
    };

    const showImmediateNotification = (title: string, body: string, tag: string) => {
        if (typeof window === "undefined" || !("Notification" in window)) return;

        navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
                reg.showNotification(title, {
                    body,
                    tag,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    data: { url: window.location.pathname },
                });
            } else {
                new Notification(title, {
                    body,
                    tag,
                    icon: "/icons/icon-192.png",
                });
            }
        });
    };

    const checkAndTriggerLocalNotifications = async (medicinesList: Medicine[]) => {
        if (
            typeof window === "undefined" ||
            !("Notification" in window) ||
            Notification.permission !== "granted"
        ) {
            return;
        }

        try {
            const savedShown = localStorage.getItem("sahidawa_shown_notifications");
            const shownMap = savedShown ? JSON.parse(savedShown) : {};
            let updated = false;

            const now = new Date();

            for (const med of medicinesList) {
                const { sevenDaysBefore, oneDayBefore } = getNotificationTargets(med.expiryDate);
                const expiry = parseLocalDate(med.expiryDate);

                if (!shownMap[med.id]) {
                    shownMap[med.id] = { sevenDays: false, oneDay: false };
                }

                // 7 days check
                if (now >= sevenDaysBefore && now < oneDayBefore) {
                    if (!shownMap[med.id].sevenDays) {
                        showImmediateNotification(
                            `Medicine Expiring Soon: ${med.name}`,
                            `Your tracked medicine ${med.name} will expire in 7 days (on ${expiry.toLocaleDateString()}).`,
                            `${med.id}-7days`
                        );
                        shownMap[med.id].sevenDays = true;
                        updated = true;
                    }
                }

                // 1 day check
                if (now >= oneDayBefore) {
                    const expiryCutoff = new Date(expiry);
                    expiryCutoff.setDate(expiry.getDate() + 7);
                    if (now <= expiryCutoff) {
                        if (!shownMap[med.id].oneDay) {
                            showImmediateNotification(
                                `Medicine Expiring Tomorrow: ${med.name}`,
                                `Your tracked medicine ${med.name} will expire tomorrow (on ${expiry.toLocaleDateString()}).`,
                                `${med.id}-1day`
                            );
                            shownMap[med.id].oneDay = true;
                            updated = true;
                        }
                    }
                }
            }

            if (updated) {
                localStorage.setItem("sahidawa_shown_notifications", JSON.stringify(shownMap));
            }
        } catch (e) {
            console.error("Error checking or triggering local notifications:", e);
        }
    };

    const handleScannerClose = useCallback(() => {
        setIsScannerOpen(false);
        setApiError(null);
    }, []);

    const updateExpiryState = useCallback((dateInputValue: string) => {
        setExpiryDate(dateInputValue);
        setDateError("");

        const selected = parseLocalDate(dateInputValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);
        setIsExpired(selected < today);
    }, []);

    const handleBarcodeScan = useCallback(
        async (scannedText: string) => {
            setIsVerifying(true);
            setApiError(null);
            try {
                const result = await verifyMedicine(scannedText);
                if (result.verified) {
                    const medicine = result.medicine;
                    const scannedName = medicine.brand_name || medicine.generic_name;
                    if (scannedName) {
                        setName(scannedName);
                    }
                    setBatchNumber(medicine.batch_number || scannedText);

                    const scannedExpiryDate = formatDateInputValue(medicine.expiry_date);
                    if (scannedExpiryDate) {
                        updateExpiryState(scannedExpiryDate);
                    }

                    const scannedDetails = [
                        medicine.generic_name ? `Generic: ${medicine.generic_name}` : null,
                        medicine.manufacturer ? `Manufacturer: ${medicine.manufacturer}` : null,
                        medicine.cdsco_approval_status
                            ? `CDSCO status: ${medicine.cdsco_approval_status}`
                            : null,
                    ]
                        .filter(Boolean)
                        .join("\n");

                    if (scannedDetails) {
                        setNotes((currentNotes) =>
                            currentNotes.trim() ? currentNotes : scannedDetails
                        );
                    }

                    toast.success("Medicine details auto-filled!");
                    setIsScannerOpen(false);
                } else {
                    setBatchNumber(scannedText);
                    toast.warning("Medicine not found in database. Batch number filled.");
                    setIsScannerOpen(false);
                }
            } catch (error: unknown) {
                console.error("Scan error:", error);
                const message =
                    error instanceof Error ? error.message : "Failed to fetch medicine details.";
                setBatchNumber(scannedText);
                setApiError(message);
                toast.error("Failed to fetch medicine details. Batch number filled.");
            } finally {
                setIsVerifying(false);
            }
        },
        [updateExpiryState]
    );

    useEffect(() => {
        const loadData = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (session?.user) {
                    setUserId(session.user.id);

                    const { data, error } = await supabase
                        .from("expiry_tracker_items")
                        .select("*")
                        .order("created_at", { ascending: false });

                    if (!error && data) {
                        const mapped = data.map((item) => ({
                            id: item.id,
                            name: item.brand_name,
                            expiryDate: item.expiry_date,
                            batchNumber: item.batch_number ?? "",
                            notes: item.notes ?? "",
                        }));

                        setMedicines(mapped);
                        checkAndTriggerLocalNotifications(mapped);
                    }
                } else {
                    const saved = localStorage.getItem("sahidawa_expiry_tracker");

                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            setMedicines(parsed);
                            checkAndTriggerLocalNotifications(parsed);
                        } catch (parseError) {
                            console.error("Failed to parse local expiry tracker data:", parseError);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoaded(true);
            }
        };

        loadData();
    }, []);

    const saveToLocalStorage = (updatedList: Medicine[]) => {
        setMedicines(updatedList);
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem("sahidawa_expiry_tracker", JSON.stringify(updatedList));
            }
        } catch (e) {
            console.error("Failed to save medicines to localStorage:", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !expiryDate) return;

        if (!expiryDate || !isValidDateString(expiryDate)) {
            setDateError("Invalid expiry date");
            return;
        }

        const selected = parseLocalDate(expiryDate);
        const today = new Date();

        today.setHours(0, 0, 0, 0);
        selected.setHours(0, 0, 0, 0);

        if (selected < today) {
            setDateError("This medicine has already expired");
            return;
        }

        setDateError("");

        if (editingId) {
            const updatedMed = { id: editingId, name, expiryDate, batchNumber, notes };
            if (userId) {
                const { error } = await supabase
                    .from("expiry_tracker_items")
                    .update({
                        brand_name: name,
                        batch_number: batchNumber || null,
                        expiry_date: expiryDate,
                        notes: notes || null,
                    })
                    .eq("id", editingId);

                if (!error) {
                    setMedicines(medicines.map((m) => (m.id === editingId ? updatedMed : m)));
                    cancelNotificationsForMedicine(editingId).then(() => {
                        scheduleNotificationsForMedicine(updatedMed);
                    });
                }
            } else {
                const updated = medicines.map((m) => (m.id === editingId ? updatedMed : m));
                saveToLocalStorage(updated);
                cancelNotificationsForMedicine(editingId).then(() => {
                    scheduleNotificationsForMedicine(updatedMed);
                });
            }
            cancelEdit();
            return;
        }

        const newMedicine: Medicine = {
            id: Date.now().toString(),
            name,
            expiryDate,
            batchNumber,
            notes,
        };
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
                const addedMed = {
                    id: data.id,
                    name: data.brand_name,
                    expiryDate: data.expiry_date,
                    batchNumber: data.batch_number ?? "",
                    notes: data.notes ?? "",
                };
                setMedicines([...medicines, addedMed]);
                scheduleNotificationsForMedicine(addedMed);
            }
        } else {
            saveToLocalStorage([...medicines, newMedicine]);
            scheduleNotificationsForMedicine(newMedicine);
        }
        setName("");
        setExpiryDate("");
        setBatchNumber("");
        setNotes("");
    };

    const handleDelete = async (id: string) => {
        if (userId) {
            const itemToDelete = medicines.find((med) => med.id === id);

            await supabase.from("expiry_tracker_items").delete().eq("id", id);

            // Clean up corresponding entry in localStorage if it exists
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
                    localStorage.setItem("sahidawa_expiry_tracker", JSON.stringify(updatedLocal));
                } catch (e) {
                    console.error("Failed to clean up localStorage on delete:", e);
                }
            }

            setMedicines(medicines.filter((med) => med.id !== id));
        } else {
            saveToLocalStorage(medicines.filter((med) => med.id !== id));
        }
        cancelNotificationsForMedicine(id);
        if (editingId === id) {
            cancelEdit();
        }
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const startEdit = (med: Medicine) => {
        setEditingId(med.id);
        setName(med.name);
        setExpiryDate(med.expiryDate);
        setBatchNumber(med.batchNumber ?? "");
        setNotes(med.notes ?? "");
        setDateError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName("");
        setExpiryDate("");
        setBatchNumber("");
        setNotes("");
        setDateError("");
        setIsExpired(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        if (userId) {
            await supabase.from("expiry_tracker_items").delete().in("id", ids);

            setMedicines(medicines.filter((med) => !selectedIds.has(med.id)));
        } else {
            saveToLocalStorage(medicines.filter((med) => !selectedIds.has(med.id)));
        }
        ids.forEach((id) => {
            cancelNotificationsForMedicine(id);
        });
        setSelectedIds(new Set());
    };

    const getDiffDays = (dateStr: string) => {
        const expiry = parseLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const getExpiryStatus = (dateStr: string) => {
        const diffDays = getDiffDays(dateStr);
        if (diffDays < 0)
            return {
                icon: <XCircle size={14} />,
                text: t("statusExpired"),
                color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30",
                key: "expired" as FilterStatus,
            };
        if (diffDays <= 30)
            return {
                icon: <AlertTriangle size={14} />,
                text: t("statusExpiringSoon", { days: diffDays }),
                color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/30",
                key: "expiringSoon" as FilterStatus,
            };
        return {
            icon: <CheckCircle2 size={14} />,
            text: t("statusSafe"),
            color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/30",
            key: "safe" as FilterStatus,
        };
    };

    // Export
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(medicines, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sahidawa_expiry_backup.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        if (processedMedicines.length === 0) return;
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("SahiDawa — Medicine Expiry Tracker", 14, 18);
        doc.setFontSize(10);
        doc.text(`${t("generatedOn")}: ${new Date().toLocaleDateString()}`, 14, 26);

        const headers = ["Medicine Name", "Expiry Date", "Batch No.", "Status"];
        const rows = processedMedicines.map((med) => [
            med.name,
            parseLocalDate(med.expiryDate).toLocaleDateString(),
            med.batchNumber ?? "—",
            getExpiryStatus(med.expiryDate).text,
        ]);

        try {
            const autoTable = (await import("jspdf-autotable")).default;
            autoTable(doc, {
                head: [headers],
                body: rows,
                startY: 32,
                styles: { fontSize: 9, cellPadding: 4 },
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
                alternateRowStyles: { fillColor: [245, 250, 248] },
                columnStyles: { 0: { cellWidth: 70 } },
            });
        } catch {
            let y = 36;
            const colWidths = [70, 40, 35, 40];
            const colX = [14, 84, 124, 159];

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 2;
            doc.line(14, y, 196, y);
            y += 5;

            doc.setFont("helvetica", "normal");
            rows.forEach((row) => {
                if (y > 275) {
                    doc.addPage();
                    y = 20;
                }
                row.forEach((cell, i) => {
                    const text = doc.splitTextToSize(String(cell), colWidths[i] - 2);
                    doc.text(text, colX[i], y);
                });
                y += 8;
            });
        }

        doc.save("sahidawa_expiry_tracker.pdf");
        toast.success(t("pdfExportSuccess") || "PDF Exported Successfully!");
    };

    const handlePrint = () => {
        window.print();
    };

    // Import
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        setImportError(null);
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (!Array.isArray(parsed)) throw new Error("Not an array");
                const valid = parsed.filter(
                    (item) =>
                        typeof item.id === "string" &&
                        typeof item.name === "string" &&
                        typeof item.expiryDate === "string" &&
                        isValidDateString(item.expiryDate)
                );
                if (valid.length !== parsed.length) {
                    setImportError(t("importDateError"));
                    return;
                }

                const existingIds = new Set(medicines.map((m) => m.id));
                const newItems = valid.filter((m) => !existingIds.has(m.id));
                if (newItems.length === 0) return;

                if (userId) {
                    const rowsToInsert = newItems.map((item) => ({
                        user_id: userId,
                        brand_name: item.name,
                        batch_number: item.batchNumber || null,
                        expiry_date: item.expiryDate,
                    }));

                    const { data, error } = await supabase
                        .from("expiry_tracker_items")
                        .insert(rowsToInsert)
                        .select();

                    if (!error && data) {
                        const mapped = data.map((item) => ({
                            id: item.id,
                            name: item.brand_name,
                            expiryDate: item.expiry_date,
                            batchNumber: item.batch_number ?? "",
                            notes: item.notes ?? "",
                        }));
                        const updatedList = [...medicines, ...mapped];
                        setMedicines(updatedList);

                        // Schedule notifications for newly imported medicines
                        mapped.forEach((m) => {
                            scheduleNotificationsForMedicine(m);
                        });
                        checkAndTriggerLocalNotifications(updatedList);
                    } else if (error) {
                        console.error("Failed to import medicines to Supabase:", error.message);
                        setImportError(t("importError"));
                    }
                } else {
                    const merged = [...medicines, ...newItems];
                    saveToLocalStorage(merged);

                    // Schedule notifications for newly imported medicines
                    newItems.forEach((m) => {
                        scheduleNotificationsForMedicine(m);
                    });
                    checkAndTriggerLocalNotifications(merged);
                }
            } catch {
                setImportError(t("importError"));
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    // Filter + Search + Sort
    const processedMedicines = medicines
        .filter((med) => {
            if (filterStatus === "all") return true;
            return getExpiryStatus(med.expiryDate).key === filterStatus;
        })
        .filter((med) => med.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "expirySoonest")
                return getDiffDays(a.expiryDate) - getDiffDays(b.expiryDate);
            if (sortBy === "expiryLatest")
                return getDiffDays(b.expiryDate) - getDiffDays(a.expiryDate);
            return a.name.localeCompare(b.name);
        });

    const filterOptions: { key: FilterStatus; label: string }[] = [
        { key: "all", label: t("filterAll") },
        { key: "expired", label: t("filterExpired") },
        { key: "expiringSoon", label: t("filterExpiringSoon") },
        { key: "safe", label: t("filterSafe") },
    ];

    return (
        <div className="min-h-screen bg-(--color-surface-page) text-(--color-text-primary) transition-colors duration-300">
            <PageHeader title={t("title")} subtitle={t("subtitle")} backHref="/" variant="light" />

            <main className="mx-auto max-w-6xl p-6 pt-32 md:pt-40">
                <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-3">
                    <ExpiryForm
                        t={t}
                        editingId={editingId}
                        name={name}
                        expiryDate={expiryDate}
                        batchNumber={batchNumber}
                        notes={notes}
                        dateError={dateError}
                        isExpired={isExpired}
                        importError={importError}
                        medicinesCount={medicines.length}
                        fileInputRef={fileInputRef}
                        notificationPermission={notificationPermission}
                        onNameChange={setName}
                        onExpiryDateChange={setExpiryDate}
                        onBatchNumberChange={setBatchNumber}
                        onNotesChange={setNotes}
                        onExpiredChange={setIsExpired}
                        onDateErrorChange={setDateError}
                        onSubmit={handleSubmit}
                        onCancelEdit={cancelEdit}
                        onOpenScanner={() => setIsScannerOpen(true)}
                        onExportPDF={handleExportPDF}
                        onPrint={handlePrint}
                        onExport={handleExport}
                        onImport={handleImport}
                        onRequestNotificationPermission={requestNotificationPermission}
                    />

                    <div className="space-y-4 md:col-span-2">
                        <ExpirySummary
                            t={t}
                            totalMedicines={medicines.length}
                            selectedCount={selectedIds.size}
                            searchQuery={searchQuery}
                            sortBy={sortBy}
                            filterStatus={filterStatus}
                            filterOptions={filterOptions}
                            onBulkDelete={handleBulkDelete}
                            onSearchChange={setSearchQuery}
                            onSortChange={setSortBy}
                            onFilterChange={setFilterStatus}
                        />
                        <ExpiryTable
                            t={t}
                            medicines={processedMedicines}
                            isLoaded={isLoaded}
                            selectedIds={selectedIds}
                            getExpiryStatus={getExpiryStatus}
                            onToggleSelect={toggleSelect}
                            onStartEdit={startEdit}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>
            </main>

            <ExpiryModal
                isOpen={isScannerOpen}
                isVerifying={isVerifying}
                apiError={apiError}
                onClose={handleScannerClose}
                onScan={handleBarcodeScan}
                onRetry={() => {
                    setApiError(null);
                }}
            />
        </div>
    );
}
