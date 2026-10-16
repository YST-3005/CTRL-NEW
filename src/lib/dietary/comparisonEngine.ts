import type {
  ProductRecord,
  DietaryPreferences,
  Ingredient,
} from "@/types";
import type {
  EvidenceGroundedComparison,
  CaregiverProfile,
  NutritionThreshold,
  ComparisonResultStatus,
  ComparisonSeverity,
  ThresholdSpec,
} from "@/types/comparison";
import { normalizeName, uid } from "@/lib/utils";
import { toBase } from "@/lib/nutrition/serving";

export interface ModelInterpretation {
  claimsVegan?: boolean;
  declaredAllergens?: string[];
  claimsAllergenFree?: boolean;
  notes?: string;
}

export function evaluateEvidenceGroundedComparisons(params: {
  product: ProductRecord;
  userPrefs: DietaryPreferences;
  caregiverProfile?: CaregiverProfile | null;
  modelInterpretation?: ModelInterpretation | null;
}): EvidenceGroundedComparison[] {
  const { product, userPrefs, caregiverProfile, modelInterpretation } = params;
  const comparisons: EvidenceGroundedComparison[] = [];
  const now = new Date().toISOString();

  const extraction = product.extractionRecord;
  const isIngredientIncomplete =
    extraction?.ingredients.status === "NEEDS_REVIEW" ||
    extraction?.ingredients.status === "UNCERTAIN" ||
    extraction?.ingredients.status === "MISSING" ||
    product.ingredients.length === 0;

  const isAllergenStatementUncertain =
    !product.allergenStatement ||
    extraction?.allergens.status === "UNCERTAIN" ||
    extraction?.allergens.status === "MISSING";

  // Active confirmations map from caregiver or local store
  const confirmations = caregiverProfile?.userConfirmations ?? {};

  // -------------------------------------------------------------
  // 1. Mandatory Fail-Safe Invariance (Requirement 1, 6, 7)
  // -------------------------------------------------------------
  if (isIngredientIncomplete) {
    comparisons.push({
      id: "invariance-incomplete-ingredients",
      ruleId: "safety.incomplete_ingredients",
      ruleCategory: "safety_invariance",
      ruleName: "Ingredient Completeness Guardrail",
      status: "MISSING_INFORMATION",
      severity: "alert",
      explanation:
        "The ingredient list is incomplete, truncated, or unreadable. The available label evidence is insufficient to confirm whether this product meets your restrictions. Missing OCR output is never proof of absence.",
      supportingEvidenceRefs: ["extraction-ingredients"],
      originalExtractedText: extraction?.ingredients.originalSourceText || "(No readable ingredient text)",
      userConfirmationRequired: false,
      timestamp: now,
    });
  }

  // -------------------------------------------------------------
  // 2. Allergen Avoidance Rules (Requirement 1, 2, 3)
  // -------------------------------------------------------------
  const allAllergens = Array.from(
    new Set([
      ...userPrefs.allergensToFlag,
      ...(caregiverProfile?.dietaryPlan.allergies ?? []),
    ]),
  );

  const detectedAllergenHits = new Map<string, { ingredient?: Ingredient; sourceText: string; refId: string }>();

  for (const allergen of allAllergens) {
    const key = normalizeName(allergen);

    // Check allergen statement
    if (product.allergenStatement) {
      const matchStmt = product.allergenStatement.allergens.some((a) => normalizeName(a) === key);
      if (matchStmt) {
        detectedAllergenHits.set(allergen, {
          sourceText: product.allergenStatement.text,
          refId: "allergen-statement",
        });
      }
    }

    // Check ingredient list
    for (const ing of product.ingredients) {
      const hasTag = ing.allergenTags.some((t) => normalizeName(t) === key);
      const inOriginalText = normalizeName(ing.originalText).includes(key);
      if (hasTag || inOriginalText) {
        if (!detectedAllergenHits.has(allergen)) {
          detectedAllergenHits.set(allergen, {
            ingredient: ing,
            sourceText: ing.originalText,
            refId: ing.id,
          });
        }
      }
    }
  }

  for (const [allergen, hit] of detectedAllergenHits.entries()) {
    comparisons.push({
      id: `allergen-conflict-${allergen}`,
      ruleId: `allergen.${allergen}`,
      ruleCategory: "allergen",
      ruleName: `Allergen Avoidance: ${allergen}`,
      status: "CONFIRMED_CONFLICT",
      severity: "alert",
      explanation: `Product label contains explicit evidence of ${allergen}.`,
      supportingEvidenceRefs: [hit.refId],
      originalExtractedText: hit.sourceText,
      normalizedValue: allergen,
      confidence: hit.ingredient?.evidence[0]?.confidence ?? product.extractionConfidence ?? null,
      confidenceQuality: hit.ingredient?.evidenceQuality ?? "medium",
      userConfirmationRequired: false,
      timestamp: now,
    });
  }

  // Fail-Safe: If allergens are requested, but none detected and statement is uncertain
  if (allAllergens.length > 0 && detectedAllergenHits.size === 0) {
    if (isAllergenStatementUncertain || isIngredientIncomplete) {
      comparisons.push({
        id: "allergen-status-uncertain",
        ruleId: "safety.allergen_uncertain",
        ruleCategory: "safety_invariance",
        ruleName: "Allergen Verification Guardrail",
        status: "UNCERTAIN",
        severity: "warning",
        explanation:
          "No allergens were identified in the readable text, but the allergen statement is unreadable or incomplete. This product cannot be declared allergen-free.",
        supportingEvidenceRefs: ["allergen-statement"],
        originalExtractedText: product.allergenStatement?.text || "(No 'Contains:' statement detected)",
        userConfirmationRequired: false,
        timestamp: now,
      });
    } else {
      comparisons.push({
        id: "allergens-no-detected-conflict",
        ruleId: "allergen.none_detected",
        ruleCategory: "allergen",
        ruleName: "Allergen Verification",
        status: "NO_DETECTED_CONFLICT",
        severity: "safe",
        explanation:
          "No declared allergens from your avoidance list were detected in the visible label evidence. Always inspect the physical packaging.",
        supportingEvidenceRefs: ["allergen-statement"],
        originalExtractedText: product.allergenStatement?.text || "",
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Vegan & Vegetarian Rules & Ambiguity Confirmation (Req 1, 4, 5)
  // -------------------------------------------------------------
  const wantsVegan = userPrefs.vegan || Boolean(caregiverProfile?.dietaryPlan.vegan);
  const wantsVegetarian = userPrefs.vegetarian || Boolean(caregiverProfile?.dietaryPlan.vegetarian);

  if (wantsVegan) {
    if (product.dietary.veganStatus === "NON-VEGAN") {
      const nonVeganIngs = product.ingredients.filter((i) => i.veganStatus === "NON-VEGAN");
      comparisons.push({
        id: "vegan-confirmed-conflict",
        ruleId: "dietary.vegan",
        ruleCategory: "vegan_vegetarian",
        ruleName: "Vegan Dietary Plan",
        status: "CONFIRMED_CONFLICT",
        severity: "alert",
        explanation: `Product contains animal-derived ingredients: ${nonVeganIngs.map((i) => i.name).join(", ")}.`,
        supportingEvidenceRefs: nonVeganIngs.map((i) => i.id),
        originalExtractedText: nonVeganIngs.map((i) => i.originalText).join("; "),
        userConfirmationRequired: false,
        timestamp: now,
      });
    } else if (product.dietary.veganStatus === "UNKNOWN") {
      // Find ambiguous ingredients (status UNKNOWN)
      const ambiguousIngs = product.ingredients.filter((i) => i.veganStatus === "UNKNOWN");
      if (ambiguousIngs.length > 0 && !isIngredientIncomplete) {
        for (const ing of ambiguousIngs) {
          const compId = `vegan-ambiguity-${ing.id}`;
          const compKeyByName = `vegan-ambiguity-${normalizeName(ing.name)}`;
          const compKeyWithIng = `vegan-ambiguity-ing-${normalizeName(ing.name)}`;
          const existingConfirmation =
            confirmations[compId] || confirmations[compKeyByName] || confirmations[compKeyWithIng];

          if (existingConfirmation) {
            if (existingConfirmation.action === "plant_derived") {
              comparisons.push({
                id: compId,
                ruleId: "dietary.vegan.ambiguous",
                ruleCategory: "vegan_vegetarian",
                ruleName: `Vegan Review: ${ing.name}`,
                status: "NO_DETECTED_CONFLICT",
                severity: "info",
                explanation: `User verified '${ing.name}' as plant-derived origin. Original label origin remains unspecified.`,
                supportingEvidenceRefs: [ing.id],
                originalExtractedText: ing.originalText,
                resolvedByUser: true,
                resolvedAction: "plant_derived",
                userConfirmationRequired: false,
                timestamp: now,
              });
            } else if (existingConfirmation.action === "animal_derived") {
              comparisons.push({
                id: compId,
                ruleId: "dietary.vegan.ambiguous",
                ruleCategory: "vegan_vegetarian",
                ruleName: `Vegan Conflict: ${ing.name}`,
                status: "CONFIRMED_CONFLICT",
                severity: "alert",
                explanation: `User verified '${ing.name}' as animal-derived origin.`,
                supportingEvidenceRefs: [ing.id],
                originalExtractedText: ing.originalText,
                resolvedByUser: true,
                resolvedAction: "animal_derived",
                userConfirmationRequired: false,
                timestamp: now,
              });
            } else {
              // Left unresolved by user
              comparisons.push({
                id: compId,
                ruleId: "dietary.vegan.ambiguous",
                ruleCategory: "vegan_vegetarian",
                ruleName: `Vegan Ambiguity: ${ing.name}`,
                status: "UNCERTAIN",
                severity: "warning",
                explanation: `'${ing.name}' has variable or undisclosed origin. Left unresolved by user.`,
                supportingEvidenceRefs: [ing.id],
                originalExtractedText: ing.originalText,
                resolvedByUser: true,
                resolvedAction: "leave_unresolved",
                userConfirmationRequired: false,
                timestamp: now,
              });
            }
          } else {
            // Needs confirmation
            comparisons.push({
              id: compId,
              ruleId: "dietary.vegan.ambiguous",
              ruleCategory: "vegan_vegetarian",
              ruleName: `Review Origin: ${ing.name}`,
              status: "NEEDS_USER_CONFIRMATION",
              severity: "warning",
              explanation: `'${ing.name}' has variable commercial origin (may be plant or animal derived). Confirmation required to verify vegan suitability.`,
              supportingEvidenceRefs: [ing.id],
              originalExtractedText: ing.originalText,
              userConfirmationRequired: true,
              confirmationPrompt: {
                id: compId,
                originalPhrase: ing.originalText,
                competingInterpretations: [
                  "Plant-derived commercial synthesis",
                  "Animal-derived rendering or processing",
                ],
                impactReason:
                  "If derived from animal sources, this product violates your saved vegan dietary plan.",
                suggestedActions: [
                  { label: "Confirm Plant Origin", actionValue: "plant_derived" },
                  { label: "Confirm Animal Origin (Conflict)", actionValue: "animal_derived" },
                  { label: "Leave Unresolved", actionValue: "leave_unresolved" },
                ],
              },
              timestamp: now,
            });
          }
        }
      } else {
        comparisons.push({
          id: "vegan-uncertain-general",
          ruleId: "dietary.vegan",
          ruleCategory: "vegan_vegetarian",
          ruleName: "Vegan Dietary Plan",
          status: "UNCERTAIN",
          severity: "warning",
          explanation:
            "Product-level vegan status cannot be certified because ingredient data is incomplete or unverified.",
          supportingEvidenceRefs: ["extraction-ingredients"],
          originalExtractedText: extraction?.ingredients.originalSourceText,
          userConfirmationRequired: false,
          timestamp: now,
        });
      }
    } else {
      comparisons.push({
        id: "vegan-no-detected-conflict",
        ruleId: "dietary.vegan",
        ruleCategory: "vegan_vegetarian",
        ruleName: "Vegan Dietary Plan",
        status: "NO_DETECTED_CONFLICT",
        severity: "safe",
        explanation:
          "All listed ingredients have documented plant or mineral origin in the verified catalog. Not a formal 3rd-party certification.",
        supportingEvidenceRefs: product.ingredients.map((i) => i.id),
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  // -------------------------------------------------------------
  // 4. Caregiver Nutrition Threshold Rules (Requirement 1, Caregiver Req 2, 4, 5)
  // -------------------------------------------------------------
  const thresholds: NutritionThreshold[] = caregiverProfile?.thresholds ?? [];
  for (const th of thresholds) {
    if (!th.enabled) continue;

    const matchedNutrient = findNutrientMatch(product, th.nutrient);
    const compId = `threshold-${th.id}`;

    if (!matchedNutrient || matchedNutrient.amount === null) {
      comparisons.push({
        id: compId,
        ruleId: `threshold.${th.id}`,
        ruleCategory: "nutrition_threshold",
        ruleName: `Nutrition Limit: ${th.nutrient}`,
        status: "MISSING_INFORMATION",
        severity: "info",
        explanation: `The label does not report a readable value for '${th.nutrient}'. Cannot evaluate threshold.`,
        supportingEvidenceRefs: ["nutrition-panel"],
        thresholdApplied: {
          nutrient: th.nutrient,
          operator: th.operator,
          limit: th.limit,
          unit: th.unit,
          basis: th.basis,
        },
        userConfirmationRequired: false,
        timestamp: now,
      });
      continue;
    }

    // Evaluate based on serving basis
    let valueToCompare: number | null = matchedNutrient.amount;
    let basisExplanation = `Per printed serving (${product.nutrition.servingSizeAmount ?? 1} ${product.nutrition.servingSizeUnit})`;

    if (th.basis === "per_100g") {
      const sAmt = product.nutrition.servingSizeAmount;
      const sUnit = product.nutrition.servingSizeUnit;
      const base = sAmt && sUnit ? toBase(sAmt, sUnit) : null;

      if (!base || base.family === "count" || base.amount === 0) {
        comparisons.push({
          id: compId,
          ruleId: `threshold.${th.id}`,
          ruleCategory: "nutrition_threshold",
          ruleName: `Nutrition Limit: ${th.nutrient} (100g basis)`,
          status: "UNCERTAIN",
          severity: "warning",
          explanation: `Serving size '${sAmt} ${sUnit}' cannot be normalized to 100g for comparison against caregiver limit.`,
          supportingEvidenceRefs: ["nutrition-serving"],
          thresholdApplied: {
            nutrient: th.nutrient,
            operator: th.operator,
            limit: th.limit,
            unit: th.unit,
            basis: th.basis,
          },
          userConfirmationRequired: false,
          timestamp: now,
        });
        continue;
      }

      valueToCompare = (matchedNutrient.amount / base.amount) * 100;
      basisExplanation = "Normalized to 100 g / ml";
    }

    // Unit compatibility check
    const unitCompatible = areUnitsCompatible(matchedNutrient.unit, th.unit);
    if (!unitCompatible) {
      comparisons.push({
        id: compId,
        ruleId: `threshold.${th.id}`,
        ruleCategory: "nutrition_threshold",
        ruleName: `Nutrition Limit: ${th.nutrient}`,
        status: "UNCERTAIN",
        severity: "warning",
        explanation: `Label unit '${matchedNutrient.unit}' is incompatible with configured threshold unit '${th.unit}'.`,
        supportingEvidenceRefs: ["nutrition-panel"],
        thresholdApplied: {
          nutrient: th.nutrient,
          operator: th.operator,
          limit: th.limit,
          unit: th.unit,
          basis: th.basis,
        },
        userConfirmationRequired: false,
        timestamp: now,
      });
      continue;
    }

    // Normalize value into threshold's unit if needed (e.g. g vs mg)
    const convertedValue = convertUnit(valueToCompare, matchedNutrient.unit, th.unit);
    const isConflict = evaluateThresholdOperator(convertedValue, th.operator, th.limit);

    if (isConflict) {
      comparisons.push({
        id: compId,
        ruleId: `threshold.${th.id}`,
        ruleCategory: "nutrition_threshold",
        ruleName: `Threshold Exceeded: ${th.nutrient}`,
        status: "CONFIRMED_CONFLICT",
        severity: "alert",
        explanation: `Extracted '${th.nutrient}' of ${convertedValue.toFixed(1)} ${th.unit} ${basisExplanation} conflicts with configured limit (${th.operator} ${th.limit} ${th.unit}).`,
        supportingEvidenceRefs: ["nutrition-panel"],
        originalExtractedText: `${matchedNutrient.nutrient}: ${matchedNutrient.amount} ${matchedNutrient.unit}`,
        normalizedValue: `${convertedValue.toFixed(1)} ${th.unit}`,
        thresholdApplied: {
          nutrient: th.nutrient,
          operator: th.operator,
          limit: th.limit,
          unit: th.unit,
          basis: th.basis,
        },
        userConfirmationRequired: false,
        timestamp: now,
      });
    } else {
      comparisons.push({
        id: compId,
        ruleId: `threshold.${th.id}`,
        ruleCategory: "nutrition_threshold",
        ruleName: `Nutrition Threshold: ${th.nutrient}`,
        status: "NO_DETECTED_CONFLICT",
        severity: "safe",
        explanation: `Extracted '${th.nutrient}' of ${convertedValue.toFixed(1)} ${th.unit} complies with configured limit (${th.operator} ${th.limit} ${th.unit}).`,
        supportingEvidenceRefs: ["nutrition-panel"],
        originalExtractedText: `${matchedNutrient.nutrient}: ${matchedNutrient.amount} ${matchedNutrient.unit}`,
        normalizedValue: `${convertedValue.toFixed(1)} ${th.unit}`,
        thresholdApplied: {
          nutrient: th.nutrient,
          operator: th.operator,
          limit: th.limit,
          unit: th.unit,
          basis: th.basis,
        },
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  // -------------------------------------------------------------
  // 5. Contradiction Detection (Requirement 4)
  // -------------------------------------------------------------
  // Contradiction A: Model interpretation contradicts extracted evidence
  if (modelInterpretation) {
    if (modelInterpretation.claimsVegan && product.dietary.veganStatus === "NON-VEGAN") {
      const nonVeganNames = product.ingredients
        .filter((i) => i.veganStatus === "NON-VEGAN")
        .map((i) => i.name)
        .join(", ");
      comparisons.push({
        id: "contradiction-model-vegan-mismatch",
        ruleId: "contradiction.model_vegan",
        ruleCategory: "contradiction",
        ruleName: "Model vs Label Contradiction: Vegan Claim",
        status: "UNRESOLVED_CONTRADICTION",
        severity: "alert",
        explanation: `An external model interpreted this product as vegan, but explicit extracted ingredients contain non-vegan components (${nonVeganNames}). The physical label evidence takes precedence.`,
        supportingEvidenceRefs: product.ingredients
          .filter((i) => i.veganStatus === "NON-VEGAN")
          .map((i) => i.id),
        originalExtractedText: `Extracted non-vegan components: ${nonVeganNames}`,
        userConfirmationRequired: true,
        confirmationPrompt: {
          id: "contradiction-model-vegan-mismatch",
          originalPhrase: nonVeganNames,
          competingInterpretations: [
            "Model summary: Product is vegan",
            `Label text evidence: Contains ${nonVeganNames}`,
          ],
          impactReason:
            "Trusting an unsupported model claim over visible label ingredients risks allergen and dietary exposure.",
          suggestedActions: [
            { label: "Reject Model Claim (Uphold Label Evidence)", actionValue: "uphold_label" },
            { label: "Leave Contradiction Unresolved", actionValue: "leave_unresolved" },
          ],
        },
        timestamp: now,
      });
    }

    // Contradiction B: Model claims allergen not in visible text
    if (modelInterpretation.declaredAllergens && modelInterpretation.declaredAllergens.length > 0) {
      for (const modelAllergen of modelInterpretation.declaredAllergens) {
        const inEvidence = detectedAllergenHits.has(modelAllergen);
        if (!inEvidence) {
          comparisons.push({
            id: `contradiction-model-unsupported-allergen-${modelAllergen}`,
            ruleId: "contradiction.model_allergen_unsupported",
            ruleCategory: "contradiction",
            ruleName: `Model vs Label Contradiction: ${modelAllergen}`,
            status: "UNRESOLVED_CONTRADICTION",
            severity: "warning",
            explanation: `Model identified allergen '${modelAllergen}', but no supporting evidence exists in the readable label text or 'Contains:' statement.`,
            supportingEvidenceRefs: ["allergen-statement"],
            originalExtractedText: product.allergenStatement?.text || "(No allergen statement found)",
            userConfirmationRequired: true,
            confirmationPrompt: {
              id: `contradiction-model-unsupported-allergen-${modelAllergen}`,
              originalPhrase: `Model asserted '${modelAllergen}'`,
              competingInterpretations: [
                `Model assertion: Contains ${modelAllergen}`,
                "Visible label: No readable evidence of this allergen",
              ],
              impactReason: "Distinguishes actual label evidence from unverified model claims.",
              suggestedActions: [
                { label: "Flag for Manual Package Verification", actionValue: "manual_verify" },
                { label: "Leave Unresolved", actionValue: "leave_unresolved" },
              ],
            },
            timestamp: now,
          });
        }
      }
    }
  }

  // Contradiction C: Ingredient list vs Allergen Statement conflict
  if (extraction?.hasConflicts) {
    for (const note of extraction.conflictNotes) {
      comparisons.push({
        id: `contradiction-label-internal-${uid("con")}`,
        ruleId: "contradiction.label_conflict",
        ruleCategory: "contradiction",
        ruleName: "Label Internal Contradiction",
        status: "UNRESOLVED_CONTRADICTION",
        severity: "alert",
        explanation: note,
        supportingEvidenceRefs: ["allergen-statement", "extraction-ingredients"],
        originalExtractedText: product.allergenStatement?.text || "",
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  // Contradiction D: Nutrition value conflicts with source text or units
  for (const val of product.nutrition.values) {
    if (val.amount !== null && val.amount < 0) {
      comparisons.push({
        id: `contradiction-nutrition-negative-${val.nutrient}`,
        ruleId: "contradiction.nutrition_invalid",
        ruleCategory: "contradiction",
        ruleName: `Nutrition Value Contradiction: ${val.nutrient}`,
        status: "UNRESOLVED_CONTRADICTION",
        severity: "alert",
        explanation: `Extracted amount for '${val.nutrient}' is negative (${val.amount} ${val.unit}), indicating OCR error or corrupted source text.`,
        supportingEvidenceRefs: ["nutrition-panel"],
        originalExtractedText: `${val.nutrient}: ${val.amount} ${val.unit}`,
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  // -------------------------------------------------------------
  // 6. Ingredients of Concern (Requirement 1, 2)
  // -------------------------------------------------------------
  const allConcerns = Array.from(
    new Set([
      ...userPrefs.ingredientsOfConcern,
      ...(caregiverProfile?.dietaryPlan.ingredientsToAvoid ?? []),
    ]),
  );

  for (const concern of allConcerns) {
    const key = normalizeName(concern);
    const match = product.ingredients.find(
      (i) =>
        normalizeName(i.name).includes(key) ||
        normalizeName(i.originalText).includes(key) ||
        i.concernTags.some((t) => normalizeName(t).includes(key)),
    );

    if (match) {
      comparisons.push({
        id: `concern-${concern}`,
        ruleId: `concern.${concern}`,
        ruleCategory: "concern",
        ruleName: `Ingredient of Concern: ${concern}`,
        status: "CONFIRMED_CONFLICT",
        severity: "warning",
        explanation: `Extracted ingredient '${match.originalText}' matches your avoidance concern '${concern}'.`,
        supportingEvidenceRefs: [match.id],
        originalExtractedText: match.originalText,
        normalizedValue: match.name,
        userConfirmationRequired: false,
        timestamp: now,
      });
    }
  }

  return comparisons;
}

// -------------------------------------------------------------
// Helper Utilities
// -------------------------------------------------------------

function findNutrientMatch(product: ProductRecord, query: string) {
  const q = normalizeName(query);
  return product.nutrition.values.find((v) => {
    const n = normalizeName(v.nutrient);
    return n === q || n.includes(q) || q.includes(n);
  });
}

function areUnitsCompatible(labelUnit: string, thresholdUnit: string): boolean {
  const u1 = labelUnit.toLowerCase().trim();
  const u2 = thresholdUnit.toLowerCase().trim();
  if (u1 === u2) return true;
  if ((u1 === "g" || u1 === "mg" || u1 === "mcg") && (u2 === "g" || u2 === "mg" || u2 === "mcg")) return true;
  if ((u1 === "kcal" || u1 === "calories") && (u2 === "kcal" || u2 === "calories")) return true;
  return false;
}

function convertUnit(value: number, fromUnit: string, toUnit: string): number {
  const u1 = fromUnit.toLowerCase().trim();
  const u2 = toUnit.toLowerCase().trim();
  if (u1 === u2) return value;
  // Mass conversions
  let grams = value;
  if (u1 === "mg") grams = value / 1000;
  else if (u1 === "mcg") grams = value / 1000000;

  if (u2 === "g") return grams;
  if (u2 === "mg") return grams * 1000;
  if (u2 === "mcg") return grams * 1000000;
  return value;
}

function evaluateThresholdOperator(value: number, op: ">=" | "<=" | ">" | "<", limit: number): boolean {
  switch (op) {
    case ">=":
      return value >= limit;
    case ">":
      return value > limit;
    case "<=":
      return value <= limit;
    case "<":
      return value < limit;
    default:
      return false;
  }
}
