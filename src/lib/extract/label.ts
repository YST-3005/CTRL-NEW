import type { NutritionFacts, NutritionValue, ProductRecord } from "@/types";
import { classifyIngredientName, medicineDisclaimer, summarizeProductVegan } from "@/lib/vegan/classify";
import { completenessScore, nowIso, uid } from "@/lib/utils";

const NUTRIENT_PATTERNS: { nutrient: string; unit: string; re: RegExp }[] = [
  { nutrient: "Calories", unit: "kcal", re: /calories[:\s]*([0-9]+(?:\.[0-9]+)?)/i },
  { nutrient: "Total Fat", unit: "g", re: /total fat[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Saturated Fat", unit: "g", re: /saturated fat[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Trans Fat", unit: "g", re: /trans fat[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Cholesterol", unit: "mg", re: /cholesterol[:\s]*([0-9]+(?:\.[0-9]+)?)\s*mg/i },
  { nutrient: "Sodium", unit: "mg", re: /sodium[:\s]*([0-9]+(?:\.[0-9]+)?)\s*mg/i },
  { nutrient: "Total Carbohydrate", unit: "g", re: /total carbohydrate[s]?[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Dietary Fiber", unit: "g", re: /dietary fiber[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Total Sugars", unit: "g", re: /(?:total )?sugars[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Added Sugars", unit: "g", re: /added sugars[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Protein", unit: "g", re: /protein[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
];

export function splitIngredients(listText: string): string[] {
  return listText
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 1);
}

export function extractIngredientList(ocrText: string): string | null {
  const match = ocrText.match(/ingredients?:([\s\S]*?)(?:contains:|nutrition facts|manufactured|distributed|$)/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, " ").trim();
}

export function extractAllergenStatement(ocrText: string): { text: string; allergens: string[] } | undefined {
  const match = ocrText.match(/contains:([^\n.]+)/i);
  if (!match) return undefined;
  const text = `Contains:${match[1].trim()}`;
  const allergens = match[1]
    .split(/,|and/i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { text, allergens };
}

export function extractNutrition(ocrText: string): NutritionFacts {
  const serving = ocrText.match(/serving size[:\s]*([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)/i);
  const values: NutritionValue[] = [];
  for (const p of NUTRIENT_PATTERNS) {
    const m = ocrText.match(p.re);
    if (m) {
      values.push({
        nutrient: p.nutrient,
        amount: Number(m[1]),
        unit: p.unit,
        source: "extracted_fact",
      });
    }
  }
  const notes: string[] = [];
  if (!serving) notes.push("Serving size was not readable on this label.");
  if (!values.length) notes.push("Nutrition facts table was not readable.");
  return {
    servingSizeAmount: serving ? Number(serving[1]) : null,
    servingSizeUnit: serving ? serving[2] : "g",
    values,
    incomplete: values.length < 4 || !serving,
    notes,
  };
}

export function extractProductName(ocrText: string): { name: string; brand: string } {
  const lines = ocrText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const name = lines[0]?.slice(0, 80) || "Unnamed scanned label";
  const brandLine = lines.find((l) => /brand|by /i.test(l));
  return { name, brand: brandLine?.replace(/brand[:\s]*/i, "").slice(0, 60) || "Unknown brand" };
}

import {
  buildStructuredExtractionRecord,
  checkIngredientTruncation,
  detectAllergenConflicts,
} from "@/lib/extract/extractionEngine";
import type { ImageQualityReport } from "@/lib/ocr/quality";

export function buildProductFromOcr(params: {
  ocrText: string;
  confidence?: number;
  imageDataUrl?: string;
  userIdHint?: string;
  qualityReport?: ImageQualityReport;
}): ProductRecord {
  const { ocrText, confidence, imageDataUrl, qualityReport } = params;
  const { name, brand } = extractProductName(ocrText);
  const list = extractIngredientList(ocrText);
  const truncation = list
    ? checkIngredientTruncation(list)
    : { isTruncated: true, reason: "Ingredient list could not be isolated from OCR text." };

  const parts = list ? splitIngredients(list) : [];
  const ingredients = parts.map((p, i) => classifyIngredientName(p, i));
  const nutrition = extractNutrition(ocrText);
  const allergen = extractAllergenStatement(ocrText);
  const allergenObj = allergen
    ? {
        text: allergen.text,
        allergens: allergen.allergens,
        evidence: {
          id: uid("ev"),
          kind: "extracted_fact" as const,
          claim: "Allergen statement detected",
          sourceText: allergen.text,
        },
      }
    : undefined;

  const labelComplete = Boolean(list) && !truncation.isTruncated && !nutrition.incomplete;
  const rawVegan = summarizeProductVegan(ingredients, Boolean(list) && !truncation.isTruncated);

  // If ingredient list is truncated or incomplete, vegan status CANNOT be certified VEGAN
  const veganStatus = truncation.isTruncated
    ? "UNKNOWN"
    : rawVegan.veganStatus;

  const veganSummary = truncation.isTruncated
    ? `Ingredient list is incomplete or truncated (${truncation.reason}). Vegan status cannot be verified.`
    : rawVegan.veganSummary;

  const addedSugar = ingredients.some((i) => i.concernTags.includes("added sugar"));

  const missing: string[] = [];
  if (!list) missing.push("Ingredient list could not be isolated from OCR text.");
  else if (truncation.isTruncated) missing.push(`Incomplete ingredient list: ${truncation.reason}`);
  if (nutrition.incomplete) missing.push("Nutrition panel is incomplete or unreadable.");
  if (!allergen) missing.push("No 'Contains:' allergen statement was detected. Absence of a statement is not proof of absence of allergens.");

  const conflicts = detectAllergenConflicts(ingredients, allergenObj);
  for (const c of conflicts) {
    missing.push(c);
  }

  // Generate structured extraction tracking record
  const extractionRecord = buildStructuredExtractionRecord({
    productName: name,
    brand,
    rawIngredientsText: list,
    ingredients,
    allergenStatement: allergenObj,
    nutrition,
    servingSize: { amount: nutrition.servingSizeAmount, unit: nutrition.servingSizeUnit },
    rawOcrText: ocrText,
    confidence: confidence ?? null,
    qualityReport,
  });

  const category: ProductRecord["category"] = /tablet|capsule|mg\b/i.test(ocrText) ? "medicine" : "food";
  const product: ProductRecord = {
    id: uid("prd"),
    slug: `scan-${Date.now()}`,
    name,
    brand,
    category,
    description: "Structured from on-device OCR of a user-supplied label image. Values are only as reliable as the extracted text.",
    dataOrigin: "user_scan",
    dataSource: "On-device OCR (Tesseract) + local rules. Not a verified manufacturer record.",
    completeness: extractionRecord.completenessScore,
    ingredients,
    nutrition,
    allergenStatement: allergenObj,
    dietary: {
      veganStatus,
      veganSummary,
      vegetarianLikely: veganStatus === "NON-VEGAN" ? false : veganStatus === "VEGAN" ? true : null,
      containsAddedSugar: list && !truncation.isTruncated ? addedSugar : null,
      flags: [],
    },
    benefits: [],
    concerns: ingredients
      .filter((i) => i.veganStatus === "NON-VEGAN" || i.allergenTags.length)
      .map((i) => ({
        text: `${i.originalText}: ${i.classificationReason}`,
        evidence: i.evidence[0],
      })),
    missingInformation: missing,
    uncertainties: [
      confidence !== undefined && confidence !== null
        ? `OCR confidence reported at ${Math.round(confidence)}%. Low confidence lines may be misread.`
        : "OCR confidence was not reported by provider. Quality heuristics applied.",
      "Bounding boxes are omitted unless the OCR engine returns real coordinates.",
    ],
    imageDataUrl,
    extractedText: ocrText,
    extractionConfidence: confidence,
    labelVersion: 1,
    capturedAt: nowIso(),
    extractionRecord,
  };
  product.medicineDisclaimer = medicineDisclaimer(product);
  return product;
}

export function productFromManualText(text: string): ProductRecord {
  return buildProductFromOcr({ ocrText: text, confidence: 100 });
}
