/**
 * IndexedDB Image Store for LabelLens Guardian
 *
 * Offloads large label image Base64 data URLs / blobs from localStorage
 * into IndexedDB to prevent QuotaExceededError while preserving full
 * visual evidence and texture data.
 */

const DB_NAME = "llg_image_store_v1";
const STORE_NAME = "scan_images";
const DB_VERSION = 1;

interface StoredImageRecord {
  id: string;
  dataUrl: string;
  size: number;
  updatedAt: string;
}

// In-memory fallback for SSR, test environments (Vitest/JSDOM), or incognito restrictions
const memoryFallback = new Map<string, StoredImageRecord>();

export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.indexedDB && typeof window.indexedDB.open === "function");
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB is not available in this environment."));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to open IndexedDB"));
      };

      request.onblocked = () => {
        console.warn("[ImageStore] Database open blocked by another connection.");
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save an image dataUrl to IndexedDB with scanId as key.
 * Falls back to memory cache if IndexedDB is unavailable.
 */
export async function saveScanImage(id: string, dataUrl: string): Promise<string> {
  if (!id || !dataUrl) return id;

  const record: StoredImageRecord = {
    id,
    dataUrl,
    size: dataUrl.length,
    updatedAt: new Date().toISOString(),
  };

  if (!isIndexedDBAvailable()) {
    memoryFallback.set(id, record);
    return id;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => {
        memoryFallback.set(id, record); // Keep cached in memory too
        resolve(id);
      };

      req.onerror = () => {
        // Fallback to memory on write error
        memoryFallback.set(id, record);
        resolve(id);
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn("[ImageStore] Error saving to IndexedDB, using memory fallback:", err);
    memoryFallback.set(id, record);
    return id;
  }
}

/**
 * Retrieve an image dataUrl by scanId / imageRef from IndexedDB.
 */
export async function getScanImage(id: string): Promise<string | null> {
  if (!id) return null;

  // Check memory cache first for immediate response
  if (memoryFallback.has(id)) {
    return memoryFallback.get(id)!.dataUrl;
  }

  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as StoredImageRecord | undefined;
        if (result?.dataUrl) {
          memoryFallback.set(id, result); // populate memory cache
          resolve(result.dataUrl);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn("[ImageStore] Error reading from IndexedDB:", err);
    return null;
  }
}

/**
 * Delete a scan image from IndexedDB.
 */
export async function deleteScanImage(id: string): Promise<void> {
  if (!id) return;
  memoryFallback.delete(id);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn("[ImageStore] Error deleting from IndexedDB:", err);
  }
}

/**
 * Clear all stored images.
 */
export async function clearAllScanImages(): Promise<void> {
  memoryFallback.clear();

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn("[ImageStore] Error clearing IndexedDB:", err);
  }
}

/**
 * Get all stored image keys.
 */
export async function getAllImageKeys(): Promise<string[]> {
  if (!isIndexedDBAvailable()) {
    return Array.from(memoryFallback.keys());
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        const keys = (req.result || []).map((k) => String(k));
        resolve(keys);
      };

      req.onerror = () => {
        resolve(Array.from(memoryFallback.keys()));
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    return Array.from(memoryFallback.keys());
  }
}

/**
 * Estimate storage usage of stored images.
 */
export async function estimateImageStoreUsage(): Promise<{ count: number; totalBytes: number }> {
  if (!isIndexedDBAvailable()) {
    let totalBytes = 0;
    for (const rec of memoryFallback.values()) {
      totalBytes += rec.size;
    }
    return { count: memoryFallback.size, totalBytes };
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as StoredImageRecord[];
        const totalBytes = records.reduce((acc, r) => acc + (r.size || 0), 0);
        resolve({ count: records.length, totalBytes });
      };

      req.onerror = () => {
        resolve({ count: 0, totalBytes: 0 });
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}
