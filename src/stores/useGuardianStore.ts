"use client";

import { create } from "zustand";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { buildProductFromOcr, productFromManualText } from "@/lib/extract/label";
import { FAIL_TOKEN, runOcrPipeline } from "@/lib/ocr/client";
import { buildSimulatedAlert, canSimulateAlert } from "@/lib/notifications/simulate";
import { isBusyPhase } from "@/lib/scan/machine";
import { DEMO_LABEL_DATA_URL, DEMO_LABEL_FILENAME } from "@/lib/ocr/fixture";
import { localDb, hashPassword, demoAccounts, saveDemoAccounts, onQuotaWarning, migrateLegacyScans } from "@/lib/storage/local";
import { saveScanImage, getScanImage, deleteScanImage, clearAllScanImages } from "@/lib/storage/imageStore";
import { answerAboutProduct } from "@/lib/chat/grounded";
import { authMode } from "@/lib/auth/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { uid, nowIso } from "@/lib/utils";
import { assessImageQuality, type ImageQualityReport } from "@/lib/ocr/quality";
import { applyFieldCorrectionToRecord, confirmExtractedField } from "@/lib/extract/extractionEngine";
import {
  DEFAULT_PREFERENCES,
  type CaregiverAlert,
  type CaregiverContact,
  type ChatMessage,
  type DietaryPreferences,
  type ProductRecord,
  type ScanPhase,
  type ScanRecord,
  type UserProfile,
  type VeganStatus,
  type CaregiverProfile,
  type EvidenceGroundedComparison,
} from "@/types";
import { evaluateEvidenceGroundedComparisons } from "@/lib/dietary/comparisonEngine";

interface GuardianState {
  hydrated: boolean;
  authMode: "demo" | "supabase";
  user: UserProfile | null;
  authError: string | null;
  authBusy: boolean;
  prefs: DietaryPreferences;
  scans: ScanRecord[];
  activeScanId: string | null;
  phase: ScanPhase;
  uploadProgress: number;
  previewUrl: string | null;
  pendingFileName: string | null;
  scanError: string | null;
  selectedIngredientId: string | null;
  compareLeft: string | null;
  compareRight: string | null;
  radarLeft: string;
  radarRight: string;
  chat: ChatMessage[];
  chatBusy: boolean;
  caregiver: CaregiverContact | null;
  caregiverOptIn: boolean;
  alerts: CaregiverAlert[];
  hydrate: () => void;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  loginDemo: () => Promise<boolean>;
  logout: () => Promise<void>;
  savePrefs: (prefs: DietaryPreferences) => void;
  resetPrefs: () => void;
  setPreview: (url: string | null, name?: string | null) => void;
  startUpload: (dataUrl: string, fileName: string) => Promise<boolean>;
  loadSample: (productId: string) => Promise<void>;
  scanManual: (text: string) => Promise<void>;
  retryScan: () => Promise<boolean>;
  cancelScan: () => void;
  forceFailNext: boolean;
  setForceFailNext: (v: boolean) => void;
  setPhase: (p: ScanPhase) => void;
  selectIngredient: (id: string | null) => void;
  toggleSaved: (scanId: string) => void;
  deleteScan: (scanId: string) => void;
  clearHistory: () => void;
  setCompare: (slot: "left" | "right", id: string | null) => void;
  setRadar: (slot: "left" | "right", id: string) => void;
  sendChat: (question: string) => Promise<void>;
  setCaregiver: (c: CaregiverContact | null) => void;
  setCaregiverOptIn: (v: boolean) => void;
  triggerAlert: (product: ProductRecord, rule: string) => void;
  deleteAlert: (id: string) => void;
  veganOverrides: Record<string, VeganStatus>;
  setVeganOverride: (name: string, status: VeganStatus) => void;
  activeQualityReport: ImageQualityReport | null;
  caregiverProfile: CaregiverProfile | null;
  highlightedEvidenceId: string | null;
  saveCaregiverProfile: (profile: CaregiverProfile) => void;
  resolveConfirmation: (comparisonId: string, actionValue: string) => void;
  dismissAlert: (comparisonId: string) => void;
  setHighlightedEvidenceId: (id: string | null) => void;
  activeComparisons: () => EvidenceGroundedComparison[];
  updateFieldCorrection: (
    fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
    value: any,
  ) => void;
  confirmField: (
    fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
  ) => void;
  assessCurrentPreviewQuality: () => Promise<ImageQualityReport | null>;
  simulateDemoOcr: () => Promise<boolean>;
  activeProduct: () => ProductRecord | null;
  catalog: () => ProductRecord[];
  storageWarning: string | null;
  dismissStorageWarning: () => void;
  loadScanImage: (scanId: string) => Promise<string | null>;
}

function persist(userId: string, scans: ScanRecord[], prefs: DietaryPreferences, chat: ChatMessage[]) {
  localDb.replaceUserScans(userId, scans);
  localDb.setPrefs(userId, prefs);
  localDb.setChat(userId, chat);
}

export const useGuardianStore = create<GuardianState>((set, get) => ({
  hydrated: false,
  authMode: "demo",
  user: null,
  authError: null,
  authBusy: false,
  prefs: DEFAULT_PREFERENCES,
  scans: [],
  activeScanId: null,
  phase: "idle",
  uploadProgress: 0,
  previewUrl: null,
  pendingFileName: null,
  scanError: null,
  selectedIngredientId: null,
  compareLeft: SAMPLE_PRODUCTS[0]?.id ?? null,
  compareRight: SAMPLE_PRODUCTS[1]?.id ?? null,
  radarLeft: "sample-oat-dawn",
  radarRight: "sample-oat-dawn-v2",
  chat: [],
  chatBusy: false,
  caregiver: null,
  caregiverOptIn: false,
  alerts: [],
  activeQualityReport: null,
  veganOverrides: {},
  caregiverProfile: null,
  highlightedEvidenceId: null,
  forceFailNext: false,
  storageWarning: null,
  dismissStorageWarning: () => set({ storageWarning: null }),
  loadScanImage: async (scanId: string) => {
    const scan = get().scans.find((s) => s.id === scanId);
    if (scan?.product?.imageDataUrl) return scan.product.imageDataUrl;
    const img = await getScanImage(scanId);
    if (img) {
      set({
        scans: get().scans.map((s) =>
          s.id === scanId ? { ...s, product: { ...s.product, imageDataUrl: img } } : s,
        ),
      });
      return img;
    }
    return null;
  },
  hydrate: () => {
    // 1. Subscribe to quota warnings
    onQuotaWarning((warning) => {
      set({ storageWarning: warning.message });
    });

    // 2. Run legacy scan migration in background
    migrateLegacyScans().catch((e) => {
      console.warn("[Store] Legacy scan migration skipped:", e);
    });

    const user = localDb.getUser();
    if (!user) {
      set({ hydrated: true });
      return;
    }
    set({
      hydrated: true,
      user,
      prefs: localDb.getPrefs(user.id),
      scans: localDb.getScans(user.id),
      chat: localDb.getChat(user.id),
      caregiver: localDb.getCaregiver(user.id),
      alerts: localDb.getAlerts(user.id),
      caregiverOptIn: localDb.getOptIn(user.id),
      veganOverrides: localDb.getOverrides(user.id),
      caregiverProfile: localDb.getCaregiverProfile(user.id),
      authMode: user.authMode,
    });
  },
  register: async (email, password, displayName) => {
    set({ authBusy: true, authError: null });
    if (password.length < 10) {
      set({ authBusy: false, authError: "Use at least 10 characters." });
      return false;
    }
    if (authMode() === "supabase") {
      const sb = getSupabaseBrowser();
      if (sb) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { displayName } } });
        if (error) {
          set({ authBusy: false, authError: error.message });
          return false;
        }
        if (!data.user) {
          set({ authBusy: false, authError: "Check your email to confirm the Supabase account." });
          return false;
        }
        const profile: UserProfile = {
          id: data.user.id,
          email,
          displayName: displayName || email.split("@")[0],
          createdAt: nowIso(),
          authMode: "supabase",
        };
        localDb.setUser(profile);
        set({ user: profile, authBusy: false, authMode: "supabase", prefs: DEFAULT_PREFERENCES, scans: [], chat: [] });
        persist(profile.id, [], DEFAULT_PREFERENCES, []);
        return true;
      }
    }
    const accounts = demoAccounts();
    if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      set({ authBusy: false, authError: "That demo account already exists. Log in instead." });
      return false;
    }
    const profile: UserProfile = {
      id: uid("user"),
      email,
      displayName: displayName || email.split("@")[0],
      createdAt: nowIso(),
      authMode: "demo",
    };
    accounts.push({ email, passwordHash: await hashPassword(password), profile });
    saveDemoAccounts(accounts);
    localDb.setUser(profile);
    set({
      user: profile,
      authBusy: false,
      prefs: DEFAULT_PREFERENCES,
      scans: [],
      chat: [],
      caregiverProfile: localDb.getCaregiverProfile(profile.id),
    });
    persist(profile.id, [], DEFAULT_PREFERENCES, []);
    return true;
  },
  login: async (email, password) => {
    set({ authBusy: true, authError: null });
    if (authMode() === "supabase") {
      const sb = getSupabaseBrowser();
      if (sb) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          set({ authBusy: false, authError: error?.message ?? "Supabase login failed." });
          return false;
        }
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email ?? email,
          displayName: (data.user.user_metadata?.displayName as string) || email.split("@")[0],
          createdAt: data.user.created_at ?? nowIso(),
          authMode: "supabase",
        };
        localDb.setUser(profile);
        set({
          user: profile,
          authBusy: false,
          authMode: "supabase",
          prefs: localDb.getPrefs(profile.id),
          scans: localDb.getScans(profile.id),
          chat: localDb.getChat(profile.id),
          caregiver: localDb.getCaregiver(profile.id),
          alerts: localDb.getAlerts(profile.id),
          caregiverProfile: localDb.getCaregiverProfile(profile.id),
        });
        return true;
      }
    }
    const accounts = demoAccounts();
    const hash = await hashPassword(password);
    const found = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.passwordHash === hash);
    if (!found) {
      set({ authBusy: false, authError: "Email or password does not match a demo account." });
      return false;
    }
    localDb.setUser(found.profile);
    set({
      user: found.profile,
      authBusy: false,
      prefs: localDb.getPrefs(found.profile.id),
      scans: localDb.getScans(found.profile.id),
      chat: localDb.getChat(found.profile.id),
      caregiver: localDb.getCaregiver(found.profile.id),
      alerts: localDb.getAlerts(found.profile.id),
      caregiverProfile: localDb.getCaregiverProfile(found.profile.id),
    });
    return true;
  },
  loginDemo: async () => {
    const email = "guardian.demo@labellens.local";
    const password = "DemoGuardian-2026!";
    const accounts = demoAccounts();
    if (!accounts.some((a) => a.email === email)) {
      await get().register(email, password, "Demo Analyst");
      return true;
    }
    return get().login(email, password);
  },
  logout: async () => {
    if (get().authMode === "supabase") {
      await getSupabaseBrowser()?.auth.signOut();
    }
    localDb.setUser(null);
    set({
      user: null,
      scans: [],
      chat: [],
      activeScanId: null,
      phase: "idle",
      previewUrl: null,
    });
  },
  savePrefs: (prefs) => {
    const { user, scans, chat } = get();
    set({ prefs });
    if (user) persist(user.id, scans, prefs, chat);
  },
  resetPrefs: () => get().savePrefs(DEFAULT_PREFERENCES),
  setPreview: (url, name = null) => {
    set({ previewUrl: url, pendingFileName: name, scanError: null });
    if (url) {
      void assessImageQuality(url).then((report) => {
        set({ activeQualityReport: report });
      });
    } else {
      set({ activeQualityReport: null });
    }
  },
  assessCurrentPreviewQuality: async () => {
    const url = get().previewUrl;
    if (!url) return null;
    const report = await assessImageQuality(url);
    set({ activeQualityReport: report });
    return report;
  },
  updateFieldCorrection: (fieldName, value) => {
    const { activeScanId, scans, user, prefs, chat } = get();
    if (!activeScanId) return;
    const scan = scans.find((s) => s.id === activeScanId);
    if (!scan) return;
    const updatedProduct = applyFieldCorrectionToRecord(scan.product, fieldName, value);
    const updatedScans = scans.map((s) =>
      s.id === activeScanId ? { ...s, product: updatedProduct, updatedAt: nowIso() } : s,
    );
    set({ scans: updatedScans });
    if (user) {
      persist(user.id, updatedScans, prefs, chat);
    }
  },
  confirmField: (fieldName) => {
    const { activeScanId, scans, user, prefs, chat } = get();
    if (!activeScanId) return;
    const scan = scans.find((s) => s.id === activeScanId);
    if (!scan) return;
    const updatedProduct = confirmExtractedField(scan.product, fieldName);
    const updatedScans = scans.map((s) =>
      s.id === activeScanId ? { ...s, product: updatedProduct, updatedAt: nowIso() } : s,
    );
    set({ scans: updatedScans });
    if (user) {
      persist(user.id, updatedScans, prefs, chat);
    }
  },
  setForceFailNext: (v) => set({ forceFailNext: v }),
  setPhase: (p) => set({ phase: p }),
  startUpload: async (dataUrl, fileName) => {
    const { user, forceFailNext } = get();
    if (!user) {
      set({ scanError: "Sign in (demo or production) before scanning." });
      return false;
    }
    if (isBusyPhase(get().phase)) return false;
    set({
      phase: "uploading",
      uploadProgress: 15,
      previewUrl: dataUrl,
      pendingFileName: fileName,
      scanError: null,
    });
    await tickProgress();
    set({ phase: "processing", uploadProgress: 50 });
    try {
      // 1. Run real optical image quality assessment
      const qualityReport = await assessImageQuality(dataUrl);
      set({ activeQualityReport: qualityReport, uploadProgress: 75 });

      // 2. Run OCR pipeline
      const ocr = await runOcrPipeline(dataUrl, { forceFail: forceFailNext, fileName });

      // Save high-resolution image to IndexedDB
      const scanId = uid("scan");
      await saveScanImage(scanId, dataUrl).catch((err) => {
        console.warn("[Store] ImageStore write fallback:", err);
      });

      // 3. Extract and construct structured product record with uncertainty tracking
      const product = buildProductFromOcr({
        ocrText: ocr.text || "Unreadable label",
        confidence: ocr.confidence,
        imageDataUrl: dataUrl,
        qualityReport,
      });
      product.imageRef = scanId;

      if (!ocr.text.trim()) {
        product.missingInformation.push("OCR returned empty text.");
        product.uncertainties.push("Treat all fields as unknown.");
      }
      if (ocr.provider === "demo-fixture") {
        product.dataSource =
          "Demo OCR fixture (structured sample text). Not Tesseract output from a photograph.";
        product.uncertainties.push("This scan used the built-in demonstration OCR fixture.");
      }
      const scan: ScanRecord = {
        id: scanId,
        userId: user.id,
        product,
        phase: "reviewing",
        saved: get().prefs.saveScans,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const scans = [scan, ...get().scans];
      set({
        scans,
        activeScanId: scan.id,
        phase: "reviewing",
        uploadProgress: 100,
        forceFailNext: false,
      });
      persist(user.id, scans, get().prefs, get().chat);
      setTimeout(() => {
        if (get().activeScanId === scan.id && get().phase === "reviewing") {
          set({ phase: "completed" });
          const updated = get().scans.map((s) => (s.id === scan.id ? { ...s, phase: "completed" as const } : s));
          set({ scans: updated });
          persist(user.id, updated, get().prefs, get().chat);
        }
      }, 400);
      return true;
    } catch (err) {
      set({
        phase: "failed",
        scanError: err instanceof Error ? err.message : "Scan failed",
        uploadProgress: 0,
        forceFailNext: false,
      });
      return false;
    }
  },
  simulateDemoOcr: async () => {
    return get().startUpload(DEMO_LABEL_DATA_URL, DEMO_LABEL_FILENAME);
  },
  loadSample: async (productId) => {
    const { user } = get();
    if (!user) {
      set({ scanError: "Enter the laboratory first (demo login)." });
      return;
    }
    const { getSampleById, SAMPLE_PRODUCTS: samples } = await import("@/data/samples");
    const product = getSampleById(productId) ?? samples.find((p) => p.id === productId);
    if (!product) {
      set({ scanError: "Sample not found." });
      return;
    }
    set({ phase: "processing", scanError: null, uploadProgress: 40, previewUrl: null });
    await new Promise((r) => setTimeout(r, 350));
    const scan: ScanRecord = {
      id: uid("scan"),
      userId: user.id,
      product: { ...product, capturedAt: nowIso() },
      phase: "completed",
      saved: get().prefs.saveScans,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const scans = [scan, ...get().scans];
    set({ scans, activeScanId: scan.id, phase: "completed", uploadProgress: 100 });
    persist(user.id, scans, get().prefs, get().chat);
  },
  scanManual: async (text) => {
    const { user } = get();
    if (!user) return;
    if (text.trim().length < 8) {
      set({ scanError: "Paste more label text so extraction has something to parse." });
      return;
    }
    set({ phase: "processing" });
    const product = productFromManualText(text);
    const scan: ScanRecord = {
      id: uid("scan"),
      userId: user.id,
      product,
      phase: "completed",
      saved: get().prefs.saveScans,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const scans = [scan, ...get().scans];
    set({ scans, activeScanId: scan.id, phase: "completed" });
    persist(user.id, scans, get().prefs, get().chat);
  },
  retryScan: async () => {
    const { previewUrl, pendingFileName } = get();
    if (previewUrl) return get().startUpload(previewUrl, pendingFileName || "retry.png");
    set({ scanError: "Nothing to retry. Provide an image or sample." });
    return false;
  },
  cancelScan: () => {
    if (get().phase === "uploading" || get().phase === "processing") {
      set({ phase: "cancelled", uploadProgress: 0 });
    }
  },
  selectIngredient: (id) => set({ selectedIngredientId: id }),
  toggleSaved: (scanId) => {
    const { user } = get();
    const scans = get().scans.map((s) => (s.id === scanId ? { ...s, saved: !s.saved } : s));
    set({ scans });
    if (user) persist(user.id, scans, get().prefs, get().chat);
  },
  deleteScan: (scanId) => {
    const { user, activeScanId } = get();
    const scans = get().scans.filter((s) => s.id !== scanId);
    set({ scans, activeScanId: activeScanId === scanId ? scans[0]?.id ?? null : activeScanId });
    if (user) persist(user.id, scans, get().prefs, get().chat);
    deleteScanImage(scanId).catch(() => {});
  },
  clearHistory: () => {
    const { user } = get();
    set({ scans: [], activeScanId: null });
    if (user) persist(user.id, [], get().prefs, get().chat);
    clearAllScanImages().catch(() => {});
  },
  setCompare: (slot, id) => set(slot === "left" ? { compareLeft: id } : { compareRight: id }),
  setRadar: (slot, id) => set(slot === "left" ? { radarLeft: id } : { radarRight: id }),
  sendChat: async (question) => {
    const { user, chat, prefs } = get();
    if (!question.trim()) return;
    const product = get().activeProduct();
    const catalog = get().catalog();
    const compareWith = catalog.find((p) => p.id === get().compareRight) ?? null;
    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: question.trim(),
      createdAt: nowIso(),
      sources: [],
    };
    set({ chatBusy: true, chat: [...chat, userMsg] });
    let reply = answerAboutProduct(question, product, { compareWith, prefs });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, product, prefs, compareWith }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.message) reply = json.message;
      }
    } catch {
      /* local grounded answer already prepared */
    }
    const next = [...get().chat, reply];
    set({ chat: next, chatBusy: false });
    if (user) persist(user.id, get().scans, prefs, next);
  },
  setCaregiver: (c) => {
    const { user } = get();
    set({ caregiver: c });
    if (user) localDb.setCaregiver(user.id, c);
  },
  setCaregiverOptIn: (v) => {
    const { user } = get();
    set({ caregiverOptIn: v });
    if (user) localDb.setOptIn(user.id, v);
  },
  setVeganOverride: (name: string, status: VeganStatus) => {
    const { user } = get();
    const veganOverrides = { ...get().veganOverrides, [name.toLowerCase()]: status };
    set({ veganOverrides });
    if (user) localDb.setOverrides(user.id, veganOverrides);
  },
  triggerAlert: (product, rule) => {
    const { user, caregiverOptIn, caregiver } = get();
    if (!canSimulateAlert(caregiverOptIn, caregiver)) return;
    const alert = buildSimulatedAlert(product, rule);
    const alerts = [alert, ...get().alerts];
    set({ alerts });
    if (user) localDb.setAlerts(user.id, alerts);
  },
  deleteAlert: (id: string) => {
    const { user } = get();
    const alerts = get().alerts.filter((a) => a.id !== id);
    set({ alerts });
    if (user) localDb.setAlerts(user.id, alerts);
  },
  saveCaregiverProfile: (profile: CaregiverProfile) => {
    const { user } = get();
    set({ caregiverProfile: profile });
    if (user) localDb.setCaregiverProfile(user.id, profile);
  },
  resolveConfirmation: (comparisonId: string, actionValue: string) => {
    const { user, caregiverProfile } = get();
    if (!caregiverProfile) return;
    const updated: CaregiverProfile = {
      ...caregiverProfile,
      userConfirmations: {
        ...caregiverProfile.userConfirmations,
        [comparisonId]: { action: actionValue, decidedAt: new Date().toISOString() },
      },
      updatedAt: new Date().toISOString(),
    };
    set({ caregiverProfile: updated });
    if (user) localDb.setCaregiverProfile(user.id, updated);
  },
  dismissAlert: (comparisonId: string) => {
    const { user, caregiverProfile } = get();
    if (!caregiverProfile) return;
    const updated: CaregiverProfile = {
      ...caregiverProfile,
      dismissedAlertIds: Array.from(new Set([...caregiverProfile.dismissedAlertIds, comparisonId])),
      updatedAt: new Date().toISOString(),
    };
    set({ caregiverProfile: updated });
    if (user) localDb.setCaregiverProfile(user.id, updated);
  },
  setHighlightedEvidenceId: (id: string | null) => {
    set({ highlightedEvidenceId: id });
  },
  activeComparisons: () => {
    const product = get().activeProduct();
    if (!product) return [];
    const prefs = get().prefs;
    const caregiverProfile = get().caregiverProfile;
    return evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: prefs,
      caregiverProfile,
    });
  },
  activeProduct: () => {
    const { scans, activeScanId } = get();
    return scans.find((s) => s.id === activeScanId)?.product ?? scans[0]?.product ?? null;
  },
  catalog: () => {
    const scans = get().scans.map((s) => s.product);
    const map = new Map<string, ProductRecord>();
    SAMPLE_PRODUCTS.forEach((p) => map.set(p.id, p));
    scans.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  },
}));

async function tickProgress() {
  await new Promise((r) => setTimeout(r, 180));
  useGuardianStore.setState({ uploadProgress: 45 });
  await new Promise((r) => setTimeout(r, 180));
}

export { FAIL_TOKEN };
