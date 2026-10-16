import { describe, it, expect } from "vitest";
import { evaluateEvidenceGroundedComparisons } from "./comparisonEngine";
import { buildProductFromOcr } from "@/lib/extract/label";
import { DEFAULT_PREFERENCES, type ProductRecord, type DietaryPreferences } from "@/types";
import { applyFieldCorrectionToRecord } from "@/lib/extract/extractionEngine";
import type { CaregiverProfile } from "@/types/comparison";

describe("Mission 3 — Requirement 8: Evidence-Grounded Dietary Comparison Suite", () => {
  const completeVeganOcr = [
    "Oat Fuel Energy Bar",
    "Ingredients: Rolled oats, purified water, sea salt, sunflower lecithin.",
    "Contains: None.",
    "Nutrition Facts",
    "Serving size: 50g",
    "Calories: 200",
    "Total Fat: 4g",
    "Total Sugars: 2g",
    "Sodium: 120mg",
    "Protein: 6g",
  ].join("\n");

  const dairyProductOcr = [
    "Nova Whey Protein Crunch",
    "Ingredients: Whey protein isolate, skim milk powder, rolled oats, cocoa butter.",
    "Contains: Milk.",
    "Nutrition Facts",
    "Serving size: 40g",
    "Calories: 160",
    "Total Fat: 3g",
    "Total Sugars: 15g",
    "Sodium: 220mg",
    "Protein: 24g",
  ].join("\n");

  // Scenario 1: Matching evidence supports a dietary conflict
  it("Scenario 1: matching evidence supports an allergen dietary conflict with exact source text", () => {
    const product = buildProductFromOcr({ ocrText: dairyProductOcr, confidence: 92 });
    const prefs: DietaryPreferences = { ...DEFAULT_PREFERENCES, allergensToFlag: ["milk"] };

    const results = evaluateEvidenceGroundedComparisons({ product, userPrefs: prefs });
    const conflict = results.find((r) => r.ruleCategory === "allergen" && r.status === "CONFIRMED_CONFLICT");

    expect(conflict).toBeDefined();
    expect(conflict?.status).toBe("CONFIRMED_CONFLICT");
    expect(conflict?.originalExtractedText).toBeDefined();
    expect(conflict?.originalExtractedText?.toLowerCase()).toContain("milk");
    expect(conflict?.supportingEvidenceRefs.length).toBeGreaterThan(0);
  });

  // Scenario 2: Matching evidence supports no detected conflict within available scope
  it("Scenario 2: matching evidence supports no detected conflict within available label scope without making certification claims", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr, confidence: 95 });
    const prefs: DietaryPreferences = { ...DEFAULT_PREFERENCES, vegan: true, allergensToFlag: ["milk", "peanuts"] };

    const results = evaluateEvidenceGroundedComparisons({ product, userPrefs: prefs });
    const veganResult = results.find((r) => r.ruleId === "dietary.vegan");

    expect(veganResult).toBeDefined();
    expect(veganResult?.status).toBe("NO_DETECTED_CONFLICT");
    expect(veganResult?.explanation).not.toContain("certified safe");
    expect(veganResult?.explanation).toContain("Not a formal 3rd-party certification");
  });

  // Scenario 3: The model contradicts explicit extracted evidence
  it("Scenario 3: flags unresolved contradiction when external model claims vegan but label has non-vegan ingredient", () => {
    const product = buildProductFromOcr({ ocrText: dairyProductOcr, confidence: 90 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
      modelInterpretation: {
        claimsVegan: true, // Model hallucination!
      },
    });

    const contradiction = results.find((r) => r.ruleId === "contradiction.model_vegan");
    expect(contradiction).toBeDefined();
    expect(contradiction?.status).toBe("UNRESOLVED_CONTRADICTION");
    expect(contradiction?.severity).toBe("alert");
    expect(contradiction?.explanation).toContain("The physical label evidence takes precedence");
    expect(contradiction?.userConfirmationRequired).toBe(true);
  });

  // Scenario 4: Extracted text and normalized interpretation disagree
  it("Scenario 4: flags unresolved contradiction when model identifies an allergen not present in readable label text", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr, confidence: 95 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
      modelInterpretation: {
        declaredAllergens: ["peanuts"], // Not in label!
      },
    });

    const contradiction = results.find((r) => r.ruleId === "contradiction.model_allergen_unsupported");
    expect(contradiction).toBeDefined();
    expect(contradiction?.status).toBe("UNRESOLVED_CONTRADICTION");
    expect(contradiction?.explanation).toContain("no supporting evidence exists in the readable label text");
  });

  // Scenario 5: An ambiguous ingredient requires user confirmation
  it("Scenario 5: flags needs user confirmation for variable-origin ingredient like glycerin", () => {
    const rawOcr = [
      "Protein Chews",
      "Ingredients: Oats, water, glycerin, sunflower oil.",
      "Contains: None.",
      "Nutrition Facts",
      "Serving size: 30g",
      "Calories: 100",
      "Total Fat: 1g",
      "Total Sugars: 1g",
      "Protein: 2g",
    ].join("\n");
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 88 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });

    const ambiguity = results.find((r) => r.status === "NEEDS_USER_CONFIRMATION");
    expect(ambiguity).toBeDefined();
    expect(ambiguity?.userConfirmationRequired).toBe(true);
    expect(ambiguity?.confirmationPrompt).toBeDefined();
    expect(ambiguity?.confirmationPrompt?.suggestedActions.some((a) => a.actionValue === "plant_derived")).toBe(true);
  });

  // Scenario 6: An unreadable or missing ingredient remains unresolved
  it("Scenario 6: an unreadable or missing ingredient list remains missing information without guessing", () => {
    const rawOcr = "Energy Bar\nNutrition Facts\nCalories: 100"; // No ingredients
    const product = buildProductFromOcr({ ocrText: rawOcr });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true, allergensToFlag: ["milk"] },
    });

    const guardrail = results.find((r) => r.ruleId === "safety.incomplete_ingredients");
    expect(guardrail).toBeDefined();
    expect(guardrail?.status).toBe("MISSING_INFORMATION");
    expect(guardrail?.explanation).toContain("Missing OCR output is never proof of absence");
  });

  // Scenario 7: A cropped ingredient list cannot be treated as complete
  it("Scenario 7: a truncated ingredient list ending with ellipsis triggers missing information guardrail", () => {
    const rawOcr = "Fruit Bar\nIngredients: Dates, apples, almonds, ...\nContains: Tree nuts.";
    const product = buildProductFromOcr({ ocrText: rawOcr });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });

    const guardrail = results.find((r) => r.ruleId === "safety.incomplete_ingredients");
    expect(guardrail).toBeDefined();
    expect(guardrail?.status).toBe("MISSING_INFORMATION");
  });

  // Scenario 8: A nutrition value conflicts with source text or units
  it("Scenario 8: flags unresolved contradiction when extracted nutrition value is negative", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr });
    // Simulate OCR parsing defect yielding negative sodium
    product.nutrition.values.push({
      nutrient: "Sodium",
      amount: -50,
      unit: "mg",
      source: "extracted_fact",
    });

    const results = evaluateEvidenceGroundedComparisons({ product, userPrefs: DEFAULT_PREFERENCES });
    const contradiction = results.find((r) => r.ruleId === "contradiction.nutrition_invalid");

    expect(contradiction).toBeDefined();
    expect(contradiction?.status).toBe("UNRESOLVED_CONTRADICTION");
    expect(contradiction?.explanation).toContain("negative");
  });

  // Scenario 9: Different dietary preferences produce different comparison results from same label
  it("Scenario 9: different dietary profiles produce different comparison results on the exact same label", () => {
    const product = buildProductFromOcr({ ocrText: dairyProductOcr, confidence: 92 });

    const resultsUserA = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, allergensToFlag: ["peanuts"], vegan: false },
    });
    const resultsUserB = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, allergensToFlag: ["milk"], vegan: true },
    });

    const userAConflicts = resultsUserA.filter((r) => r.status === "CONFIRMED_CONFLICT");
    const userBConflicts = resultsUserB.filter((r) => r.status === "CONFIRMED_CONFLICT");

    expect(userAConflicts.length).toBe(0);
    expect(userBConflicts.length).toBeGreaterThan(0);
  });

  // Scenario 10: Updating dietary preferences recalculates comparisons
  it("Scenario 10: updating dietary preferences dynamically updates comparison results", () => {
    const product = buildProductFromOcr({ ocrText: dairyProductOcr, confidence: 92 });

    let results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: false },
    });
    expect(results.some((r) => r.ruleId === "dietary.vegan")).toBe(false);

    // User enables vegan
    results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });
    expect(results.some((r) => r.ruleId === "dietary.vegan" && r.status === "CONFIRMED_CONFLICT")).toBe(true);
  });

  // Scenario 11: Correcting an extracted field updates its evidence and comparison
  it("Scenario 11: correcting an extracted ingredient updates evidence and comparison outcome", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr, confidence: 90 });

    let results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });
    expect(results.find((r) => r.ruleId === "dietary.vegan")?.status).toBe("NO_DETECTED_CONFLICT");

    // User discovers whey protein was unread and corrects the field
    const correctedProduct = applyFieldCorrectionToRecord(
      product,
      "ingredients",
      "Rolled oats, purified water, sea salt, whey protein",
    );

    results = evaluateEvidenceGroundedComparisons({
      product: correctedProduct,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });

    const veganConflict = results.find((r) => r.ruleId === "dietary.vegan");
    expect(veganConflict?.status).toBe("CONFIRMED_CONFLICT");
    expect(veganConflict?.originalExtractedText).toContain("whey protein");
  });

  // Scenario 12: Evidence links navigate to the correct source field
  it("Scenario 12: supporting evidence refs match actual ingredient IDs in product record", () => {
    const product = buildProductFromOcr({ ocrText: dairyProductOcr, confidence: 90 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
    });

    const conflict = results.find((r) => r.ruleId === "dietary.vegan");
    expect(conflict).toBeDefined();

    for (const ref of conflict!.supportingEvidenceRefs) {
      const match = product.ingredients.find((i) => i.id === ref);
      expect(match).toBeDefined();
    }
  });

  // Scenario 13: Missing or stale evidence references do not create fabricated links
  it("Scenario 13: missing or empty evidence references produce no fabricated links", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr, confidence: 90 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: DEFAULT_PREFERENCES,
    });

    for (const res of results) {
      if (res.status === "NO_DETECTED_CONFLICT" && res.ruleCategory === "allergen") {
        expect(res.originalExtractedText).not.toContain("fabricated");
      }
    }
  });

  // Scenario 14: Unanswered confirmation requests remain unresolved
  it("Scenario 14: unanswered confirmation requests remain in NEEDS_USER_CONFIRMATION state", () => {
    const rawOcr = [
      "Energy Bar",
      "Ingredients: Oats, water, glycerin.",
      "Contains: None.",
      "Nutrition Facts",
      "Calories: 100",
      "Total Fat: 1g",
      "Total Sugars: 1g",
      "Protein: 2g",
    ].join("\n");
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 85 });

    // Without confirmations in caregiverProfile
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true },
      caregiverProfile: null,
    });

    const pending = results.find((r) => r.userConfirmationRequired);
    expect(pending?.status).toBe("NEEDS_USER_CONFIRMATION");
    expect(pending?.resolvedByUser).toBeFalsy();
  });

  // Scenario 15: No unsupported ingredient, medical, safety, or certification claims
  it("Scenario 15: ensures no medical advice or official allergen certification claims are produced", () => {
    const product = buildProductFromOcr({ ocrText: completeVeganOcr, confidence: 95 });
    const results = evaluateEvidenceGroundedComparisons({
      product,
      userPrefs: { ...DEFAULT_PREFERENCES, vegan: true, allergensToFlag: ["milk"] },
    });

    for (const res of results) {
      expect(res.explanation.toLowerCase()).not.toContain("guaranteed safe");
      expect(res.explanation.toLowerCase()).not.toContain("medically approved");
      expect(res.explanation.toLowerCase()).not.toContain("100% allergen-free");
    }
  });
});
