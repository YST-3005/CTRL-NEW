import type { DietaryPreferences, ProductRecord } from "@/types";
import { normalizeName } from "@/lib/utils";

export interface DietaryFinding {
  id: string;
  severity: "info" | "warning" | "alert";
  title: string;
  detail: string;
  evidenceText?: string;
  rule: string;
}

export function evaluateDietaryRules(
  product: ProductRecord,
  prefs: DietaryPreferences,
): DietaryFinding[] {
  const findings: DietaryFinding[] = [];

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

  // 1. Incomplete ingredient list alert (Fail-safe)
  if (isIngredientIncomplete) {
    findings.push({
      id: "incomplete-ingredient-info",
      severity: "alert",
      title: "Incomplete ingredient information",
      detail:
        extraction?.ingredients.statusReason ||
        "The ingredient list is incomplete, truncated, or unreadable. Safety cannot be verified from missing data.",
      rule: "safety.incomplete_ingredients",
    });
  }

  // 2. Vegan preference check
  if (prefs.vegan) {
    if (product.dietary.veganStatus === "NON-VEGAN") {
      findings.push({
        id: "vegan-conflict",
        severity: "alert",
        title: "Conflicts with vegan preference",
        detail: product.dietary.veganSummary,
        evidenceText: product.ingredients
          .filter((i) => i.veganStatus === "NON-VEGAN")
          .map((i) => i.originalText)
          .join("; "),
        rule: "user.vegan",
      });
    } else if (product.dietary.veganStatus === "UNKNOWN" || isIngredientIncomplete) {
      findings.push({
        id: "vegan-unknown",
        severity: "warning",
        title: "Vegan status cannot be confirmed",
        detail:
          product.dietary.veganSummary ||
          "Vegan classification is unknown because ingredient data is incomplete.",
        rule: "user.vegan",
      });
    }
  }

  // 3. User allergens detection
  const allergenHits = new Set<string>();
  for (const allergen of prefs.allergensToFlag) {
    const key = normalizeName(allergen);
    const inStatement = product.allergenStatement?.allergens.some((a) => normalizeName(a) === key);
    const inIngredients = product.ingredients.some((i) =>
      i.allergenTags.some((t) => normalizeName(t) === key) ||
      normalizeName(i.originalText).includes(key),
    );
    if (inStatement || inIngredients) allergenHits.add(allergen);
  }

  // Explicit positive findings for detected allergens
  for (const allergen of allergenHits) {
    findings.push({
      id: `allergen-${allergen}`,
      severity: "alert",
      title: `Allergen flag: ${allergen}`,
      detail: `This product contains evidence of ${allergen} in the ingredient list or allergen statement.`,
      evidenceText: product.allergenStatement?.text,
      rule: "user.allergen",
    });
  }

  // 4. Fail-Safe Allergen Status Unknown
  // If user has flagged allergens, but NONE were detected AND the allergen text is unreadable or missing,
  // or the ingredient list is incomplete, NEVER assume product is allergen-free!
  if (prefs.allergensToFlag.length > 0 && allergenHits.size === 0) {
    if (isAllergenStatementUncertain || isIngredientIncomplete) {
      findings.push({
        id: "allergen-status-unknown",
        severity: "warning",
        title: "Allergen status unknown",
        detail:
          "No allergens were detected in visible text, but no complete 'Contains:' allergen statement was confirmed. Absence of evidence is not proof of allergen absence.",
        rule: "safety.allergen_unknown",
      });
    }
  }

  // 5. Contradictory evidence
  if (extraction?.hasConflicts) {
    for (const note of extraction.conflictNotes) {
      findings.push({
        id: `conflict-${normalizeName(note).slice(0, 20)}`,
        severity: "alert",
        title: "Conflicting allergen evidence",
        detail: note,
        rule: "safety.conflict",
      });
    }
  }

  // 6. User corrected field audit
  if (extraction?.ingredients.userCorrected || extraction?.allergens.userCorrected) {
    findings.push({
      id: "user-corrected-audit",
      severity: "info",
      title: "Recalculated with user corrections",
      detail: "Dietary findings incorporate user-verified corrections. Original OCR evidence remains preserved.",
      rule: "audit.correction",
    });
  }

  // 7. Ingredients of concern
  for (const concern of prefs.ingredientsOfConcern) {
    const key = normalizeName(concern);
    const match = product.ingredients.find(
      (i) =>
        normalizeName(i.name).includes(key) ||
        normalizeName(i.originalText).includes(key) ||
        i.concernTags.some((t) => normalizeName(t).includes(key)),
    );
    if (match) {
      findings.push({
        id: `concern-${concern}`,
        severity: "warning",
        title: `Ingredient of concern: ${concern}`,
        detail: `${match.originalText} matched your concern list.`,
        evidenceText: match.originalText,
        rule: "user.concern",
      });
    }
  }

  // 8. Medicine disclaimer
  if (product.category === "medicine" && product.medicineDisclaimer) {
    findings.push({
      id: "medicine",
      severity: "info",
      title: "Medicine tablet / inactive ingredients",
      detail: product.medicineDisclaimer,
      rule: "safety.medicine",
    });
  }

  // 9. Missing information
  for (const missing of product.missingInformation) {
    findings.push({
      id: `missing-${missing.slice(0, 24)}`,
      severity: "info",
      title: "Missing label information",
      detail: missing,
      rule: "data.completeness",
    });
  }

  return findings;
}

export function hasAllergenConflict(product: ProductRecord, allergens: string[]): boolean {
  return evaluateDietaryRules(product, {
    vegan: false,
    vegetarian: false,
    allergensToFlag: allergens,
    ingredientsOfConcern: [],
    preferredServingUnit: "g",
    motion: "full",
    notificationsOptIn: false,
    privacyLocalOnly: true,
    saveScans: true,
  }).some((f) => f.rule === "user.allergen");
}
