import type {
  AllergenStatement,
  ExtractedField,
  FieldStatus,
  Ingredient,
  NutritionFacts,
  ProductRecord,
  StructuredExtractionRecord,
} from "@/types";
import { classifyIngredientName, medicineDisclaimer, summarizeProductVegan } from "@/lib/vegan/classify";
import { completenessScore, nowIso, uid } from "@/lib/utils";
import type { ImageQualityReport } from "@/lib/ocr/quality";

/**
 * Detects if an ingredient list is truncated or incomplete
 */
export function checkIngredientTruncation(rawText: string): {
  isTruncated: boolean;
  reason?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isTruncated: true, reason: "Ingredient text is empty." };
  }

  // Trailing punctuation indicating abrupt end
  if (/,\s*$/.test(trimmed)) {
    return { isTruncated: true, reason: "Text terminates abruptly with a trailing comma." };
  }
  if (/\.{3}$|…$/.test(trimmed)) {
    return { isTruncated: true, reason: "Text terminates with an ellipsis (...)." };
  }
  if (/(?:contains|less than)\s*2%\s*or\s*less\s*(?:of)?[:\s]*$/i.test(trimmed)) {
    return { isTruncated: true, reason: "Text ends on sub-ingredient qualifier without listing items." };
  }

  // Unbalanced parentheses
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    return { isTruncated: true, reason: `Unmatched opening parenthesis (${openParens} open vs ${closeParens} closed).` };
  }

  // Unbalanced brackets
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    return { isTruncated: true, reason: `Unmatched opening bracket (${openBrackets} open vs ${closeBrackets} closed).` };
  }

  return { isTruncated: false };
}

/**
 * Detects contradictions between ingredient list and allergen statement
 */
export function detectAllergenConflicts(
  ingredients: Ingredient[],
  allergenStatement?: AllergenStatement,
): string[] {
  const conflicts: string[] = [];
  if (!allergenStatement && ingredients.some((i) => i.allergenTags.length > 0)) {
    const foundTags = Array.from(new Set(ingredients.flatMap((i) => i.allergenTags)));
    conflicts.push(
      `Ingredients declare major allergens (${foundTags.join(", ")}), but no explicit 'Contains:' statement was detected on the label.`,
    );
    return conflicts;
  }

  if (!allergenStatement) return conflicts;

  const declared = new Set(allergenStatement.allergens.map((a) => a.toLowerCase().trim()));
  const ingredientAllergens = new Set(ingredients.flatMap((i) => i.allergenTags.map((t) => t.toLowerCase().trim())));

  // Check if ingredient has allergen omitted from 'Contains:'
  for (const ingAllergen of ingredientAllergens) {
    if (!declared.has(ingAllergen)) {
      conflicts.push(
        `Discrepancy: Ingredient list contains '${ingAllergen}', but the label's 'Contains:' statement omits it.`,
      );
    }
  }

  return conflicts;
}

/**
 * Builds a structured extraction record tracking each field independently
 */
export function buildStructuredExtractionRecord(params: {
  productName: string;
  brand: string;
  rawIngredientsText: string | null;
  ingredients: Ingredient[];
  allergenStatement?: AllergenStatement;
  nutrition: NutritionFacts;
  servingSize: { amount: number | null; unit: string };
  rawOcrText: string;
  confidence: number | null; // Honest OCR provider confidence or null if unsupported
  qualityReport?: ImageQualityReport;
}): StructuredExtractionRecord {
  const {
    productName,
    rawIngredientsText,
    ingredients,
    allergenStatement,
    nutrition,
    servingSize,
    rawOcrText,
    confidence,
    qualityReport,
  } = params;

  // Determine fallback confidence estimate if provider returned null
  const hasProviderConfidence = confidence !== null && confidence !== undefined && confidence > 0;
  const confidenceEstimate = hasProviderConfidence
    ? confidence
    : qualityReport
      ? Math.max(30, Math.round(qualityReport.overallScore * 0.8))
      : 70;

  // 1. Product Name Field
  const hasName = Boolean(productName && !productName.includes("Unnamed"));
  const nameStatus: FieldStatus = !hasName
    ? "MISSING"
    : (confidence ?? 100) < 60
      ? "UNCERTAIN"
      : "CONFIRMED";

  const productNameField: ExtractedField<string> = {
    fieldName: "product_name",
    label: "Product Name",
    extractedValue: productName,
    originalSourceText: productName,
    confidence: hasProviderConfidence ? confidence : null,
    confidenceEstimate: hasProviderConfidence ? undefined : confidenceEstimate,
    status: nameStatus,
    statusReason: !hasName ? "Product title could not be identified from header lines." : undefined,
    userConfirmed: false,
    userCorrected: false,
  };

  // 2. Ingredients Field
  const truncation = rawIngredientsText
    ? checkIngredientTruncation(rawIngredientsText)
    : { isTruncated: true, reason: "No ingredient list detected." };

  let ingStatus: FieldStatus = "CONFIRMED";
  let ingReason: string | undefined;

  if (!rawIngredientsText || ingredients.length === 0) {
    ingStatus = "MISSING";
    ingReason = "Ingredient list could not be isolated from OCR text.";
  } else if (truncation.isTruncated) {
    ingStatus = "NEEDS_REVIEW";
    ingReason = `Incomplete ingredient text: ${truncation.reason}`;
  } else if ((confidence ?? 100) < 65 || qualityReport?.metrics.isBlurry) {
    ingStatus = "UNCERTAIN";
    ingReason = "Low OCR optical confidence or blurry label region.";
  }

  const ingredientsField: ExtractedField<Ingredient[]> = {
    fieldName: "ingredients",
    label: "Ingredients",
    extractedValue: ingredients,
    originalSourceText: rawIngredientsText || "",
    confidence: hasProviderConfidence ? confidence : null,
    confidenceEstimate: hasProviderConfidence ? undefined : confidenceEstimate,
    status: ingStatus,
    statusReason: ingReason,
    userConfirmed: false,
    userCorrected: false,
  };

  // 3. Allergen Statement Field
  let allergenStatus: FieldStatus = "CONFIRMED";
  let allergenReason: string | undefined;

  if (!allergenStatement) {
    allergenStatus = "MISSING";
    allergenReason = "No explicit 'Contains:' allergen statement detected on label.";
  } else if (!allergenStatement.allergens.length) {
    allergenStatus = "UNCERTAIN";
    allergenReason = "Allergen header present but no specific allergens could be parsed.";
  } else if ((confidence ?? 100) < 60) {
    allergenStatus = "UNCERTAIN";
    allergenReason = "Low OCR optical confidence in allergen region.";
  }

  const allergenStatementField: ExtractedField<AllergenStatement | null> = {
    fieldName: "allergens",
    label: "Allergen Statement",
    extractedValue: allergenStatement ?? null,
    originalSourceText: allergenStatement?.text || "",
    confidence: hasProviderConfidence ? confidence : null,
    confidenceEstimate: hasProviderConfidence ? undefined : confidenceEstimate,
    status: allergenStatus,
    statusReason: allergenReason,
    userConfirmed: false,
    userCorrected: false,
  };

  // 4. Nutrition Field
  let nutrStatus: FieldStatus = "CONFIRMED";
  let nutrReason: string | undefined;

  if (nutrition.values.length === 0) {
    nutrStatus = "MISSING";
    nutrReason = "No nutrition facts table was detected.";
  } else if (nutrition.incomplete) {
    nutrStatus = "NEEDS_REVIEW";
    nutrReason = "Nutrition table is incomplete (fewer than standard required nutrients).";
  } else if ((confidence ?? 100) < 65) {
    nutrStatus = "UNCERTAIN";
    nutrReason = "Low OCR optical confidence across nutrition rows.";
  }

  const nutritionField: ExtractedField<NutritionFacts> = {
    fieldName: "nutrition",
    label: "Nutrition Facts",
    extractedValue: nutrition,
    originalSourceText: rawOcrText.slice(0, 300),
    confidence: hasProviderConfidence ? confidence : null,
    confidenceEstimate: hasProviderConfidence ? undefined : confidenceEstimate,
    status: nutrStatus,
    statusReason: nutrReason,
    userConfirmed: false,
    userCorrected: false,
  };

  // 5. Serving Size Field
  let servingStatus: FieldStatus = "CONFIRMED";
  let servingReason: string | undefined;

  if (!servingSize.amount) {
    servingStatus = "MISSING";
    servingReason = "Printed serving size could not be established.";
  }

  const servingSizeField: ExtractedField<{ amount: number | null; unit: string }> = {
    fieldName: "serving_size",
    label: "Serving Size",
    extractedValue: servingSize,
    originalSourceText: servingSize.amount ? `Serving size: ${servingSize.amount} ${servingSize.unit}` : "",
    confidence: hasProviderConfidence ? confidence : null,
    confidenceEstimate: hasProviderConfidence ? undefined : confidenceEstimate,
    status: servingStatus,
    statusReason: servingReason,
    userConfirmed: false,
    userCorrected: false,
  };

  // 6. Relevant Warnings Field
  const conflicts = detectAllergenConflicts(ingredients, allergenStatement);
  const warningList: string[] = [...conflicts];
  if (truncation.isTruncated && truncation.reason) {
    warningList.push(`Potential truncated ingredients: ${truncation.reason}`);
  }

  const warningsField: ExtractedField<string[]> = {
    fieldName: "warnings",
    label: "Safety & Completeness Warnings",
    extractedValue: warningList,
    originalSourceText: "",
    confidence: null,
    status: warningList.length > 0 ? "NEEDS_REVIEW" : "CONFIRMED",
    userConfirmed: false,
    userCorrected: false,
  };

  const completeness = completenessScore([
    hasName,
    Boolean(rawIngredientsText),
    !truncation.isTruncated,
    Boolean(allergenStatement),
    !nutrition.incomplete,
    Boolean(servingSize.amount),
    (confidence ?? 70) > 60,
  ]);

  return {
    id: uid("rec"),
    productName: productNameField,
    ingredients: ingredientsField,
    allergens: allergenStatementField,
    nutrition: nutritionField,
    servingSize: servingSizeField,
    warnings: warningsField,
    completenessScore: completeness,
    hasConflicts: conflicts.length > 0,
    conflictNotes: conflicts,
    assessedAt: nowIso(),
  };
}

/**
 * Applies a user correction to a specific field in the extraction record,
 * updating the product record and re-evaluating vegan & dietary classifications.
 */
export function applyFieldCorrectionToRecord(
  product: ProductRecord,
  fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
  correctedValue: any,
): ProductRecord {
  const currentRecord = product.extractionRecord;
  const updatedProduct: ProductRecord = {
    ...product,
    labelVersion: product.labelVersion + 1,
    capturedAt: nowIso(),
  };

  if (fieldName === "product_name") {
    const val = String(correctedValue).trim();
    updatedProduct.name = val;
    if (currentRecord) {
      currentRecord.productName = {
        ...currentRecord.productName,
        userCorrected: true,
        userConfirmed: true,
        status: "USER_CORRECTED",
        correctedValue: val,
        correctedAt: nowIso(),
        originalValueBeforeCorrection: currentRecord.productName.extractedValue,
      };
    }
  } else if (fieldName === "ingredients") {
    // correctedValue can be string (comma-separated) or string[]
    const parts = Array.isArray(correctedValue)
      ? correctedValue
      : String(correctedValue)
          .split(/,(?![^(]*\))/)
          .map((s) => s.trim())
          .filter(Boolean);

    const reclassified = parts.map((name, i) => classifyIngredientName(name, i));
    updatedProduct.ingredients = reclassified;

    // Recalculate vegan status
    const vegan = summarizeProductVegan(reclassified, true);
    updatedProduct.dietary = {
      ...updatedProduct.dietary,
      veganStatus: vegan.veganStatus,
      veganSummary: vegan.veganSummary,
      vegetarianLikely: vegan.veganStatus === "NON-VEGAN" ? false : vegan.veganStatus === "VEGAN" ? true : null,
      containsAddedSugar: reclassified.some((i) => i.concernTags.includes("added sugar")),
    };

    // Update concerns list
    updatedProduct.concerns = reclassified
      .filter((i) => i.veganStatus === "NON-VEGAN" || i.allergenTags.length)
      .map((i) => ({
        text: `${i.originalText}: ${i.classificationReason}`,
        evidence: i.evidence[0],
      }));

    if (currentRecord) {
      currentRecord.ingredients = {
        ...currentRecord.ingredients,
        userCorrected: true,
        userConfirmed: true,
        status: "USER_CORRECTED",
        correctedValue: reclassified,
        correctedAt: nowIso(),
        originalValueBeforeCorrection: currentRecord.ingredients.extractedValue,
      };

      // Check for conflicts with allergen statement
      const conflicts = detectAllergenConflicts(reclassified, updatedProduct.allergenStatement);
      currentRecord.hasConflicts = conflicts.length > 0;
      currentRecord.conflictNotes = conflicts;
    }
  } else if (fieldName === "allergens") {
    // correctedValue can be string or { text: string; allergens: string[] }
    let allergenObj: AllergenStatement | undefined;
    if (typeof correctedValue === "string") {
      const text = correctedValue.trim();
      if (text) {
        const allergens = text
          .replace(/^contains:?/i, "")
          .split(/,|and/i)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        allergenObj = {
          text: `Contains: ${allergens.join(", ")}`,
          allergens,
          evidence: {
            id: uid("ev"),
            kind: "extracted_fact",
            claim: "User corrected allergen statement",
            sourceText: text,
          },
        };
      }
    } else if (correctedValue && Array.isArray(correctedValue.allergens)) {
      allergenObj = {
        text: correctedValue.text || `Contains: ${correctedValue.allergens.join(", ")}`,
        allergens: correctedValue.allergens,
        evidence: {
          id: uid("ev"),
          kind: "extracted_fact",
          claim: "User corrected allergen statement",
        },
      };
    }

    updatedProduct.allergenStatement = allergenObj;

    if (currentRecord) {
      currentRecord.allergens = {
        ...currentRecord.allergens,
        userCorrected: true,
        userConfirmed: true,
        status: "USER_CORRECTED",
        correctedValue: allergenObj ?? null,
        correctedAt: nowIso(),
        originalValueBeforeCorrection: currentRecord.allergens.extractedValue,
      };

      // Update conflicts
      const conflicts = detectAllergenConflicts(updatedProduct.ingredients, allergenObj);
      currentRecord.hasConflicts = conflicts.length > 0;
      currentRecord.conflictNotes = conflicts;
    }
  } else if (fieldName === "serving_size") {
    const amount = Number(correctedValue.amount) || null;
    const unit = String(correctedValue.unit || "g");
    updatedProduct.nutrition = {
      ...updatedProduct.nutrition,
      servingSizeAmount: amount,
      servingSizeUnit: unit,
      incomplete: updatedProduct.nutrition.values.length < 4 || !amount,
    };

    if (currentRecord) {
      currentRecord.servingSize = {
        ...currentRecord.servingSize,
        userCorrected: true,
        userConfirmed: true,
        status: "USER_CORRECTED",
        correctedValue: { amount, unit },
        correctedAt: nowIso(),
        originalValueBeforeCorrection: currentRecord.servingSize.extractedValue,
      };
    }
  } else if (fieldName === "nutrition") {
    // correctedValue is NutritionFacts or NutritionValue[]
    if (Array.isArray(correctedValue)) {
      updatedProduct.nutrition = {
        ...updatedProduct.nutrition,
        values: correctedValue,
        incomplete: correctedValue.length < 4,
      };
    } else if (correctedValue && Array.isArray(correctedValue.values)) {
      updatedProduct.nutrition = correctedValue;
    }

    if (currentRecord) {
      currentRecord.nutrition = {
        ...currentRecord.nutrition,
        userCorrected: true,
        userConfirmed: true,
        status: "USER_CORRECTED",
        correctedValue: updatedProduct.nutrition,
        correctedAt: nowIso(),
        originalValueBeforeCorrection: currentRecord.nutrition.extractedValue,
      };
    }
  }

  // Recalculate medicine disclaimer
  updatedProduct.medicineDisclaimer = medicineDisclaimer(updatedProduct);

  // Recalculate completeness
  updatedProduct.completeness = completenessScore([
    Boolean(updatedProduct.name && !updatedProduct.name.includes("Unnamed")),
    updatedProduct.ingredients.length > 0,
    !updatedProduct.nutrition.incomplete,
    Boolean(updatedProduct.allergenStatement),
    Boolean(updatedProduct.nutrition.servingSizeAmount),
    !currentRecord?.hasConflicts,
  ]);

  if (currentRecord) {
    currentRecord.completenessScore = updatedProduct.completeness;
    updatedProduct.extractionRecord = currentRecord;
  }

  return updatedProduct;
}

/**
 * Confirms an extracted field without modifying its value
 */
export function confirmExtractedField(
  product: ProductRecord,
  fieldName: "product_name" | "ingredients" | "allergens" | "nutrition" | "serving_size",
): ProductRecord {
  if (!product.extractionRecord) return product;
  const currentRecord = { ...product.extractionRecord };

  const fieldKey =
    fieldName === "product_name"
      ? "productName"
      : fieldName === "serving_size"
        ? "servingSize"
        : fieldName;

  const target = (currentRecord as any)[fieldKey] as ExtractedField;
  if (target) {
    (currentRecord as any)[fieldKey] = {
      ...target,
      userConfirmed: true,
      status: target.userCorrected ? "USER_CORRECTED" : "CONFIRMED",
    };
  }

  return {
    ...product,
    extractionRecord: currentRecord,
  };
}
