import { describe, it, expect, beforeEach } from "vitest";
import { localDb } from "@/lib/storage/local";
import { evaluateEvidenceGroundedComparisons } from "@/lib/dietary/comparisonEngine";
import { buildProductFromOcr } from "@/lib/extract/label";
import { DEFAULT_PREFERENCES, type ProductRecord } from "@/types";
import type { CaregiverProfile, NutritionThreshold } from "@/types/comparison";

describe("Additional Requirement: Caregiver Settings, Profiles, Thresholds & Personalized Alerts Suite", () => {
  const sampleOcrText = [
    "Nova Fuel Protein Crunch",
    "Ingredients: Rolled oats, whey protein isolate, cane sugar, sea salt, almond butter.",
    "Contains: Milk, Tree nuts (Almonds).",
    "Nutrition Facts",
    "Serving size: 50g",
    "Calories: 210",
    "Total Fat: 5g",
    "Saturated Fat: 1.5g",
    "Total Sugars: 14g",
    "Sodium: 450mg",
    "Protein: 15g",
  ].join("\n");

  const product = buildProductFromOcr({ ocrText: sampleOcrText, confidence: 94 });

  const userId = "caregiver-user-1";
  const dependentProfile: CaregiverProfile = {
    userId,
    dependentName: "Maya",
    dietaryPlan: {
      vegan: true,
      vegetarian: true,
      allergies: ["milk", "peanuts"],
      ingredientsToAvoid: ["added sugar"],
    },
    thresholds: [
      {
        id: "th-sugars",
        nutrient: "Total Sugars",
        operator: ">=",
        limit: 10,
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
    ],
    userConfirmations: {},
    dismissedAlertIds: [],
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Clear test storage keys
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  // Caregiver Test 1: Caregiver successfully saves a dietary profile
  it("Caregiver 1: caregiver successfully creates and saves a dependent dietary profile", () => {
    localDb.setCaregiverProfile(userId, dependentProfile);
    const retrieved = localDb.getCaregiverProfile(userId);

    expect(retrieved.dependentName).toBe("Maya");
    expect(retrieved.dietaryPlan.vegan).toBe(true);
    expect(retrieved.dietaryPlan.allergies).toContain("milk");
    expect(retrieved.thresholds.length).toBe(2);
  });

  // Caregiver Test 2: Saved preferences and thresholds persist after session restore
  it("Caregiver 2: saved preferences and thresholds persist across simulated session restore", () => {
    localDb.setCaregiverProfile(userId, dependentProfile);

    // Simulate new session
    const restored = localDb.getCaregiverProfile(userId);
    expect(restored.thresholds[0].limit).toBe(10);
    expect(restored.thresholds[0].nutrient).toBe("Total Sugars");
  });

  // Caregiver Test 3: Unauthorized users cannot tamper with another user's profile
  it("Caregiver 3: separate users access distinct profiles with zero cross-contamination", () => {
    const userA = "user-alpha";
    const userB = "user-beta";

    localDb.setCaregiverProfile(userA, { ...dependentProfile, userId: userA, dependentName: "Child A" });
    localDb.setCaregiverProfile(userB, { ...dependentProfile, userId: userB, dependentName: "Child B" });

    expect(localDb.getCaregiverProfile(userA).dependentName).toBe("Child A");
    expect(localDb.getCaregiverProfile(userB).dependentName).toBe("Child B");
  });

  // Caregiver Test 4: Declared ingredient triggers the correct configured restriction
  it("Caregiver 4: declared allergen ingredient triggers confirmed conflict matching caregiver profile", () => {
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: dependentProfile,
    });

    const milkAlert = results.find((r) => r.ruleId === "allergen.milk");
    expect(milkAlert).toBeDefined();
    expect(milkAlert?.status).toBe("CONFIRMED_CONFLICT");
    expect(milkAlert?.explanation).toContain("milk");
  });

  // Caregiver Test 5: A nutrition value exceeding a compatible configured threshold triggers an alert
  it("Caregiver 5: nutrition value exceeding threshold triggers alert with exact value and limit", () => {
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: dependentProfile,
    });

    // 14g sugar exceeds 10g limit
    const sugarAlert = results.find((r) => r.ruleId === "threshold.th-sugars");
    expect(sugarAlert).toBeDefined();
    expect(sugarAlert?.status).toBe("CONFIRMED_CONFLICT");
    expect(sugarAlert?.originalExtractedText).toContain("14 g");
    expect(sugarAlert?.thresholdApplied?.limit).toBe(10);
  });

  // Caregiver Test 6: Incompatible units or serving bases are not compared incorrectly
  it("Caregiver 6: values with incompatible units are flagged as UNCERTAIN rather than producing false alert", () => {
    const incompatibleProfile: CaregiverProfile = {
      ...dependentProfile,
      thresholds: [
        {
          id: "th-bad-unit",
          nutrient: "Sodium",
          operator: ">=",
          limit: 10,
          unit: "calories", // Incompatible with mg!
          basis: "per_serving",
          enabled: true,
        },
      ],
    };

    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: incompatibleProfile,
    });

    const sodiumAlert = results.find((r) => r.ruleId === "threshold.th-bad-unit");
    expect(sodiumAlert).toBeDefined();
    expect(sodiumAlert?.status).toBe("UNCERTAIN");
    expect(sodiumAlert?.explanation).toContain("incompatible");
  });

  // Caregiver Test 7: Missing or unreadable ingredient produces missing information state
  it("Caregiver 7: missing nutrient on label produces MISSING_INFORMATION threshold state", () => {
    const potassiumProfile: CaregiverProfile = {
      ...dependentProfile,
      thresholds: [
        {
          id: "th-potassium",
          nutrient: "Potassium", // Not in label
          operator: ">=",
          limit: 300,
          unit: "mg",
          basis: "per_serving",
          enabled: true,
        },
      ],
    };

    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: potassiumProfile,
    });

    const potassiumAlert = results.find((r) => r.ruleId === "threshold.th-potassium");
    expect(potassiumAlert).toBeDefined();
    expect(potassiumAlert?.status).toBe("MISSING_INFORMATION");
  });

  // Caregiver Test 8: Different users with different dietary profiles receive different results
  it("Caregiver 8: different dependents receive personalized alert sets for the exact same label", () => {
    const profileStrict: CaregiverProfile = {
      ...dependentProfile,
      thresholds: [
        { id: "th-low-sugar", nutrient: "Total Sugars", operator: ">=", limit: 5, unit: "g", basis: "per_serving", enabled: true },
      ],
    };
    const profileLenient: CaregiverProfile = {
      ...dependentProfile,
      thresholds: [
        { id: "th-high-sugar", nutrient: "Total Sugars", operator: ">=", limit: 30, unit: "g", basis: "per_serving", enabled: true },
      ],
    };

    const resultsStrict = evaluateEvidenceGroundedComparisons({ product, userPrefs: DEFAULT_PREFERENCES, caregiverProfile: profileStrict });
    const resultsLenient = evaluateEvidenceGroundedComparisons({ product, userPrefs: DEFAULT_PREFERENCES, caregiverProfile: profileLenient });

    expect(resultsStrict.find((r) => r.ruleId === "threshold.th-low-sugar")?.status).toBe("CONFIRMED_CONFLICT");
    expect(resultsLenient.find((r) => r.ruleId === "threshold.th-high-sugar")?.status).toBe("NO_DETECTED_CONFLICT");
  });

  // Caregiver Test 9: Updating a threshold recalculates the affected result
  it("Caregiver 9: updating threshold limit recalculates comparison outcome immediately", () => {
    let currentThresholds: NutritionThreshold[] = [
      { id: "th-dynamic", nutrient: "Sodium", operator: ">=", limit: 400, unit: "mg", basis: "per_serving", enabled: true },
    ];

    // Label sodium is 450mg -> exceeds 400mg
    let results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: { ...dependentProfile, thresholds: currentThresholds },
    });
    expect(results.find((r) => r.ruleId === "threshold.th-dynamic")?.status).toBe("CONFIRMED_CONFLICT");

    // Caregiver raises limit to 500mg -> complies!
    currentThresholds = [
      { id: "th-dynamic", nutrient: "Sodium", operator: ">=", limit: 500, unit: "mg", basis: "per_serving", enabled: true },
    ];
    results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: { ...dependentProfile, thresholds: currentThresholds },
    });
    expect(results.find((r) => r.ruleId === "threshold.th-dynamic")?.status).toBe("NO_DETECTED_CONFLICT");
  });

  // Caregiver Test 10: Updating an allergy recalculates the affected result
  it("Caregiver 10: adding new allergy recalculates results for current product", () => {
    const profileWithoutTreeNuts: CaregiverProfile = {
      ...dependentProfile,
      dietaryPlan: { ...dependentProfile.dietaryPlan, allergies: ["peanuts"] },
    };
    const cleanPrefs = { ...DEFAULT_PREFERENCES, allergensToFlag: [] };
    let results = evaluateEvidenceGroundedComparisons({ product, userPrefs: cleanPrefs, caregiverProfile: profileWithoutTreeNuts });
    expect(results.some((r) => r.ruleId === "allergen.tree nuts")).toBe(false);

    // Add tree nuts
    const profileWithTreeNuts: CaregiverProfile = {
      ...dependentProfile,
      dietaryPlan: { ...dependentProfile.dietaryPlan, allergies: ["peanuts", "tree nuts"] },
    };
    results = evaluateEvidenceGroundedComparisons({ product, userPrefs: cleanPrefs, caregiverProfile: profileWithTreeNuts });
    expect(results.some((r) => r.ruleId === "allergen.tree nuts" && r.status === "CONFIRMED_CONFLICT")).toBe(true);
  });

  // Caregiver Test 11: Every important alert links to exact supporting evidence
  it("Caregiver 11: every threshold and allergen alert carries exact supporting text and evidence ref", () => {
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: dependentProfile,
    });

    for (const alert of results) {
      if (alert.status === "CONFIRMED_CONFLICT") {
        expect(alert.originalExtractedText).toBeDefined();
        expect(alert.supportingEvidenceRefs.length).toBeGreaterThan(0);
      }
    }
  });

  // Caregiver Test 12: Contradictory model interpretations do not override source evidence
  it("Caregiver 12: model assertions cannot suppress an allergen detected in label evidence", () => {
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: dependentProfile,
      modelInterpretation: {
        claimsAllergenFree: true, // Unsupported model claim!
      },
    });

    const milkAlert = results.find((r) => r.ruleId === "allergen.milk");
    expect(milkAlert?.status).toBe("CONFIRMED_CONFLICT"); // Physical evidence stands!
  });

  // Caregiver Test 13: Unresolved confirmation requests remain unresolved
  it("Caregiver 13: user choosing leave_unresolved keeps ambiguity as UNCERTAIN without guessing", () => {
    const rawOcr = "Energy Bar\nIngredients: Oats, water, glycerin.\nContains: None.";
    const ambProduct = buildProductFromOcr({ ocrText: rawOcr, confidence: 90 });

    const profileWithUnresolved: CaregiverProfile = {
      ...dependentProfile,
      userConfirmations: {
        "vegan-ambiguity-ing-glycerin": {
          action: "leave_unresolved",
          decidedAt: new Date().toISOString(),
        },
      },
    };

    const results = evaluateEvidenceGroundedComparisons({
      product: ambProduct,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
      caregiverProfile: profileWithUnresolved,
    });

    const unresolved = results.find((r) => r.ruleCategory === "vegan_vegetarian");
    expect(unresolved?.status).toBe("UNCERTAIN");
    expect(unresolved?.explanation).toContain("Left unresolved by user");
  });

  // Caregiver Test 14: Incomplete label coverage never results in unsupported safety claim
  it("Caregiver 14: incomplete label coverage produces guardrail alert rather than zero-conflict claim", () => {
    const incompleteProduct = buildProductFromOcr({
      ocrText: "Snack Bar\nIngredients: Dates, nuts, ...",
    });

    const results = evaluateEvidenceGroundedComparisons({
      product: incompleteProduct,
      userPrefs: DEFAULT_PREFERENCES,
      caregiverProfile: dependentProfile,
    });

    const guardrail = results.find((r) => r.ruleId === "safety.incomplete_ingredients");
    expect(guardrail?.status).toBe("MISSING_INFORMATION");
  });

  // Caregiver Test 15: Invalid threshold inputs and fallback defaults handled gracefully
  it("Caregiver 15: default caregiver profile initializes safely with valid threshold definitions", () => {
    const defaultProfile = localDb.getCaregiverProfile("brand-new-user");
    expect(defaultProfile).toBeDefined();
    expect(defaultProfile.thresholds.length).toBeGreaterThan(0);
    expect(defaultProfile.thresholds[0].limit).toBeGreaterThan(0);
  });
});
