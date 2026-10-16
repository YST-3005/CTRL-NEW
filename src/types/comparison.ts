import type { Evidence } from "./index";

export type ComparisonResultStatus =
  | "CONFIRMED_CONFLICT"
  | "NO_DETECTED_CONFLICT"
  | "UNCERTAIN"
  | "MISSING_INFORMATION"
  | "UNRESOLVED_CONTRADICTION"
  | "NEEDS_USER_CONFIRMATION";

export type ComparisonSeverity = "alert" | "warning" | "info" | "safe";

export interface ThresholdSpec {
  nutrient: string;
  operator: ">=" | "<=" | ">" | "<";
  limit: number;
  unit: string;
  basis: "per_serving" | "per_100g";
}

export interface ConfirmationPrompt {
  id: string;
  originalPhrase: string;
  competingInterpretations: string[];
  impactReason: string;
  suggestedActions: { label: string; actionValue: string }[];
}

export interface EvidenceGroundedComparison {
  id: string;
  ruleId: string;
  ruleCategory:
    | "allergen"
    | "vegan_vegetarian"
    | "concern"
    | "nutrition_threshold"
    | "safety_invariance"
    | "contradiction";
  ruleName: string;
  status: ComparisonResultStatus;
  severity: ComparisonSeverity;
  explanation: string;
  supportingEvidenceRefs: string[]; // Ingredient IDs, evidence IDs, or field keys
  originalExtractedText?: string;
  normalizedValue?: string | number;
  thresholdApplied?: ThresholdSpec;
  confidence?: number | null;
  confidenceQuality?: "high" | "medium" | "low" | "none";
  userConfirmationRequired: boolean;
  confirmationPrompt?: ConfirmationPrompt;
  resolvedByUser?: boolean;
  resolvedAction?: string;
  timestamp: string;
}

export interface NutritionThreshold {
  id: string;
  nutrient: string; // e.g. "Total Sugars", "Sodium", "Saturated Fat", "Calories"
  operator: ">=" | "<=" | ">" | "<";
  limit: number;
  unit: string; // "g", "mg", "kcal"
  basis: "per_serving" | "per_100g";
  enabled: boolean;
}

export interface CaregiverDietaryPlan {
  vegan: boolean;
  vegetarian: boolean;
  allergies: string[];
  ingredientsToAvoid: string[];
}

export interface CaregiverProfile {
  userId: string;
  dependentName: string;
  dietaryPlan: CaregiverDietaryPlan;
  thresholds: NutritionThreshold[];
  userConfirmations: Record<string, { action: string; decidedAt: string }>;
  dismissedAlertIds: string[];
  updatedAt: string;
}

export const DEFAULT_CAREGIVER_THRESHOLDS: NutritionThreshold[] = [
  {
    id: "th-sugar",
    nutrient: "Total Sugars",
    operator: ">=",
    limit: 12,
    unit: "g",
    basis: "per_serving",
    enabled: true,
  },
  {
    id: "th-sodium",
    nutrient: "Sodium",
    operator: ">=",
    limit: 400,
    unit: "mg",
    basis: "per_serving",
    enabled: true,
  },
  {
    id: "th-satfat",
    nutrient: "Saturated Fat",
    operator: ">=",
    limit: 3,
    unit: "g",
    basis: "per_serving",
    enabled: false,
  },
];
