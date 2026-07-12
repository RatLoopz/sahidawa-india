export interface PendingScan {
  id?: number;
  barcode: string;
  timestamp: number;
  scanCount: number;
}

const DB_NAME = "SahiDawaOfflineDB";
const STORE_NAME = "pendingScans";

export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueBarcode(barcode: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = () => {
      const scans = getAllRequest.result as PendingScan[];
      const existingScan = scans.find((s) => s.barcode === barcode);

      if (existingScan && existingScan.id !== undefined) {
        existingScan.timestamp = Date.now();
        existingScan.scanCount = (existingScan.scanCount || 1) + 1;
        const updateRequest = store.put(existingScan);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        const newScan: PendingScan = {
          barcode,
          timestamp: Date.now(),
          scanCount: 1,
        };
        const addRequest = store.add(newScan);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      }
    };
    
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}
