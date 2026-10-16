export type DataOrigin = "demonstration_sample" | "user_scan" | "external_record";
export type EvidenceKind = "extracted_fact" | "inferred_interpretation" | "unknown";
export type ScanPhase =
  | "idle"
  | "uploading"
  | "processing"
  | "reviewing"
  | "completed"
  | "failed"
  | "cancelled";

export type VeganStatus = "VEGAN" | "NON-VEGAN" | "UNKNOWN";
export type AuthMode = "demo" | "supabase";
export type NotificationDeliveryStatus = "simulated" | "queued" | "sent" | "delivered" | "failed" | "not_sent";

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  claim: string;
  sourceText?: string;
  sourceField?: string;
  notes?: string;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface NutritionValue {
  nutrient: string;
  amount: number | null;
  unit: string;
  dailyValuePercent?: number | null;
  source: EvidenceKind;
}

export interface Ingredient {
  id: string;
  name: string;
  aliases: string[];
  originalText: string;
  order: number;
  veganStatus: VeganStatus;
  originNote: string;
  classificationReason: string;
  evidenceQuality: "high" | "medium" | "low" | "none";
  evidence: Evidence[];
  allergenTags: string[];
  concernTags: string[];
}

export interface AllergenStatement {
  text: string;
  allergens: string[];
  evidence: Evidence;
}

export interface NutritionFacts {
  servingSizeAmount: number | null;
  servingSizeUnit: string;
  servingsPerContainer?: number | null;
  values: NutritionValue[];
  incomplete: boolean;
  notes: string[];
}

export interface ProductRecord {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: "food" | "supplement" | "medicine";
  description: string;
  dataOrigin: DataOrigin;
  dataSource: string;
  completeness: number;
  ingredients: Ingredient[];
  nutrition: NutritionFacts;
  allergenStatement?: AllergenStatement;
  dietary: {
    veganStatus: VeganStatus;
    veganSummary: string;
    vegetarianLikely: boolean | null;
    containsAddedSugar: boolean | null;
    flags: string[];
  };
  benefits: { text: string; evidence: Evidence }[];
  concerns: { text: string; evidence: Evidence }[];
  missingInformation: string[];
  uncertainties: string[];
  imageDataUrl?: string;
  thumbnail?: string;
  extractedText?: string;
  extractionConfidence?: number;
  labelVersion: number;
  capturedAt: string;
  medicineDisclaimer?: string;
  extractionRecord?: StructuredExtractionRecord;
}

export type FieldStatus = "CONFIRMED" | "UNCERTAIN" | "MISSING" | "NEEDS_REVIEW" | "USER_CORRECTED";

export interface ExtractedField<T = any> {
  fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size" | "warnings";
  label: string;
  extractedValue: T;
  originalSourceText: string;
  confidence: number | null; // Honest OCR provider confidence or null if unsupported
  confidenceEstimate?: number; // Documented quality estimate when provider confidence is unavailable
  status: FieldStatus;
  statusReason?: string;
  evidence?: Evidence;
  userConfirmed: boolean;
  userCorrected: boolean;
  correctedValue?: T;
  correctedAt?: string;
  originalValueBeforeCorrection?: T;
}

export interface StructuredExtractionRecord {
  id: string;
  productName: ExtractedField<string>;
  ingredients: ExtractedField<Ingredient[]>;
  allergens: ExtractedField<AllergenStatement | null>;
  nutrition: ExtractedField<NutritionFacts>;
  servingSize: ExtractedField<{ amount: number | null; unit: string }>;
  warnings: ExtractedField<string[]>;
  completenessScore: number;
  hasConflicts: boolean;
  conflictNotes: string[];
  assessedAt: string;
}

export interface ScanRecord {
  id: string;
  userId: string;
  product: ProductRecord;
  phase: ScanPhase;
  error?: string;
  saved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabelVersionPair {
  productId: string;
  productName: string;
  older: ProductRecord;
  newer: ProductRecord;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  authMode: AuthMode;
}

export interface DietaryPreferences {
  vegan: boolean;
  vegetarian: boolean;
  allergensToFlag: string[];
  ingredientsOfConcern: string[];
  preferredServingUnit: "g" | "ml" | "oz";
  motion: "full" | "reduced";
  notificationsOptIn: boolean;
  privacyLocalOnly: boolean;
  saveScans: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  sources: Evidence[];
  educationalOnly?: boolean;
  unknown?: boolean;
}

export interface CaregiverContact {
  name: string;
  channel: "email" | "sms";
  address: string;
}

export interface CaregiverAlert {
  id: string;
  rule: string;
  productName: string;
  preview: string;
  status: NotificationDeliveryStatus;
  simulated: true;
  createdAt: string;
}

export interface CompareSelection {
  leftId: string | null;
  rightId: string | null;
}

export const DEFAULT_PREFERENCES: DietaryPreferences = {
  vegan: false,
  vegetarian: false,
  allergensToFlag: ["milk", "eggs", "peanuts", "tree nuts", "soy", "wheat", "fish", "shellfish", "sesame"],
  ingredientsOfConcern: ["added sugar", "hydrogenated oil"],
  preferredServingUnit: "g",
  motion: "full",
  notificationsOptIn: false,
  privacyLocalOnly: true,
  saveScans: true,
};

export const COMMON_ALLERGENS = [
  "milk",
  "eggs",
  "peanuts",
  "tree nuts",
  "soy",
  "wheat",
  "fish",
  "shellfish",
  "sesame",
] as const;
