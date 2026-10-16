import { describe, it, expect, beforeEach, vi } from "vitest";
import { localDb, migrateLegacyScans, isQuotaExceededError } from "@/lib/storage/local";
import { sanitizeScanForLocalStorage, applyRetentionPolicy, STORAGE_LIMITS } from "@/lib/storage/retention";
import type { ScanRecord } from "@/types";

describe("Storage Quota & Retention Protection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const createMockScan = (id: string, saved = false, imageDataUrl?: string): ScanRecord => ({
    id,
    userId: "user-1",
    phase: "completed",
    saved,
    createdAt: new Date(Date.now() - 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    product: {
      id: `prod-${id}`,
      slug: `slug-${id}`,
      name: `Test Product ${id}`,
      brand: "Brand",
      category: "food",
      description: "Description",
      dataOrigin: "user_scan",
      dataSource: "OCR",
      completeness: 80,
      ingredients: [],
      nutrition: { servingSizeAmount: 30, servingSizeUnit: "g", values: [], incomplete: false, notes: [] },
      dietary: { veganStatus: "VEGAN", veganSummary: "Vegan", vegetarianLikely: true, containsAddedSugar: false, flags: [] },
      benefits: [],
      concerns: [],
      missingInformation: [],
      uncertainties: [],
      imageDataUrl,
      labelVersion: 1,
      capturedAt: new Date().toISOString(),
    },
  });

  it("sanitizes scans by stripping huge base64 imageDataUrl before localStorage", () => {
    const hugeDataUrl = "data:image/png;base64," + "A".repeat(1000);
    const scan = createMockScan("scan-1", true, hugeDataUrl);

    const sanitized = sanitizeScanForLocalStorage(scan);
    expect(sanitized.product.imageDataUrl).toBeUndefined();
    expect(sanitized.product.imageRef).toBe("scan-1");
  });

  it("never prunes user-saved scans during retention policy enforcement", () => {
    const scans: ScanRecord[] = [];
    // 25 saved scans, 25 unsaved scans
    for (let i = 0; i < 25; i++) {
      scans.push(createMockScan(`saved-${i}`, true));
      scans.push(createMockScan(`unsaved-${i}`, false));
    }

    const { retained, prunedCount } = applyRetentionPolicy(scans, 20);
    expect(prunedCount).toBe(25); // all 25 unsaved pruned to fit
    expect(retained.length).toBe(25); // all 25 saved scans MUST be preserved
    expect(retained.every((s) => s.saved)).toBe(true);
  });

  it("migrates legacy scans with base64 images without deleting scan history", async () => {
    const legacyImg = "data:image/jpeg;base64," + "B".repeat(500);
    const legacyScan = createMockScan("legacy-1", true, legacyImg);

    localStorage.setItem("llg.scans", JSON.stringify([legacyScan]));

    const result = await migrateLegacyScans();
    expect(result.migratedCount).toBe(1);
    expect(result.preservedCount).toBe(1);

    const storedScans = localDb.getScans("user-1");
    expect(storedScans.length).toBe(1);
    expect(storedScans[0].id).toBe("legacy-1");
    expect(storedScans[0].product.imageDataUrl).toBeUndefined();
    expect(storedScans[0].product.imageRef).toBe("legacy-1");
  });

  it("safely handles QuotaExceededError and prunes unsaved scans without crashing", () => {
    let callCount = 0;
    const originalSetItem = localStorage.setItem.bind(localStorage);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => {
      callCount++;
      if (callCount === 1) {
        const quotaErr = new Error("QuotaExceededError");
        quotaErr.name = "QuotaExceededError";
        throw quotaErr;
      }
      return originalSetItem(key, val);
    });

    const userScans: ScanRecord[] = [];
    for (let i = 0; i < 30; i++) {
      userScans.push(createMockScan(`scan-${i}`, i < 5)); // 5 saved, 25 unsaved
    }

    expect(() => {
      localDb.replaceUserScans("user-1", userScans);
    }).not.toThrow();

    expect(callCount).toBeGreaterThan(1); // retried with pruned scans
  });
});
