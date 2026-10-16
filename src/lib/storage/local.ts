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

const KEY = {
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

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const localDb = {
  getUser(): UserProfile | null {
    return read<UserProfile | null>(KEY.user, null);
  },
  setUser(user: UserProfile | null) {
    if (!user) localStorage.removeItem(KEY.user);
    else write(KEY.user, user);
  },
  getScans(userId: string): ScanRecord[] {
    return read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId === userId);
  },
  saveScans(allForUser: ScanRecord[]) {
    const others = read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId !== allForUser[0]?.userId);
    write(KEY.scans, [...others.filter((s) => !allForUser.some((x) => x.userId === s.userId && x.id === s.id)), ...allForUser]);
    const userId = allForUser[0]?.userId;
    if (userId) {
      const rest = read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId !== userId);
      write(KEY.scans, [...rest, ...allForUser]);
    }
  },
  replaceUserScans(userId: string, scans: ScanRecord[]) {
    const rest = read<ScanRecord[]>(KEY.scans, []).filter((s) => s.userId !== userId);
    write(KEY.scans, [...rest, ...scans]);
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
