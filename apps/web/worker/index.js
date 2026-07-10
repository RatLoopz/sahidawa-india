// ---------------------------------------------------------------------------
// PUSH NOTIFICATIONS — medicine recall alerts
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
    const payload = event.data
        ? event.data.json()
        : {
              title: "Medicine Recall Alert",
              body: "A medicine recall alert was issued.",
              url: "/en/alerts",
          };

    event.waitUntil(
        self.registration.showNotification(payload.title || "Medicine Recall Alert", {
            body: payload.body || payload.recallReason,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: {
                url: payload.url || "/en/alerts",
                medicineName: payload.medicineName,
                recallReason: payload.recallReason,
            },
            tag: payload.medicineName ? `recall-${payload.medicineName}` : "medicine-recall",
            requireInteraction: payload.severity === "critical",
        })
    );
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK — focus existing window or open new one
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/en/alerts";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});

// ---------------------------------------------------------------------------
// PERIODIC SYNC — check for medicine expiries in the background
// ---------------------------------------------------------------------------
self.addEventListener("periodicsync", (event) => {
    if (event.tag === "check-expiry") {
        event.waitUntil(checkExpiryAndNotify());
    }
});

function checkExpiryAndNotify() {
    return new Promise((resolve) => {
        const request = indexedDB.open("sahidawa-expiry-db", 1);
        request.onerror = () => resolve();
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("medicines")) {
                db.close();
                return resolve();
            }

            const transaction = db.transaction("medicines", "readwrite");
            const store = transaction.objectStore("medicines");
            const getAllRequest = store.getAll();

            getAllRequest.onerror = () => resolve();
            getAllRequest.onsuccess = () => {
                const medicines = getAllRequest.result || [];
                const now = new Date();
                const promises = [];

                for (const med of medicines) {
                    const expiry = new Date(med.expiryDate);
                    expiry.setHours(0, 0, 0, 0);

                    const sevenDaysBefore = new Date(expiry);
                    sevenDaysBefore.setDate(expiry.getDate() - 7);
                    sevenDaysBefore.setHours(9, 0, 0, 0);

                    const oneDayBefore = new Date(expiry);
                    oneDayBefore.setDate(expiry.getDate() - 1);
                    oneDayBefore.setHours(9, 0, 0, 0);

                    const notified7Days = med.notified7Days || false;
                    const notified1Day = med.notified1Day || false;
                    let updated = false;

                    if (now >= sevenDaysBefore && now < oneDayBefore && !notified7Days) {
                        promises.push(
                            self.registration.showNotification(
                                `Medicine Expiring Soon: ${med.name}`,
                                {
                                    body: `Your tracked medicine ${med.name} will expire in 7 days (on ${expiry.toLocaleDateString()}).`,
                                    tag: `${med.id}-7days`,
                                    icon: "/icons/icon-192.png",
                                    badge: "/icons/icon-192.png",
                                    data: { url: "/en/expiry-tracker", medicineId: med.id },
                                }
                            )
                        );
                        med.notified7Days = true;
                        updated = true;
                    }

                    if (now >= oneDayBefore && !notified1Day) {
                        const expiryCutoff = new Date(expiry);
                        expiryCutoff.setDate(expiry.getDate() + 7);
                        if (now <= expiryCutoff) {
                            promises.push(
                                self.registration.showNotification(
                                    `Medicine Expiring Tomorrow: ${med.name}`,
                                    {
                                        body: `Your tracked medicine ${med.name} will expire tomorrow (on ${expiry.toLocaleDateString()}).`,
                                        tag: `${med.id}-1day`,
                                        icon: "/icons/icon-192.png",
                                        badge: "/icons/icon-192.png",
                                        data: { url: "/en/expiry-tracker", medicineId: med.id },
                                    }
                                )
                            );
                            med.notified1Day = true;
                            updated = true;
                        }
                    }

                    if (updated) {
                        store.put(med);
                    }
                }

                Promise.all(promises).finally(() => {
                    db.close();
                    resolve();
                });
            };
        };
    });
}

// ---------------------------------------------------------------------------
// MESSAGE — allow pages to communicate with the SW (e.g. skip waiting)
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// ---------------------------------------------------------------------------
// BACKGROUND SYNC — offline submissions
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
    if (event.tag === "sahidawa-sync-scans") {
        event.waitUntil(flushQueueFromServiceWorker());
    }
});

function openIndexedDB(dbName, version, upgradeCallback) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            if (upgradeCallback) upgradeCallback(request.result);
        };
    });
}

async function getQueuedScans() {
    try {
        const db = await openIndexedDB("sahidawa-offline-sync", 1);
        if (!db.objectStoreNames.contains("sync-queue")) {
            db.close();
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("sync-queue", "readonly");
            const store = transaction.objectStore("sync-queue");
            const request = store.getAll();
            request.onsuccess = () => {
                db.close();
                resolve(request.result || []);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to get queued scans", e);
        return [];
    }
}

async function deleteQueuedScan(id) {
    try {
        const db = await openIndexedDB("sahidawa-offline-sync", 1);
        if (!db.objectStoreNames.contains("sync-queue")) {
            db.close();
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("sync-queue", "readwrite");
            const store = transaction.objectStore("sync-queue");
            const request = store.delete(id);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to delete queued scan", e);
    }
}

async function saveToScanHistory(entry) {
    try {
        const db = await openIndexedDB("sahidawa-history", 1, (db) => {
            if (!db.objectStoreNames.contains("scan-history")) {
                db.createObjectStore("scan-history", { keyPath: "id" });
            }
        });
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("scan-history", "readwrite");
            const store = transaction.objectStore("scan-history");
            const request = store.put(entry);
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.error("[SW] Failed to save scan history", e);
    }
}

async function flushQueueFromServiceWorker() {
    const queue = await getQueuedScans();
    if (queue.length === 0) return;

    let syncedCount = 0;

    for (const item of queue) {
        try {
            // Determine if the URL is ML service or regular API
            const apiUrl = item.apiUrl || "/api/verify";
            const isMl = apiUrl.includes("/verify/batch");
            const body = isMl
                ? JSON.stringify({ batch_number: item.barcode })
                : JSON.stringify({ batchNumber: item.barcode });

            const res = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body,
            });

            if (!res.ok) {
                // If it is a 5xx or server/network error, we retry later by throwing
                if (res.status >= 500) {
                    throw new Error(`Server returned status ${res.status}`);
                }

                // Discard from queue for other client/unresolvable errors (like 400 or 404)
                await deleteQueuedScan(item.id);
                continue;
            }

            const data = await res.json();

            // Format result
            let title = "Medicine Verification";
            let bodyText = "";
            let historyStatus = "SUSPICIOUS";
            let medicineName = item.barcode;

            if (data.verified) {
                const med = data.medicine;
                medicineName = med.brand_name || item.barcode;
                if (med.is_counterfeit_alert) {
                    title = "⚠️ Counterfeit Alert!";
                    bodyText = `Warning: Medicine "${medicineName}" (Batch: ${med.batch_number}) is flagged as counterfeit.`;
                    historyStatus = "FAKE";
                } else {
                    title = "✅ Medicine Verified Genuine";
                    bodyText = `Medicine "${medicineName}" (Batch: ${med.batch_number}) has been verified.`;
                    historyStatus = "VERIFIED";
                }
            } else {
                title = "❌ Verification Failed";
                bodyText = `Medicine batch ${item.barcode} could not be verified in the CDSCO database.`;
                historyStatus = "SUSPICIOUS";
            }

            // Save to scan history
            const uuid =
                self.crypto && self.crypto.randomUUID
                    ? self.crypto.randomUUID()
                    : Date.now().toString(36) + Math.random().toString(36).substr(2);
            await saveToScanHistory({
                id: uuid,
                timestamp: Date.now(),
                medicineName,
                status: historyStatus,
            });

            // Remove from queue
            await deleteQueuedScan(item.id);
            syncedCount++;

            // Trigger notification
            if (self.registration && "showNotification" in self.registration) {
                await self.registration.showNotification(title, {
                    body: bodyText,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                    data: { url: `/${item.locale || "en"}/history` },
                });
            }
        } catch (error) {
            console.error("[SW] Failed to sync scan: ", error);
            // Re-throw so Background Sync retries later
            throw error;
        }
    }

    // Notify clients that sync finished
    const clientsList = await self.clients.matchAll();
    clientsList.forEach((client) => {
        client.postMessage({
            type: "SYNC_QUEUE_UPDATED",
            count: syncedCount,
        });
    });
}
