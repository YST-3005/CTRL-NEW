import type { NutritionFacts, NutritionValue, ProductRecord } from "@/types";
import { classifyIngredientName, medicineDisclaimer, summarizeProductVegan } from "@/lib/vegan/classify";
import { nowIso, uid } from "@/lib/utils";
import {
  buildStructuredExtractionRecord,
  checkIngredientTruncation,
  detectAllergenConflicts,
} from "@/lib/extract/extractionEngine";
import type { ImageQualityReport } from "@/lib/ocr/quality";

const NUTRIENT_PATTERNS: { nutrient: string; unit: string; re: RegExp }[] = [
  { nutrient: "Calories", unit: "kcal", re: /(?:calories|energy)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:kcal|cal)?/i },
  { nutrient: "Total Fat", unit: "g", re: /(?:total\s+)?fat[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Saturated Fat", unit: "g", re: /(?:saturated\s+fat|saturates|of\s+which\s+saturates)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Trans Fat", unit: "g", re: /trans(?:\s+fat)?[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Cholesterol", unit: "mg", re: /cholesterol[:\s]*([0-9]+(?:\.[0-9]+)?)\s*mg/i },
  { nutrient: "Sodium", unit: "mg", re: /sodium[:\s]*([0-9]+(?:\.[0-9]+)?)\s*mg/i },
  { nutrient: "Total Carbohydrate", unit: "g", re: /(?:(?:total\s+)?(?:carbohydrate[s]?|carbs?))[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Dietary Fiber", unit: "g", re: /(?:dietary\s+)?fib(?:er|re)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Total Sugars", unit: "g", re: /(?:(?:total\s+)?sugars?|of\s+which\s+sugars)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
  { nutrient: "Added Sugars", unit: "g", re: /(?:added\s+sugars?|includes\s+([0-9]+(?:\.[0-9]+)?)\s*g\s+added\s+sugars?)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g?/i },
  { nutrient: "Protein", unit: "g", re: /protein[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i },
];

/**
 * Splits an ingredient string by delimiters (comma, semicolon, bullet)
 * while strictly respecting parenthetical and bracket sub-ingredient structures.
 * E.g. "Chocolate (Sugar, Cocoa Butter, Soy Lecithin), Peanuts, Salt"
 * yields 3 items:
 * 1. "Chocolate (Sugar, Cocoa Butter, Soy Lecithin)"
 * 2. "Peanuts"
 * 3. "Salt"
 */
export function splitIngredients(listText: string): string[] {
  if (!listText || !listText.trim()) return [];

  const raw = listText.trim();
  const items: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (char === "(") {
      parenDepth++;
      current += char;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
    } else if (char === "[") {
      bracketDepth++;
      current += char;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
    } else if (parenDepth === 0 && bracketDepth === 0 && (char === "," || char === ";" || char === "•" || char === "·" || char === "*")) {
      const trimmed = current.trim().replace(/^[\s•*·,-]+|[\s•*·,.-]+$/g, "");
      if (trimmed.length > 1) {
        items.push(trimmed);
      }
      current = "";
    } else {
      current += char;
    }
  }

  const finalTrimmed = current.trim().replace(/^[\s•*·,-]+|[\s•*·,.-]+$/g, "");
  if (finalTrimmed.length > 1) {
    items.push(finalTrimmed);
  }

  // Fallback: If no delimiter split occurred but text has newlines
  if (items.length <= 1 && raw.includes("\n")) {
    const lines = raw
      .split("\n")
      .map((l) => l.trim().replace(/^[\s•*·,-]+|[\s•*·,.-]+$/g, ""))
      .filter((l) => l.length > 1);
    if (lines.length > 1) {
      return lines;
    }
  }

  return items;
}

/**
 * Robust extraction of ingredient list from raw OCR text.
 * Handles headings (Ingredients, INGREDIENTS:, Ingrédients, 1ngredients),
 * multi-line formatting, and boundaries (Contains:, Nutrition Facts, Manufactured by).
 */
export function extractIngredientList(ocrText: string): string | null {
  if (!ocrText || !ocrText.trim()) return null;

  // Regex matching various ingredient header patterns
  // Including OCR noise such as 1ngredients, Ingredlents, Ingrédients, etc.
  const headerRegex = /(?:^|\n|[.;:])\s*(?:(?:active|inactive|other|organic)\s+)?(?:ingredients?|ingrédients?|ingredlents?|1ngredients?|ingredienten|zutaten)\s*(?:\/|\([^)]{1,20}\))?[:\-—]?\s*/i;

  const headerMatch = ocrText.match(headerRegex);
  if (!headerMatch || headerMatch.index === undefined) {
    return null;
  }

  const startIndex = headerMatch.index + headerMatch[0].length;
  const remainingText = ocrText.slice(startIndex);

  const stopRegex = /(?:\n|\s{2,}|(?<=[a-z0-9])\.\s+)(?:contains\b|may contain\b|allergen\b|allergy advice\b|nutrition facts\b|nutritional information\b|manufactured\b|distributed\b|packed\b|imported\b|store in\b|storage\b|best before\b|expiry\b|net wt\b|directions\b|warning\b|caution\b)/i;

  const stopMatch = remainingText.match(stopRegex);
  let rawList = stopMatch && stopMatch.index !== undefined
    ? remainingText.slice(0, stopMatch.index)
    : remainingText;

  // Clean trailing punctuation and whitespace
  rawList = rawList
    .replace(/\s+/g, " ")
    .replace(/[\s;]+$/, "")
    .trim();

  return rawList.length > 2 ? rawList : null;
}

/**
 * Extracts declared allergen statements ("Contains: Milk, Soy", "May Contain...", etc.)
 */
export function extractAllergenStatement(ocrText: string): { text: string; allergens: string[] } | undefined {
  if (!ocrText) return undefined;

  // Match allergen statements: "Contains: ...", "May contain...", "Allergy Advice:..."
  const match = ocrText.match(/(?:contains|may contain|allergen(?:s| information)?|allergy advice)[:\s]+([^\n.]+)/i);
  if (!match) return undefined;

  const statementText = match[0].trim();
  const rawAllergens = match[1];

  const allergens = rawAllergens
    .split(/,|and|\/|&/i)
    .map((s) => s.replace(/traces of|ingredients derived from/i, "").trim().toLowerCase())
    .filter((s) => s.length > 1 && !/^(and|or|may|contain|the)$/i.test(s));

  return {
    text: statementText,
    allergens,
  };
}

/**
 * Extracts nutrition facts values, serving sizes, and units from OCR text.
 */
export function extractNutrition(ocrText: string): NutritionFacts {
  if (!ocrText) {
    return {
      servingSizeAmount: null,
      servingSizeUnit: "g",
      values: [],
      incomplete: true,
      notes: ["Nutrition facts table was not readable."],
    };
  }

  // Match serving size: "Serving size: 1 bar (40g)", "Serving size: 30g", "Per 100g", "Per serving (25g)"
  let servingAmount: number | null = null;
  let servingUnit = "g";

  const servingMatch =
    ocrText.match(/(?:serving\s+size|per\s+serving|portion\s+size)[:\s]*(?:[0-9]+\s+[a-z]+\s*\()?([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)/i) ||
    ocrText.match(/per\s+([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)/i);

  if (servingMatch) {
    servingAmount = Number(servingMatch[1]);
    servingUnit = servingMatch[2].toLowerCase();
  }

  const values: NutritionValue[] = [];
  for (const p of NUTRIENT_PATTERNS) {
    const m = ocrText.match(p.re);
    if (m) {
      const amountStr = m[1] || m[2];
      if (amountStr) {
        values.push({
          nutrient: p.nutrient,
          amount: Number(amountStr),
          unit: p.unit,
          source: "extracted_fact",
        });
      }
    }
  }

  // Handle Salt to Sodium conversion if sodium is missing
  const hasSodium = values.some((v) => v.nutrient === "Sodium");
  if (!hasSodium) {
    const saltMatch = ocrText.match(/salt[:\s]*([0-9]+(?:\.[0-9]+)?)\s*g/i);
    if (saltMatch) {
      const saltG = Number(saltMatch[1]);
      const sodiumMg = Math.round(saltG * 400); // 1g salt ≈ 400mg sodium
      values.push({
        nutrient: "Sodium",
        amount: sodiumMg,
        unit: "mg",
        source: "inferred_interpretation",
      });
    }
  }

  const notes: string[] = [];
  if (!servingAmount) notes.push("Serving size was not readable on this label.");
  if (!values.length) notes.push("Nutrition facts table was not readable.");

  return {
    servingSizeAmount: servingAmount,
    servingSizeUnit: servingUnit,
    values,
    incomplete: values.length < 3 || !servingAmount,
    notes,
  };
}

/**
 * Extracts product title and brand headline from OCR text
 */
export function extractProductName(ocrText: string): { name: string; brand: string } {
  const lines = ocrText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => {
      // Filter out headings and short noise
      if (l.length < 3) return false;
      if (/^(nutrition facts|ingredients|contains|net wt|servings|best before)/i.test(l)) return false;
      return true;
    });

  const name = lines[0]?.slice(0, 80) || "Unnamed scanned label";
  const brandLine = lines.find((l) => /brand|by\s+[A-Z]|inc\.|llc|co\./i.test(l));
  const brand = brandLine ? brandLine.replace(/brand[:\s]*/i, "").slice(0, 60) : "Identified Product";

  return { name, brand };
}

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

  const rawVegan = summarizeProductVegan(ingredients, Boolean(list) && !truncation.isTruncated);

  // If ingredient list is truncated or incomplete, vegan status CANNOT be certified VEGAN
  const veganStatus = truncation.isTruncated ? "UNKNOWN" : rawVegan.veganStatus;
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
