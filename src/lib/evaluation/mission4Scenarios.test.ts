import { describe, it, expect } from "vitest";
import { buildProductFromOcr } from "@/lib/extract/label";
import { evaluateEvidenceGroundedComparisons } from "@/lib/dietary/comparisonEngine";
import { DEFAULT_PREFERENCES } from "@/types";

describe("Mission 4 — Core Test Scenarios & Validation", () => {
  // -------------------------------------------------------------
  // Test 1: Clear Label + Stated Dietary Preference
  // -------------------------------------------------------------
  describe("Test 1: Clear Label + Stated Dietary Preference", () => {
    const clearChocolateOcr = `
HERSHEY'S MILK CHOCOLATE WITH PEANUTS
Nutrition Facts
Serving size 1 bar (41g)
Calories 220
Total Fat 14g
Saturated Fat 6g
Sodium 35mg
Total Carbohydrate 22g
Total Sugars 19g
Protein 5g

INGREDIENTS: Milk Chocolate (Sugar, Milk, Chocolate, Cocoa Butter, Milk Fat, Lecithin (Soy), PGPR, Natural Flavor), Peanuts.
Contains: Milk, Soy, Peanuts.
Manufactured by The Hershey Company, Hershey, PA 17033
`;

    it("extracts exact ingredients, allergen statement, and flags milk & peanut conflicts", () => {
      const product = buildProductFromOcr({ ocrText: clearChocolateOcr, confidence: 90 });
      const results = evaluateEvidenceGroundedComparisons({
        product,
        userPrefs: {
          ...DEFAULT_PREFERENCES,
          vegan: true,
          allergensToFlag: ["milk", "peanuts"],
        },
      });

      // 1. Verify exact ingredient extraction
      expect(product.ingredients.length).toBeGreaterThanOrEqual(2);
      expect(product.ingredients[0].originalText).toContain("Milk Chocolate (Sugar, Milk, Chocolate");

      // 2. Verify allergen statement
      expect(product.allergenStatement?.allergens).toEqual(["milk", "soy", "peanuts"]);

      // 3. Verify nutrition values
      const sugarVal = product.nutrition.values.find((v) => v.nutrient === "Total Sugars");
      expect(sugarVal?.amount).toBe(19);

      // 4. Verify dietary comparison findings
      const milkAlert = results.find((r) => r.ruleId === "allergen.milk");
      expect(milkAlert).toBeDefined();
      expect(milkAlert?.status).toBe("CONFIRMED_CONFLICT");
      expect(milkAlert?.originalExtractedText).toContain("Milk");
      expect(milkAlert?.supportingEvidenceRefs.length).toBeGreaterThan(0);

      const peanutAlert = results.find((r) => r.ruleId === "allergen.peanuts");
      expect(peanutAlert).toBeDefined();
      expect(peanutAlert?.status).toBe("CONFIRMED_CONFLICT");

      const veganAlert = results.find((r) => r.ruleId === "dietary.vegan");
      expect(veganAlert).toBeDefined();
      expect(veganAlert?.status).toBe("CONFIRMED_CONFLICT");
    });
  });

  // -------------------------------------------------------------
  // Test 2: Blurry or Partially Obscured Label
  // -------------------------------------------------------------
  describe("Test 2: Blurry or Partially Obscured Label", () => {
    const blurryOatsOcr = `
Nova Fuel Rolled Oats
Ingredients: Oats, natural flavoring...
(Nutrition panel obscured by glare and motion blur)
`;

    it("marks cropped/unreadable fields as uncertain or missing and prevents false safety claims", () => {
      const product = buildProductFromOcr({
        ocrText: blurryOatsOcr,
        confidence: 45,
      });

      const results = evaluateEvidenceGroundedComparisons({
        product,
        userPrefs: {
          ...DEFAULT_PREFERENCES,
          vegan: true,
          allergensToFlag: ["milk"],
        },
      });

      // 1. Truncated ingredient list must be flagged
      const guardrail = results.find((r) => r.ruleId === "safety.incomplete_ingredients");
      expect(guardrail).toBeDefined();
      expect(guardrail?.status).toBe("MISSING_INFORMATION");

      // 2. Vegan status cannot be verified safe
      expect(product.dietary.veganStatus).toBe("UNKNOWN");

      // 3. Allergen status must remain uncertain, NEVER declared allergen-free
      const allergenGuardrail = results.find((r) => r.ruleId === "safety.allergen_uncertain");
      expect(allergenGuardrail).toBeDefined();
      expect(allergenGuardrail?.status).toBe("UNCERTAIN");
    });
  });

  // -------------------------------------------------------------
  // Test 3: Conflicting or Incomplete Information
  // -------------------------------------------------------------
  describe("Test 3: Conflicting or Incomplete Information", () => {
    const energyBarOcr = `
Apex Endurance Bar
Ingredients: Rolled oats, brown rice syrup, glycerin, natural flavors, salt.
Contains: May contain traces of milk.
Nutrition Facts
Serving size: 60g
Calories: 240
Total Sugars: 12g
Sodium: 180mg
`;

    it("detects model contradictions and ambiguous ingredients, presenting confirmation prompts", () => {
      const product = buildProductFromOcr({ ocrText: energyBarOcr, confidence: 88 });

      // Model claims product is 100% vegan, but physical label has ambiguous glycerin
      const results = evaluateEvidenceGroundedComparisons({
        product,
        userPrefs: {
          ...DEFAULT_PREFERENCES,
          vegan: true,
        },
        modelInterpretation: {
          claimsVegan: true,
          declaredAllergens: [],
        },
      });

      // 1. Ambiguous ingredient glycerin requires confirmation
      const glycerinCheck = results.find(
        (r) => r.ruleId === "dietary.vegan.ambiguous" && r.confirmationPrompt?.originalPhrase.toLowerCase().includes("glycerin")
      );
      expect(glycerinCheck).toBeDefined();
      expect(glycerinCheck?.status).toBe("NEEDS_USER_CONFIRMATION");
      expect(glycerinCheck?.userConfirmationRequired).toBe(true);
      expect(glycerinCheck?.confirmationPrompt?.originalPhrase.toLowerCase()).toBe("glycerin");

      // 2. Contradiction between physical evidence and model claims
      expect(results.some((r) => r.ruleCategory === "contradiction" || r.ruleCategory === "safety_invariance")).toBe(true);

      // 3. Evidence references are intact and point to real items
      expect(glycerinCheck?.supportingEvidenceRefs.length).toBeGreaterThan(0);
    });
  });
});
