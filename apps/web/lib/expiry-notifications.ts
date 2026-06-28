import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface ExpiryMedicine {
    id: string;
    name: string;
    expiryDate: string;
    batchNumber?: string;
    notes?: string;
    notified7Days?: boolean;
    notified1Day?: boolean;
}

interface ExpiryDB extends DBSchema {
    medicines: {
        key: string;
        value: ExpiryMedicine;
    };
}

const DB_NAME = "sahidawa-expiry-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ExpiryDB>> | null = null;

export function getExpiryDB(): Promise<IDBPDatabase<ExpiryDB>> {
    if (typeof window === "undefined") {
        throw new Error("IndexedDB can only be accessed on the client-side");
    }
    if (!dbPromise) {
        dbPromise = openDB<ExpiryDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("medicines")) {
                    db.createObjectStore("medicines", { keyPath: "id" });
                }
            },
        });
    }
    return dbPromise;
}

/**
 * Synchronizes the list of medicines from React state (Supabase / LocalStorage)
 * into IndexedDB for the Service Worker to access.
 * Preserves the notified flags for existing items.
 */
export async function syncMedicinesToIndexedDB(medicines: ExpiryMedicine[]) {
    try {
        const db = await getExpiryDB();
        const tx = db.transaction("medicines", "readwrite");
        const store = tx.store;

        // Get all existing items in IndexedDB to preserve their notified flags
        const existingItems = await store.getAll();
        const existingMap = new Map(existingItems.map((item) => [item.id, item]));

        // Clear and rebuild or update store
        await store.clear();

        for (const med of medicines) {
            const existing = existingMap.get(med.id);
            await store.put({
                ...med,
                notified7Days: existing?.notified7Days ?? false,
                notified1Day: existing?.notified1Day ?? false,
            });
        }

        await tx.done;
    } catch (err) {
        console.error("Failed to sync medicines to IndexedDB:", err);
    }
}

/**
 * Registers a periodic background sync for checking expiries.
 */
export async function registerPeriodicExpiryCheck() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && "periodicSync" in registration) {
            const status = await navigator.permissions.query({
                // @ts-expect-error: periodic-background-sync is experimental
                name: "periodic-background-sync",
            });

            if (status.state === "granted") {
                // Register daily check (minInterval is in milliseconds)
                // @ts-expect-error: periodicSync is experimental
                await registration.periodicSync.register("check-expiry", {
                    minInterval: 24 * 60 * 60 * 1000,
                });
                console.log("[Expiry Notifications] Registered periodic sync tag: check-expiry");
            }
        }
    } catch (err) {
        console.error("Failed to register periodic sync:", err);
    }
}

/**
 * Helper to check if browser supports Push / SW Notifications.
 */
export function isPushSupported(): boolean {
    return (
        typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window
    );
}

/**
 * Request notification permissions from the user.
 */
export async function requestNotificationPermission(): Promise<string> {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted" && "serviceWorker" in navigator) {
            await registerPeriodicExpiryCheck();
        }
        return permission;
    } catch (err) {
        console.error("Error requesting notification permission:", err);
        return Notification.permission;
    }
}

/**
 * Calculates notification target dates (7 days before, 1 day before).
 */
export function getNotificationTargets(expiryDateStr: string) {
    // Parse the date safely
    const expiryDate = new Date(expiryDateStr);
    expiryDate.setHours(0, 0, 0, 0);

    const sevenDaysBefore = new Date(expiryDate);
    sevenDaysBefore.setDate(expiryDate.getDate() - 7);
    sevenDaysBefore.setHours(9, 0, 0, 0); // 9:00 AM

    const oneDayBefore = new Date(expiryDate);
    oneDayBefore.setDate(expiryDate.getDate() - 1);
    oneDayBefore.setHours(9, 0, 0, 0); // 9:00 AM

    return { sevenDaysBefore, oneDayBefore };
}

/**
 * Show a notification immediately using the Service Worker registration.
 */
export async function showImmediateNotification(title: string, body: string, tag: string) {
    if (!isPushSupported()) return;

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            await registration.showNotification(title, {
                body,
                tag,
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                data: { url: window.location.pathname },
            });
        } else {
            new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
        }
    } catch (err) {
        console.error("Failed to show immediate notification:", err);
    }
}

/**
 * In-app fallback check that fires immediate notifications if conditions are met.
 */
export async function checkAndTriggerLocalNotifications(medicines: ExpiryMedicine[]) {
    if (!isPushSupported() || Notification.permission !== "granted") {
        return;
    }

    try {
        const db = await getExpiryDB();
        const tx = db.transaction("medicines", "readwrite");
        const store = tx.store;
        const now = new Date();

        for (const med of medicines) {
            const { sevenDaysBefore, oneDayBefore } = getNotificationTargets(med.expiryDate);
            const expiry = new Date(med.expiryDate);
            const dbItem = await store.get(med.id);

            const notified7Days = dbItem?.notified7Days ?? false;
            const notified1Day = dbItem?.notified1Day ?? false;

            if (now >= sevenDaysBefore && now < oneDayBefore && !notified7Days) {
                await showImmediateNotification(
                    `Medicine Expiring Soon: ${med.name}`,
                    `Your tracked medicine ${med.name} will expire in 7 days (on ${expiry.toLocaleDateString()}).`,
                    `${med.id}-7days`
                );
                if (dbItem) {
                    dbItem.notified7Days = true;
                    await store.put(dbItem);
                }
            }

            if (now >= oneDayBefore && !notified1Day) {
                const expiryCutoff = new Date(expiry);
                expiryCutoff.setDate(expiry.getDate() + 7);
                if (now <= expiryCutoff) {
                    await showImmediateNotification(
                        `Medicine Expiring Tomorrow: ${med.name}`,
                        `Your tracked medicine ${med.name} will expire tomorrow (on ${expiry.toLocaleDateString()}).`,
                        `${med.id}-1day`
                    );
                    if (dbItem) {
                        dbItem.notified1Day = true;
                        await store.put(dbItem);
                    }
                }
            }
        }

        await tx.done;
    } catch (err) {
        console.error("Error triggering in-app local notifications:", err);
    }
}

/**
 * Cancels active or triggered notifications for a medicine.
 */
export async function cancelNotificationsForMedicine(id: string) {
    try {
        const db = await getExpiryDB();
        const tx = db.transaction("medicines", "readwrite");
        const store = tx.store;
        const item = await store.get(id);
        if (item) {
            item.notified7Days = false;
            item.notified1Day = false;
            await store.put(item);
        }
        await tx.done;
    } catch (e) {
        console.error("Failed to update notification flags in DB:", e);
    }

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
}
