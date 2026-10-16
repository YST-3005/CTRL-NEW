import type {
  CaregiverAlert,
  CaregiverContact,
  ChatMessage,
  DietaryPreferences,
  ScanRecord,
  UserProfile,
  CaregiverProfile,
} from "@/types";
import { DEFAULT_PREFERENCES, DEFAULT_CAREGIVER_THRESHOLDS } from "@/types";
import {
  sanitizeScansForLocalStorage,
  applyRetentionPolicy,
  deduplicateScans,
  STORAGE_LIMITS,
} from "./retention";
import { saveScanImage } from "./imageStore";

export const KEY = {
  user: "llg.user",
  scans: "llg.scans",
  prefs: "llg.prefs",
  chat: "llg.chat",
  caregiver: "llg.caregiver",
  alerts: "llg.alerts",
  users: "llg.demoUsers",
  optin: "llg.caregiverOptIn",
  overrides: "llg.veganOverrides",
  caregiverProfiles: "llg.caregiverProfiles",
};

export interface StorageQuotaWarning {
  key: string;
  message: string;
  timestamp: string;
  recovered: boolean;
  prunedCount?: number;
}

type QuotaListener = (warning: StorageQuotaWarning) => void;
const quotaListeners = new Set<QuotaListener>();
let lastQuotaWarning: StorageQuotaWarning | null = null;

export function onQuotaWarning(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

export function getLastQuotaWarning(): StorageQuotaWarning | null {
  return lastQuotaWarning;
}

function notifyQuotaWarning(warning: StorageQuotaWarning) {
  lastQuotaWarning = warning;
  quotaListeners.forEach((listener) => {
    try {
      listener(warning);
    } catch (e) {
      console.error("[Storage] Error in quota warning listener:", e);
    }
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("llg:quota_exceeded", {
          detail: warning,
        }),
      );
    } catch {
      // Ignore in non-browser or test environments
    }
  }
}

/**
 * Checks whether an error is a browser storage quota exceeded error across all vendors.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name : "";
  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
  const code = typeof e.code === "number" ? e.code : 0;
  const number = typeof e.number === "number" ? e.number : 0;

  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014 ||
    number === -2147024882 ||
    message.includes("quota") ||
    message.includes("exceeded the quota") ||
    message.includes("storage limit")
  );
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe write to localStorage with QuotaExceededError protection,
 * non-destructive recovery, and user notification.
 */
function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;

  const serialized = JSON.stringify(value);

  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (err: unknown) {
    if (!isQuotaExceededError(err)) {
      console.error(`[Storage] Unexpected error writing to "${key}":`, err);
      return false;
    }

    console.warn(`[Storage] QuotaExceededError writing to "${key}". Executing safe recovery policy.`);

    // Handle scans key recovery
    if (key === KEY.scans && Array.isArray(value)) {
      const allScans = value as ScanRecord[];
      // 1. Sanitize to ensure absolutely zero large base64 strings
      const sanitized = sanitizeScansForLocalStorage(allScans);

      // 2. Apply quota recovery threshold (keep all saved scans, trim oldest unsaved scans)
      const { retained, prunedCount } = applyRetentionPolicy(
        sanitized,
        STORAGE_LIMITS.MAX_SCANS_QUOTA_RECOVERY,
      );

      try {
        localStorage.setItem(key, JSON.stringify(retained));
        notifyQuotaWarning({
          key,
          message: `Storage quota reached. Pruned ${prunedCount} old unsaved scans to prevent data loss. Saved scans and dietary profiles remain intact.`,
          timestamp: new Date().toISOString(),
          recovered: true,
          prunedCount,
        });
        return true;
      } catch (retryErr) {
        // Fallback: If still failing, keep ONLY saved scans
        const onlySaved = retained.filter((s) => s.saved);
        try {
          localStorage.setItem(key, JSON.stringify(onlySaved));
          notifyQuotaWarning({
            key,
            message: `Storage quota severely constrained. Preserved all ${onlySaved.length} user-saved scans.`,
            timestamp: new Date().toISOString(),
            recovered: true,
            prunedCount: retained.length - onlySaved.length,
          });
          return true;
        } catch {
          notifyQuotaWarning({
            key,
            message: "Browser local storage is full. Please clear old history or use Supabase sync.",
            timestamp: new Date().toISOString(),
            recovered: false,
          });
          return false;
        }
      }
    }

    // Handle chat history quota recovery
    if (key === KEY.chat && value && typeof value === "object") {
      try {
        const chats = value as Record<string, ChatMessage[]>;
        const trimmed: Record<string, ChatMessage[]> = {};
        for (const [uid, msgs] of Object.entries(chats)) {
          trimmed[uid] = msgs.slice(-15); // keep latest 15 messages
        }
        localStorage.setItem(key, JSON.stringify(trimmed));
        return true;
      } catch {
        // Ignore fallback write error
      }
    }

    // Generic quota failure notification
    notifyQuotaWarning({
      key,
      message: `Failed to persist ${key} due to browser storage limits. Application state remains active in memory.`,
      timestamp: new Date().toISOString(),
      recovered: false,
    });
    return false;
  }
}

/**
 * Migrates existing scans in localStorage that contain large Base64 images:
 * - Offloads images to IndexedDB
 * - Preserves all scan metadata, ingredients, nutrition, evidence, and alerts
 * - Sanitizes localStorage so QuotaExceededError is resolved permanently
 */
export async function migrateLegacyScans(): Promise<{ migratedCount: number; preservedCount: number }> {
  if (typeof window === "undefined") {
    return { migratedCount: 0, preservedCount: 0 };
  }

  try {
    const raw = localStorage.getItem(KEY.scans);
    if (!raw) return { migratedCount: 0, preservedCount: 0 };

    const scans = JSON.parse(raw) as ScanRecord[];
    if (!Array.isArray(scans) || scans.length === 0) {
      return { migratedCount: 0, preservedCount: 0 };
    }

    let migratedCount = 0;
    const sanitizedScans: ScanRecord[] = [];

    for (const scan of scans) {
      if (!scan || !scan.product) continue;

      const img = scan.product.imageDataUrl;
      if (typeof img === "string" && img.length > STORAGE_LIMITS.DATA_URL_STRIP_THRESHOLD) {
        // Save image to IndexedDB
        await saveScanImage(scan.id, img);
        migratedCount++;

        sanitizedScans.push({
          ...scan,
          product: {
            ...scan.product,
            imageDataUrl: undefined,
            imageRef: scan.product.imageRef || scan.id,
          },
        });
      } else {
        sanitizedScans.push(scan);
      }
    }

    if (migratedCount > 0) {
      // Re-save sanitized scans to localStorage
      write(KEY.scans, sanitizedScans);
      console.log(`[Storage] Successfully migrated ${migratedCount} scans from localStorage to IndexedDB.`);
    }

    return { migratedCount, preservedCount: sanitizedScans.length };
  } catch (err) {
    console.warn("[Storage] Legacy scan migration skipped due to error:", err);
    return { migratedCount: 0, preservedCount: 0 };
  }
}

/**
 * Calculates current localStorage usage statistics.
 */
export function getStorageUsage(): {
  usedBytes: number;
  scanCount: number;
  savedCount: number;
  isNearLimit: boolean;
} {
  if (typeof window === "undefined") {
    return { usedBytes: 0, scanCount: 0, savedCount: 0, isNearLimit: false };
  }

  let usedBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const val = localStorage.getItem(k) || "";
        usedBytes += (k.length + val.length) * 2; // UTF-16 approximate bytes
      }
    }
  } catch {
    // Ignore access error
  }

  const allScans = read<ScanRecord[]>(KEY.scans, []);
  const scanCount = allScans.length;
  const savedCount = allScans.filter((s) => s.saved).length;

  // 5MB is typical limit (~5,242,880 bytes). Near limit if > 3.5MB.
  const isNearLimit = usedBytes > 3.5 * 1024 * 1024;

  return { usedBytes, scanCount, savedCount, isNearLimit };
}

export const localDb = {
  getUser(): UserProfile | null {
    return read<UserProfile | null>(KEY.user, null);
  },
  setUser(user: UserProfile | null) {
    if (!user) {
      if (typeof window !== "undefined") localStorage.removeItem(KEY.user);
    } else {
      write(KEY.user, user);
    }
  },
  getScans(userId: string): ScanRecord[] {
    const all = read<ScanRecord[]>(KEY.scans, []);
    return all.filter((s) => s.userId === userId);
  },
  saveScans(allForUser: ScanRecord[]) {
    if (!allForUser.length) return;
    const userId = allForUser[0]?.userId;
    if (!userId) return;

    // Sanitize user scans before persisting
    const sanitizedUserScans = sanitizeScansForLocalStorage(allForUser);

    // Read other users' scans, filter out matches for current user
    const others = read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId !== userId);

    // Combine, deduplicate, and apply retention policy
    const combined = deduplicateScans([...others, ...sanitizedUserScans]);
    const { retained } = applyRetentionPolicy(combined);

    write(KEY.scans, retained);
  },
  replaceUserScans(userId: string, scans: ScanRecord[]) {
    // Sanitize user scans before persisting
    const sanitizedUserScans = sanitizeScansForLocalStorage(scans);

    // Read other users' scans
    const rest = read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId !== userId);

    // Combine, deduplicate, and apply retention policy
    const combined = deduplicateScans([...rest, ...sanitizedUserScans]);
    const { retained } = applyRetentionPolicy(combined);

    write(KEY.scans, retained);
  },
  getPrefs(userId: string): DietaryPreferences {
    const all = read<Record<string, DietaryPreferences>>(KEY.prefs, {});
    return all[userId] ?? DEFAULT_PREFERENCES;
  },
  setPrefs(userId: string, prefs: DietaryPreferences) {
    const all = read<Record<string, DietaryPreferences>>(KEY.prefs, {});
    all[userId] = prefs;
    write(KEY.prefs, all);
  },
  getChat(userId: string): ChatMessage[] {
    return read<Record<string, ChatMessage[]>>(KEY.chat, {})[userId] ?? [];
  },
  setChat(userId: string, messages: ChatMessage[]) {
    const all = read<Record<string, ChatMessage[]>>(KEY.chat, {});
    all[userId] = messages;
    write(KEY.chat, all);
  },
  getCaregiver(userId: string): CaregiverContact | null {
    return read<Record<string, CaregiverContact | null>>(KEY.caregiver, {})[userId] ?? null;
  },
  setCaregiver(userId: string, contact: CaregiverContact | null) {
    const all = read<Record<string, CaregiverContact | null>>(KEY.caregiver, {});
    all[userId] = contact;
    write(KEY.caregiver, all);
  },
  getAlerts(userId: string): CaregiverAlert[] {
    return read<Record<string, CaregiverAlert[]>>(KEY.alerts, {})[userId] ?? [];
  },
  setAlerts(userId: string, alerts: CaregiverAlert[]) {
    const all = read<Record<string, CaregiverAlert[]>>(KEY.alerts, {});
    all[userId] = alerts;
    write(KEY.alerts, all);
  },
  getOptIn(userId: string): boolean {
    return read<Record<string, boolean>>(KEY.optin, {})[userId] ?? false;
  },
  setOptIn(userId: string, value: boolean) {
    const all = read<Record<string, boolean>>(KEY.optin, {});
    all[userId] = value;
    write(KEY.optin, all);
  },
  getOverrides(userId: string): Record<string, "VEGAN" | "NON-VEGAN" | "UNKNOWN"> {
    return read<Record<string, Record<string, "VEGAN" | "NON-VEGAN" | "UNKNOWN">>>(KEY.overrides, {})[userId] ?? {};
  },
  setOverrides(userId: string, map: Record<string, "VEGAN" | "NON-VEGAN" | "UNKNOWN">) {
    const all = read<Record<string, Record<string, "VEGAN" | "NON-VEGAN" | "UNKNOWN">>>(KEY.overrides, {});
    all[userId] = map;
    write(KEY.overrides, all);
  },
  getCaregiverProfile(userId: string): CaregiverProfile {
    const all = read<Record<string, CaregiverProfile>>(KEY.caregiverProfiles, {});
    if (all[userId]) return all[userId];
    const initial = defaultCaregiverProfile(userId);
    all[userId] = initial;
    write(KEY.caregiverProfiles, all);
    return initial;
  },
  setCaregiverProfile(userId: string, profile: CaregiverProfile) {
    const all = read<Record<string, CaregiverProfile>>(KEY.caregiverProfiles, {});
    all[userId] = profile;
    write(KEY.caregiverProfiles, all);
  },
};

export function defaultCaregiverProfile(userId: string): CaregiverProfile {
  return {
    userId,
    dependentName: "Primary Dependent",
    dietaryPlan: {
      vegan: false,
      vegetarian: false,
      allergies: ["milk", "peanuts", "eggs"],
      ingredientsToAvoid: ["added sugar"],
    },
    thresholds: DEFAULT_CAREGIVER_THRESHOLDS,
    userConfirmations: {},
    dismissedAlertIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export interface DemoAccount {
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

async function sha(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  return sha(`llg:${password}`);
}

export function demoAccounts(): DemoAccount[] {
  return read<DemoAccount[]>(KEY.users, []);
}

export function saveDemoAccounts(list: DemoAccount[]) {
  write(KEY.users, list);
}
