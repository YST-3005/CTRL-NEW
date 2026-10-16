import type { ChatMessage, Evidence, ProductRecord } from "@/types";
import { evaluateDietaryRules } from "@/lib/dietary/rules";
import { DEFAULT_PREFERENCES } from "@/types";
import { scaleByServings, scaleNutrition } from "@/lib/nutrition/serving";
import { uid, nowIso, normalizeName } from "@/lib/utils";

export function answerAboutProduct(
  question: string,
  product: ProductRecord | null,
  extra?: { compareWith?: ProductRecord | null; prefs?: typeof DEFAULT_PREFERENCES },
): ChatMessage {
  const q = question.toLowerCase();
  const sources: Evidence[] = [];
  if (!product) {
    return msg(
      "No product is selected. Load a scan or sample first. I can only answer from available label data.",
      [],
      true,
    );
  }

  if (/diagnos|disease|cure|treat me|medical advice/i.test(question)) {
    return msg(
      "I cannot diagnose, treat, or replace professional medical advice. I can only point at what this label states or what is unknown on it.",
      [],
      false,
      true,
    );
  }

  if (/added sugar|added sugars/.test(q)) {
    const added = product.nutrition.values.find((v) => /added sugar/i.test(v.nutrient));
    const flagged = product.ingredients.filter((i) => i.concernTags.includes("added sugar"));
    if (added?.amount !== null && added?.amount !== undefined) {
      sources.push({
        id: uid("ev"),
        kind: "extracted_fact",
        claim: `${added.nutrient} ${added.amount}${added.unit}`,
        sourceText: `${added.nutrient} ${added.amount}${added.unit}`,
        sourceField: "nutrition",
      });
      return msg(
        `On this label, Added Sugars are listed as ${added.amount} ${added.unit} per printed serving of ${product.nutrition.servingSizeAmount} ${product.nutrition.servingSizeUnit}. Ingredient names that commonly indicate added sugars: ${flagged.map((f) => f.originalText).join(", ") || "none matched in the ingredient list"}.`,
        sources,
      );
    }
    if (flagged.length) {
      flagged.forEach((f) => f.evidence[0] && sources.push(f.evidence[0]));
      return msg(
        `Added-sugar grams are not on the nutrition table. Ingredient names associated with added sugars on this label: ${flagged.map((f) => f.originalText).join(", ")}. That is ingredient evidence, not a gram amount.`,
        sources,
      );
    }
    return msg(
      `This label does not list an Added Sugars line and no ingredient names in the local added-sugar list were matched. That is not proof the product is sugar-free; the data is missing or unmatched.`,
      [
        {
          id: uid("ev"),
          kind: "unknown",
          claim: "Added sugar not evidenced",
        },
      ],
      true,
    );
  }

  if (/twice|double|2x|two servings|serving size/.test(q) && /eat|change|what|serving/.test(q)) {
    const scaled = scaleByServings(product.nutrition, 2);
    if (!scaled.valid) {
      return msg(scaled.error || "Cannot scale this nutrition panel.", [], true);
    }
    const cal = scaled.scaled.values.find((v) => v.nutrient === "Calories");
    return msg(
      `If you eat twice the printed serving (${product.nutrition.servingSizeAmount} ${product.nutrition.servingSizeUnit} × 2), calculated calories become ${cal?.amount ?? "—"} (printed calories scaled by 2). Other nutrients scale by the same factor. These are calculated values, not medical advice, and they assume the printed serving is accurate.`,
      [
        {
          id: uid("ev"),
          kind: "inferred_interpretation",
          claim: "Proportional serving scale ×2",
          sourceField: "nutrition",
        },
      ],
    );
  }

  if (/investigate|flagged|why was|which ingredients/.test(q)) {
    const interesting = product.ingredients.filter(
      (i) => i.veganStatus !== "VEGAN" || i.allergenTags.length || i.concernTags.length,
    );
    interesting.forEach((i) => i.evidence[0] && sources.push(i.evidence[0]));
    if (!interesting.length) {
      return msg(
        "No ingredients were flagged by the local rules. Completeness is still " +
          `${product.completeness}%. Missing: ${product.missingInformation.join(" ") || "none listed"}.`,
        [],
      );
    }
    return msg(
      interesting
        .map((i) => `${i.originalText}: ${i.veganStatus}. ${i.classificationReason}`)
        .join("\n"),
      sources,
    );
  }

  if (/vegan/.test(q)) {
    return msg(product.dietary.veganSummary, [
      {
        id: uid("ev"),
        kind: product.dietary.veganStatus === "UNKNOWN" ? "unknown" : "extracted_fact",
        claim: product.dietary.veganStatus,
      },
    ]);
  }

  if (/compare/.test(q) && extra?.compareWith) {
    const other = extra.compareWith;
    return msg(
      `Comparing ${product.name} (${product.dietary.veganStatus}) with ${other.name} (${other.dietary.veganStatus}). Use the Comparison chamber for charts. I will not rank a universal “healthier” product.`,
      [],
    );
  }

  if (/protein|calorie|sodium|fiber|sugar/.test(q)) {
    const key = ["protein", "calories", "sodium", "fiber", "sugar"].find((k) => q.includes(k));
    const row = product.nutrition.values.find((v) => normalizeName(v.nutrient).includes(key || "___"));
    if (!row || row.amount === null) {
      return msg(`No readable ${key} value is present on this nutrition panel.`, [], true);
    }
    sources.push({
      id: uid("ev"),
      kind: "extracted_fact",
      claim: `${row.nutrient} ${row.amount}${row.unit}`,
      sourceText: `${row.nutrient} ${row.amount} ${row.unit}`,
      sourceField: "nutrition",
    });
    return msg(
      `${row.nutrient} is ${row.amount} ${row.unit} per printed serving of ${product.nutrition.servingSizeAmount} ${product.nutrition.servingSizeUnit}.`,
      sources,
    );
  }

  if (extra?.prefs) {
    const findings = evaluateDietaryRules(product, extra.prefs);
    if (/allerg|preference|safe for me/.test(q) && findings.length) {
      return msg(findings.map((f) => `${f.title}: ${f.detail}`).join("\n"), []);
    }
  }

  const named = product.ingredients.find((i) => q.includes(i.name.toLowerCase()) || q.includes(i.originalText.toLowerCase()));
  if (named) {
    named.evidence.forEach((e) => sources.push(e));
    return msg(
      `${named.originalText} — vegan status ${named.veganStatus}. Origin note: ${named.originNote}. ${named.classificationReason}`,
      sources,
    );
  }

  return msg(
    `I can only use this label. Available fields: ${product.ingredients.length} ingredients, ${product.nutrition.values.length} nutrient rows, completeness ${product.completeness}%. Ask about added sugar, serving size doubling, a named ingredient, vegan status, or allergens. Missing: ${product.missingInformation[0] ?? "none listed"}.`,
    [],
    true,
  );
}

function msg(content: string, sources: Evidence[], unknown = false, educationalOnly = false): ChatMessage {
  return {
    id: uid("msg"),
    role: "assistant",
    content,
    createdAt: nowIso(),
    sources,
    unknown,
    educationalOnly,
  };
}

export function scaleQuestion(product: ProductRecord, amount: number, unit: string): string {
  const res = scaleNutrition(product.nutrition, amount, unit);
  if (!res.valid) return res.error || "invalid";
  const cal = res.scaled.values.find((v) => v.nutrient === "Calories");
  return `Calculated calories at ${amount} ${unit}: ${cal?.amount ?? "—"}.`;
}
