import type { ScanRecord } from "@/types";

/**
 * Storage Retention and Sanitization Policy
 *
 * Rules:
 * 1. ZERO BASE64 IMAGES IN LOCALSTORAGE:
 *    Any imageDataUrl > 200 chars is stripped before localStorage serialization.
 *    The image reference ID (imageRef = scan.id) is preserved for IndexedDB lookup.
 *
 * 2. USER SAVED SCANS ARE IMMUTABLE:
 *    Scans with `saved: true` are NEVER automatically pruned or deleted.
 *
 * 3. USER CONFIRMATIONS / CORRECTIONS ARE PROTECTED:
 *    Scans containing manual user corrections or confirmed conflict resolutions
 *    are protected from automatic pruning.
 *
 * 4. UNSAVED SCANS RETENTION (FIFO):
 *    Unsaved scans (`saved: false`) are kept up to MAX_STORED_SCANS. When the
 *    limit is reached or storage quota pressure is detected, the oldest unsaved
 *    scans are evicted first.
 *
 * 5. SAFE DE-DUPLICATION:
 *    Scans with duplicate IDs are merged, keeping the most recent revision.
 */

export const STORAGE_LIMITS = {
  MAX_SCANS_DEFAULT: 40,
  MAX_SCANS_QUOTA_RECOVERY: 20,
  DATA_URL_STRIP_THRESHOLD: 200,
};

/**
 * Sanitizes a ScanRecord before persisting to localStorage:
 * - Strips huge base64 imageDataUrl strings
 * - Sets imageRef to scan.id so the high-resolution texture can be retrieved from IndexedDB
 * - Preserves all nutrition, ingredient, dietary, evidence, and conflict metadata
 */
export function sanitizeScanForLocalStorage(scan: ScanRecord): ScanRecord {
  if (!scan || !scan.product) return scan;

  const product = scan.product;
  const hasLargeImage = typeof product.imageDataUrl === "string" && product.imageDataUrl.length > STORAGE_LIMITS.DATA_URL_STRIP_THRESHOLD;

  if (!hasLargeImage && product.imageRef) {
    return scan;
  }

  return {
    ...scan,
    product: {
      ...product,
      imageDataUrl: undefined, // Strip raw base64 dataUrl from localStorage
      imageRef: product.imageRef || scan.id, // Lightweight reference pointer
    },
  };
}

/**
 * Sanitizes an array of ScanRecords for localStorage persistence.
 */
export function sanitizeScansForLocalStorage(scans: ScanRecord[]): ScanRecord[] {
  return scans.map(sanitizeScanForLocalStorage);
}

/**
 * Checks if a scan has user corrections or confirmed fields that should protect it.
 */
export function isScanUserProtected(scan: ScanRecord): boolean {
  if (scan.saved) return true;

  const ext = scan.product?.extractionRecord;
  if (!ext) return false;

  const fields = [
    ext.productName,
    ext.ingredients,
    ext.allergens,
    ext.nutrition,
    ext.servingSize,
    ext.warnings,
  ];

  return fields.some((f) => f && (f.userConfirmed || f.userCorrected));
}

/**
 * Deduplicates scans by ID, preserving the most recently updated entry.
 */
export function deduplicateScans(scans: ScanRecord[]): ScanRecord[] {
  const seen = new Map<string, ScanRecord>();

  for (const scan of scans) {
    if (!scan || !scan.id) continue;
    const existing = seen.get(scan.id);
    if (!existing) {
      seen.set(scan.id, scan);
    } else {
      // Keep whichever has a newer updatedAt timestamp
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(scan.updatedAt || scan.createdAt || 0).getTime();
      if (newTime >= existingTime) {
        seen.set(scan.id, scan);
      }
    }
  }

  return Array.from(seen.values());
}

export interface RetentionResult {
  retained: ScanRecord[];
  prunedCount: number;
  prunedScanIds: string[];
}

/**
 * Applies the documented retention policy to a list of scans.
 *
 * Never deletes:
 * - Scans marked as `saved: true`
 * - Scans with user confirmed/corrected fields
 *
 * Prunes:
 * - Oldest unsaved, uncorrected scans when count exceeds maxLimit
 */
export function applyRetentionPolicy(
  scans: ScanRecord[],
  maxLimit = STORAGE_LIMITS.MAX_SCANS_DEFAULT,
): RetentionResult {
  const dedupled = deduplicateScans(scans);

  if (dedupled.length <= maxLimit) {
    return { retained: dedupled, prunedCount: 0, prunedScanIds: [] };
  }

  const protectedScans: ScanRecord[] = [];
  const prunableScans: ScanRecord[] = [];

  for (const scan of dedupled) {
    if (isScanUserProtected(scan)) {
      protectedScans.push(scan);
    } else {
      prunableScans.push(scan);
    }
  }

  // Sort prunable scans by creation date ascending (oldest first)
  prunableScans.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const slotsAvailableForPrunable = Math.max(0, maxLimit - protectedScans.length);
  const prunedScanIds: string[] = [];

  let keptPrunable: ScanRecord[] = [];
  if (prunableScans.length > slotsAvailableForPrunable) {
    const toPruneCount = prunableScans.length - slotsAvailableForPrunable;
    const toPrune = prunableScans.slice(0, toPruneCount);
    prunedScanIds.push(...toPrune.map((s) => s.id));
    keptPrunable = prunableScans.slice(toPruneCount);
  } else {
    keptPrunable = prunableScans;
  }

  // Combine and sort by date descending (newest first)
  const retained = [...protectedScans, ...keptPrunable].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return {
    retained,
    prunedCount: prunedScanIds.length,
    prunedScanIds,
  };
}
