import type { NutritionFacts, NutritionValue } from "@/types";
import { round2 } from "@/lib/utils";

export interface ServingScaleResult {
  original: NutritionFacts;
  scaled: NutritionFacts;
  factor: number;
  valid: boolean;
  error?: string;
  calculated: true;
}

const MASS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  mg: 0.001,
  kg: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  lb: 453.592,
};

const VOLUME: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  fl_oz: 29.5735,
};

export function toBase(amount: number, unit: string): { amount: number; family: "mass" | "volume" | "count" } | null {
  const u = unit.toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
  if (MASS[u] !== undefined) return { amount: amount * MASS[u], family: "mass" };
  if (VOLUME[u] !== undefined) return { amount: amount * VOLUME[u], family: "volume" };
  if (u === "serving" || u === "servings" || u === "each" || u === "tablet" || u === "capsule") {
    return { amount, family: "count" };
  }
  return { amount, family: "count" };
}

export function scaleNutrition(
  original: NutritionFacts,
  newAmount: number,
  newUnit: string,
): ServingScaleResult {
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return {
      original,
      scaled: original,
      factor: 1,
      valid: false,
      error: "Serving size must be a number greater than zero.",
      calculated: true,
    };
  }
  if (original.servingSizeAmount === null || original.servingSizeAmount <= 0) {
    return {
      original,
      scaled: original,
      factor: 1,
      valid: false,
      error: "Original serving size is missing, so values cannot be recalculated.",
      calculated: true,
    };
  }

  const from = toBase(original.servingSizeAmount, original.servingSizeUnit);
  const to = toBase(newAmount, newUnit);
  if (!from || !to) {
    return {
      original,
      scaled: original,
      factor: 1,
      valid: false,
      error: "Serving unit is not recognized.",
      calculated: true,
    };
  }
  if (from.family !== to.family) {
    return {
      original,
      scaled: original,
      factor: 1,
      valid: false,
      error: `Cannot convert ${original.servingSizeUnit} to ${newUnit} without a density assumption. Units stay in the original family.`,
      calculated: true,
    };
  }

  const factor = to.amount / from.amount;
  const values: NutritionValue[] = original.values.map((v) => ({
    ...v,
    amount: v.amount === null ? null : round2(v.amount * factor),
    source: "inferred_interpretation",
    dailyValuePercent:
      v.dailyValuePercent === null || v.dailyValuePercent === undefined
        ? v.dailyValuePercent
        : round2(v.dailyValuePercent * factor),
  }));

  return {
    original,
    scaled: {
      servingSizeAmount: newAmount,
      servingSizeUnit: newUnit,
      servingsPerContainer: original.servingsPerContainer,
      values,
      incomplete: original.incomplete,
      notes: [
        ...original.notes,
        "Recalculated by proportional scaling of the printed serving. These are calculated values, not a medical recommendation.",
      ],
    },
    factor,
    valid: true,
    calculated: true,
  };
}

export function scaleByServings(original: NutritionFacts, servings: number): ServingScaleResult {
  return scaleNutrition(
    original,
    (original.servingSizeAmount ?? 1) * servings,
    original.servingSizeUnit,
  );
}
