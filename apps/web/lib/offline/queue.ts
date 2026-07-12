import { getDB, type PendingScan } from "@/utils/offlineDb";

export async function flushReports(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pendingScans", "readwrite");
    const store = transaction.objectStore("pendingScans");
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
      const scans = getAllRequest.result as PendingScan[];
      if (scans.length === 0) {
        resolve();
        return;
      }

      try {
        for (const scan of scans) {
          await fetch("/api/verify-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcode: scan.barcode, count: scan.scanCount }),
          });

          if (scan.id !== undefined) {
            store.delete(scan.id);
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}
