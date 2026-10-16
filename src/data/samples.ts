import type { ProductRecord } from "@/types";
import { classifyIngredientName, medicineDisclaimer, summarizeProductVegan } from "@/lib/vegan/classify";
import { completenessScore } from "@/lib/utils";
import { buildStructuredExtractionRecord } from "@/lib/extract/extractionEngine";

function facts(
  amount: number,
  unit: string,
  rows: [string, number | null, string][],
  incomplete = false,
  notes: string[] = [],
) {
  return {
    servingSizeAmount: amount,
    servingSizeUnit: unit,
    values: rows.map(([nutrient, val, u]) => ({
      nutrient,
      amount: val,
      unit: u,
      source: "extracted_fact" as const,
    })),
    incomplete,
    notes,
  };
}

function product(
  partial: Omit<ProductRecord, "ingredients" | "dietary" | "completeness" | "medicineDisclaimer"> & {
    ingredientNames: string[];
    labelComplete: boolean;
  },
): ProductRecord {
  const ingredients = partial.ingredientNames.map((n, i) => classifyIngredientName(n, i));
  const vegan = summarizeProductVegan(ingredients, partial.labelComplete);
  const { ingredientNames, labelComplete, ...rest } = partial;
  const record: ProductRecord = {
    ...rest,
    ingredients,
    completeness: completenessScore([
      ingredients.length > 0,
      !rest.nutrition.incomplete,
      Boolean(rest.allergenStatement),
      rest.missingInformation.length === 0,
      labelComplete,
    ]),
    dietary: {
      veganStatus: vegan.veganStatus,
      veganSummary: vegan.veganSummary,
      vegetarianLikely: vegan.veganStatus === "NON-VEGAN" ? false : vegan.veganStatus === "VEGAN" ? true : null,
      containsAddedSugar: ingredients.some((i) => i.concernTags.includes("added sugar")),
      flags: [],
    },
  };
  record.medicineDisclaimer = medicineDisclaimer(record);
  record.extractionRecord = buildStructuredExtractionRecord({
    productName: record.name,
    brand: record.brand,
    rawIngredientsText: partial.ingredientNames.join(", "),
    ingredients,
    allergenStatement: record.allergenStatement,
    nutrition: record.nutrition,
    servingSize: {
      amount: record.nutrition.servingSizeAmount,
      unit: record.nutrition.servingSizeUnit,
    },
    rawOcrText: `${record.name}\n${record.brand}\nIngredients: ${partial.ingredientNames.join(", ")}\n${record.allergenStatement?.text || ""}`,
    confidence: record.extractionConfidence ?? 85,
  });
  return record;
}

export const SAMPLE_PRODUCTS: ProductRecord[] = [
  product({
    id: "sample-oat-dawn",
    slug: "oat-dawn-clusters",
    name: "Oat Dawn Clusters",
    brand: "Helion Pantry (demo)",
    category: "food",
    description:
      "Demonstration breakfast cereal. All nutrition and ingredients are synthetic demo values, not a real commercial SKU.",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library (fictional product).",
    ingredientNames: [
      "whole grain oats",
      "cane sugar",
      "sunflower oil",
      "salt",
      "natural flavors",
      "soy lecithin",
    ],
    labelComplete: true,
    nutrition: facts(55, "g", [
      ["Calories", 220, "kcal"],
      ["Total Fat", 6, "g"],
      ["Saturated Fat", 0.8, "g"],
      ["Trans Fat", 0, "g"],
      ["Cholesterol", 0, "mg"],
      ["Sodium", 140, "mg"],
      ["Total Carbohydrate", 38, "g"],
      ["Dietary Fiber", 5, "g"],
      ["Total Sugars", 9, "g"],
      ["Added Sugars", 8, "g"],
      ["Protein", 6, "g"],
    ]),
    allergenStatement: {
      text: "Contains: Soy. May contain wheat.",
      allergens: ["soy", "wheat"],
      evidence: {
        id: "ev-oat-all",
        kind: "extracted_fact",
        claim: "Allergen statement",
        sourceText: "Contains: Soy. May contain wheat.",
      },
    },
    benefits: [
      {
        text: "Provides 5 g dietary fiber per printed 55 g serving (demo value).",
        evidence: {
          id: "ev-oat-fib",
          kind: "extracted_fact",
          claim: "Fiber 5 g",
          sourceText: "Dietary Fiber 5g",
          sourceField: "nutrition",
        },
      },
    ],
    concerns: [
      {
        text: "Added sugars 8 g per printed serving (demo value).",
        evidence: {
          id: "ev-oat-sug",
          kind: "extracted_fact",
          claim: "Added Sugars 8 g",
          sourceText: "Added Sugars 8g",
        },
      },
      {
        text: "Natural flavors have undisclosed composition, so vegan origin of that component is UNKNOWN.",
        evidence: {
          id: "ev-oat-nf",
          kind: "unknown",
          claim: "Natural flavors origin unknown",
          sourceText: "natural flavors",
        },
      },
    ],
    missingInformation: [],
    uncertainties: [
      "Cane sugar refining process is not stated, so sugar remains UNKNOWN for strict vegan classification.",
      "This is a fictional demonstration product.",
    ],
    thumbnail: "oat",
    extractedText:
      "Oat Dawn Clusters\nHelion Pantry\nINGREDIENTS: whole grain oats, cane sugar, sunflower oil, salt, natural flavors, soy lecithin.\nContains: Soy. May contain wheat.\nServing size 55 g\nCalories 220 Total Fat 6g Saturated Fat 0.8g Trans Fat 0g Cholesterol 0mg Sodium 140mg Total Carbohydrate 38g Dietary Fiber 5g Total Sugars 9g Added Sugars 8g Protein 6g",
    extractionConfidence: 100,
    labelVersion: 1,
    capturedAt: "2026-01-12T10:00:00.000Z",
  }),
  product({
    id: "sample-nova-whey",
    slug: "nova-whey-cocoa",
    name: "Nova Whey Cocoa",
    brand: "Orbit Forge (demo)",
    category: "supplement",
    description: "Demonstration whey cocoa powder. Synthetic values. Clearly dairy-based.",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library (fictional product).",
    ingredientNames: [
      "whey protein isolate",
      "cocoa powder",
      "cane sugar",
      "natural flavors",
      "soy lecithin",
      "salt",
    ],
    labelComplete: true,
    nutrition: facts(32, "g", [
      ["Calories", 120, "kcal"],
      ["Total Fat", 1.5, "g"],
      ["Saturated Fat", 0.9, "g"],
      ["Cholesterol", 15, "mg"],
      ["Sodium", 90, "mg"],
      ["Total Carbohydrate", 6, "g"],
      ["Total Sugars", 4, "g"],
      ["Added Sugars", 3, "g"],
      ["Protein", 24, "g"],
    ]),
    allergenStatement: {
      text: "Contains: Milk, Soy.",
      allergens: ["milk", "soy"],
      evidence: {
        id: "ev-whey-all",
        kind: "extracted_fact",
        claim: "Allergen statement",
        sourceText: "Contains: Milk, Soy.",
      },
    },
    benefits: [
      {
        text: "24 g protein per printed 32 g serving (demo value).",
        evidence: {
          id: "ev-whey-pro",
          kind: "extracted_fact",
          claim: "Protein 24 g",
          sourceText: "Protein 24g",
        },
      },
    ],
    concerns: [
      {
        text: "Whey protein isolate is a milk fraction (NON-VEGAN) and a milk allergen.",
        evidence: {
          id: "ev-whey-nv",
          kind: "extracted_fact",
          claim: "whey protein isolate is milk-derived",
          sourceText: "whey protein isolate",
        },
      },
    ],
    missingInformation: ["Amino acid profile not provided on this demo label."],
    uncertainties: ["This is a fictional demonstration product."],
    thumbnail: "whey",
    extractedText:
      "Nova Whey Cocoa\nOrbit Forge\nINGREDIENTS: whey protein isolate, cocoa powder, cane sugar, natural flavors, soy lecithin, salt.\nContains: Milk, Soy.\nServing size 32 g Calories 120 Total Fat 1.5g Saturated Fat 0.9g Cholesterol 15mg Sodium 90mg Total Carbohydrate 6g Total Sugars 4g Added Sugars 3g Protein 24g",
    extractionConfidence: 100,
    labelVersion: 1,
    capturedAt: "2026-02-02T10:00:00.000Z",
  }),
  product({
    id: "sample-lumen-gummies",
    slug: "lumen-c-gummies",
    name: "Lumen C Gummies",
    brand: "Aether Lab (demo)",
    category: "supplement",
    description: "Demonstration gummy vitamin. Gelatin-based. Synthetic values.",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library (fictional product).",
    ingredientNames: [
      "glucose syrup",
      "sugar",
      "gelatin",
      "ascorbic acid",
      "citric acid",
      "natural flavors",
      "carmine",
      "coconut oil",
    ],
    labelComplete: true,
    nutrition: facts(4, "g", [
      ["Calories", 15, "kcal"],
      ["Total Fat", 0, "g"],
      ["Sodium", 5, "mg"],
      ["Total Carbohydrate", 3, "g"],
      ["Total Sugars", 2, "g"],
      ["Added Sugars", 2, "g"],
      ["Protein", 1, "g"],
      ["Vitamin C", 90, "mg"],
    ]),
    allergenStatement: {
      text: "Manufactured in a facility that processes milk.",
      allergens: [],
      evidence: {
        id: "ev-gum-all",
        kind: "extracted_fact",
        claim: "Facility statement is not a Contains: list",
        sourceText: "Manufactured in a facility that processes milk.",
      },
    },
    benefits: [
      {
        text: "Ascorbic acid is listed (demo 90 mg Vitamin C per serving).",
        evidence: {
          id: "ev-gum-c",
          kind: "extracted_fact",
          claim: "Vitamin C 90 mg",
          sourceText: "Vitamin C 90mg",
        },
      },
    ],
    concerns: [
      {
        text: "Gelatin is animal collagen (NON-VEGAN).",
        evidence: {
          id: "ev-gum-gel",
          kind: "extracted_fact",
          claim: "gelatin is non-vegan",
          sourceText: "gelatin",
        },
      },
      {
        text: "Carmine is an insect-derived color (NON-VEGAN).",
        evidence: {
          id: "ev-gum-car",
          kind: "extracted_fact",
          claim: "carmine is non-vegan",
          sourceText: "carmine",
        },
      },
    ],
    missingInformation: ["Animal species for gelatin is not specified."],
    uncertainties: ["This is a fictional demonstration product."],
    thumbnail: "gummy",
    extractedText:
      "Lumen C Gummies\nAether Lab\nINGREDIENTS: glucose syrup, sugar, gelatin, ascorbic acid, citric acid, natural flavors, carmine, coconut oil.\nServing size 4 g Calories 15 Total Fat 0g Sodium 5mg Total Carbohydrate 3g Total Sugars 2g Added Sugars 2g Protein 1g Vitamin C 90mg",
    extractionConfidence: 100,
    labelVersion: 1,
    capturedAt: "2026-03-08T10:00:00.000Z",
  }),
  product({
    id: "sample-tablet-d3",
    slug: "orbit-d3-tablet",
    name: "Orbit D3 25 mcg Tablet",
    brand: "Helion Rx (demo)",
    category: "medicine",
    description:
      "Demonstration tablet inactive-ingredient panel. Not a real medicine. Do not use for treatment decisions.",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library (fictional medicine tablet).",
    ingredientNames: [
      "cholecalciferol",
      "microcrystalline cellulose",
      "magnesium stearate",
      "hypromellose",
      "titanium dioxide",
    ],
    labelComplete: false,
    nutrition: facts(1, "tablet", [["Vitamin D3", 25, "mcg"]], true, [
      "Full nutrition facts are not applicable to this demo tablet. Strength shown is a synthetic demo value.",
    ]),
    benefits: [
      {
        text: "HPMC (hypromellose) is typically a plant-polymer capsule/coating alternative to gelatin.",
        evidence: {
          id: "ev-d3-hpmc",
          kind: "inferred_interpretation",
          claim: "HPMC plant polymer",
          sourceText: "hypromellose",
        },
      },
    ],
    concerns: [
      {
        text: "Vitamin D3 / cholecalciferol origin is UNKNOWN without a lanolin vs lichen statement.",
        evidence: {
          id: "ev-d3-unk",
          kind: "unknown",
          claim: "D3 origin not proven",
          sourceText: "cholecalciferol",
        },
      },
      {
        text: "Magnesium stearate origin is UNKNOWN (plant or tallow).",
        evidence: {
          id: "ev-d3-st",
          kind: "unknown",
          claim: "stearate origin unknown",
          sourceText: "magnesium stearate",
        },
      },
    ],
    missingInformation: [
      "Manufacturer does not state D3 source (lanolin vs lichen).",
      "Colorants, coatings, and processing aids may be omitted from a short inactive list.",
    ],
    uncertainties: [
      "Fictional demonstration tablet. Not an FDA label.",
      "Product-level vegan status must remain UNKNOWN because of variable-origin inactives and incomplete disclosure.",
    ],
    thumbnail: "tablet",
    extractedText:
      "Orbit D3 25 mcg Tablet\nHelion Rx\nInactive ingredients: microcrystalline cellulose, magnesium stearate, hypromellose, titanium dioxide. Active: cholecalciferol 25 mcg.",
    extractionConfidence: 100,
    labelVersion: 1,
    capturedAt: "2026-04-01T10:00:00.000Z",
  }),
  product({
    id: "sample-peanut-vector",
    slug: "vector-peanut-bar",
    name: "Vector Peanut Bar",
    brand: "Transit Foods (demo)",
    category: "food",
    description: "Demonstration peanut bar used for allergen-alert journeys. Synthetic values.",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library (fictional product).",
    ingredientNames: ["peanuts", "brown sugar", "palm oil", "salt", "soy lecithin"],
    labelComplete: true,
    nutrition: facts(45, "g", [
      ["Calories", 230, "kcal"],
      ["Total Fat", 14, "g"],
      ["Saturated Fat", 3.5, "g"],
      ["Sodium", 125, "mg"],
      ["Total Carbohydrate", 18, "g"],
      ["Dietary Fiber", 3, "g"],
      ["Total Sugars", 11, "g"],
      ["Added Sugars", 9, "g"],
      ["Protein", 8, "g"],
    ]),
    allergenStatement: {
      text: "Contains: Peanuts, Soy.",
      allergens: ["peanuts", "soy"],
      evidence: {
        id: "ev-pea-all",
        kind: "extracted_fact",
        claim: "Allergen statement",
        sourceText: "Contains: Peanuts, Soy.",
      },
    },
    benefits: [
      {
        text: "8 g protein per printed serving (demo value).",
        evidence: {
          id: "ev-pea-pro",
          kind: "extracted_fact",
          claim: "Protein 8 g",
          sourceText: "Protein 8g",
        },
      },
    ],
    concerns: [
      {
        text: "Peanuts are a major allergen explicitly declared.",
        evidence: {
          id: "ev-pea-p",
          kind: "extracted_fact",
          claim: "Contains peanuts",
          sourceText: "Contains: Peanuts, Soy.",
        },
      },
    ],
    missingInformation: [],
    uncertainties: ["Brown sugar refining process is not stated.", "Fictional demonstration product."],
    thumbnail: "bar",
    extractedText:
      "Vector Peanut Bar\nTransit Foods\nINGREDIENTS: peanuts, brown sugar, palm oil, salt, soy lecithin.\nContains: Peanuts, Soy.\nServing size 45 g Calories 230 Total Fat 14g Saturated Fat 3.5g Sodium 125mg Total Carbohydrate 18g Dietary Fiber 3g Total Sugars 11g Added Sugars 9g Protein 8g",
    extractionConfidence: 100,
    labelVersion: 1,
    capturedAt: "2026-05-20T10:00:00.000Z",
  }),
];

export const LABEL_VERSION_DEMO: { older: ProductRecord; newer: ProductRecord } = (() => {
  const older = SAMPLE_PRODUCTS.find((p) => p.id === "sample-oat-dawn")!;
  const newerIngredients = [
    "whole grain oats",
    "cane sugar",
    "sunflower oil",
    "honey",
    "salt",
    "natural flavors",
    "soy lecithin",
  ];
  const newerBase = product({
    ...older,
    id: "sample-oat-dawn-v2",
    name: "Oat Dawn Clusters",
    brand: older.brand,
    category: older.category,
    description: "Demonstration reformulation of Oat Dawn Clusters (fictional v2 label).",
    dataOrigin: "demonstration_sample",
    dataSource: "LabelLens Guardian demonstration library — second fictional label capture.",
    ingredientNames: newerIngredients,
    labelComplete: true,
    nutrition: facts(55, "g", [
      ["Calories", 228, "kcal"],
      ["Total Fat", 6, "g"],
      ["Saturated Fat", 0.8, "g"],
      ["Trans Fat", 0, "g"],
      ["Cholesterol", 0, "mg"],
      ["Sodium", 150, "mg"],
      ["Total Carbohydrate", 39, "g"],
      ["Dietary Fiber", 5, "g"],
      ["Total Sugars", 11, "g"],
      ["Added Sugars", 10, "g"],
      ["Protein", 6, "g"],
    ]),
    allergenStatement: {
      text: "Contains: Soy. May contain wheat and milk.",
      allergens: ["soy", "wheat", "milk"],
      evidence: {
        id: "ev-oat2-all",
        kind: "extracted_fact",
        claim: "Updated allergen statement",
        sourceText: "Contains: Soy. May contain wheat and milk.",
      },
    },
    benefits: older.benefits,
    concerns: [
      {
        text: "Honey was added on the v2 demo label (NON-VEGAN).",
        evidence: {
          id: "ev-oat2-honey",
          kind: "extracted_fact",
          claim: "honey added",
          sourceText: "honey",
        },
      },
    ],
    missingInformation: [],
    uncertainties: [
      "Both versions are fictional demonstration captures, not a documented commercial reformulation.",
    ],
    thumbnail: "oat",
    extractedText:
      "Oat Dawn Clusters\nINGREDIENTS: whole grain oats, cane sugar, sunflower oil, honey, salt, natural flavors, soy lecithin.\nContains: Soy. May contain wheat and milk.\nServing size 55 g Calories 228 ... Added Sugars 10g Protein 6g",
    extractionConfidence: 100,
    labelVersion: 2,
    capturedAt: "2026-08-14T10:00:00.000Z",
  });
  return { older, newer: newerBase };
})();

export function getSampleById(id: string): ProductRecord | undefined {
  if (id === LABEL_VERSION_DEMO.newer.id) return LABEL_VERSION_DEMO.newer;
  return SAMPLE_PRODUCTS.find((p) => p.id === id || p.slug === id);
}

export const STOREFRONT_PRODUCTS = SAMPLE_PRODUCTS.map((p) => ({
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  price: p.category === "medicine" ? "12.40" : p.category === "supplement" ? "28.00" : "4.80",
  product: p,
}));
