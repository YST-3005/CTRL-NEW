import type { Ingredient, ProductRecord, VeganStatus } from "@/types";
import { lookupIngredient } from "@/lib/vegan/catalog";
import { uid } from "@/lib/utils";

export function classifyIngredientName(raw: string, order: number): Ingredient {
  const knowledge = lookupIngredient(raw);
  if (!knowledge) {
    return {
      id: uid("ing"),
      name: raw.trim(),
      aliases: [],
      originalText: raw.trim(),
      order,
      veganStatus: "UNKNOWN",
      originNote: "No verified origin record in the local knowledge base",
      classificationReason:
        "This name is not matched to a verified origin record. Absence from a short non-vegan list is not evidence that an ingredient is vegan.",
      evidenceQuality: "none",
      evidence: [
        {
          id: uid("ev"),
          kind: "unknown",
          claim: `${raw.trim()} origin is unclassified`,
          sourceText: raw.trim(),
        },
      ],
      allergenTags: inferAllergenTags(raw),
      concernTags: [],
    };
  }

  const allergenTags = Array.from(new Set([...knowledge.allergenTags, ...inferAllergenTags(raw)]));
  return {
    id: uid("ing"),
    name: knowledge.name,
    aliases: knowledge.aliases,
    originalText: raw.trim(),
    order,
    veganStatus: knowledge.veganStatus,
    originNote: knowledge.originNote,
    classificationReason: knowledge.reason,
    evidenceQuality: knowledge.evidenceQuality,
    evidence: [
      {
        id: uid("ev"),
        kind: knowledge.veganStatus === "UNKNOWN" ? "unknown" : "extracted_fact",
        claim: `${knowledge.name} classified ${knowledge.veganStatus}`,
        sourceText: raw.trim(),
        notes: knowledge.reason,
      },
    ],
    allergenTags,
    concernTags: knowledge.concernTags,
  };
}

function inferAllergenTags(raw: string): string[] {
  const n = raw.toLowerCase();
  const tags: string[] = [];
  if (/\b(milk|whey|casein|lactose|butter|cream|yogurt|cheese)\b/.test(n)) tags.push("milk");
  if (/\b(egg|albumin|albumen)\b/.test(n)) tags.push("eggs");
  if (/\bpeanut/.test(n)) tags.push("peanuts");
  if (/\b(almond|cashew|walnut|pecan|hazelnut|pistachio)\b/.test(n)) tags.push("tree nuts");
  if (/\b(soy|soya|tofu)\b/.test(n)) tags.push("soy");
  if (/\b(wheat|barley|rye|malt)\b/.test(n)) tags.push("wheat");
  if (/\b(fish|anchovy|cod|tuna|salmon)\b/.test(n)) tags.push("fish");
  if (/\b(shrimp|crab|lobster|shellfish)\b/.test(n)) tags.push("shellfish");
  if (/\bsesame/.test(n)) tags.push("sesame");
  return tags;
}

export function summarizeProductVegan(ingredients: Ingredient[], labelComplete: boolean): {
  veganStatus: VeganStatus;
  veganSummary: string;
} {
  if (!ingredients.length) {
    return {
      veganStatus: "UNKNOWN",
      veganSummary:
        "No ingredient list is available. A vegan classification cannot be fabricated from missing data.",
    };
  }
  const hasNonVegan = ingredients.some((i) => i.veganStatus === "NON-VEGAN");
  const hasUnknown = ingredients.some((i) => i.veganStatus === "UNKNOWN");
  if (hasNonVegan) {
    const names = ingredients.filter((i) => i.veganStatus === "NON-VEGAN").map((i) => i.name);
    return {
      veganStatus: "NON-VEGAN",
      veganSummary: `Non-vegan ingredients supported by evidence: ${names.join(", ")}.`,
    };
  }
  if (hasUnknown || !labelComplete) {
    return {
      veganStatus: "UNKNOWN",
      veganSummary: !labelComplete
        ? "The ingredient list is incomplete. Product-level vegan status remains UNKNOWN even if listed items appear plant-derived."
        : "One or more ingredients have insufficient or variable-origin evidence, so the product remains UNKNOWN.",
    };
  }
  return {
    veganStatus: "VEGAN",
    veganSummary:
      "Every listed ingredient has adequate plant/mineral evidence in the local knowledge base. This is not a third-party vegan certification.",
  };
}

export function medicineDisclaimer(product: Pick<ProductRecord, "category">): string | undefined {
  if (product.category !== "medicine") return undefined;
  return "This tool does not advise stopping, substituting, or changing prescribed medication. Inactive ingredients and manufacturing details may require confirmation from the manufacturer or a pharmacist.";
}
