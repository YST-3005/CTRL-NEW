import type { ProductRecord } from "@/types";
import { toBase } from "@/lib/nutrition/serving";

export interface NutrientCompareRow {
  nutrient: string;
  unit: string;
  left: number | null;
  right: number | null;
  basis: string;
}

export interface IngredientDiff {
  name: string;
  inLeft: boolean;
  inRight: boolean;
}

export function normalizePerGram(
  amount: number | null,
  servingAmount: number | null,
  servingUnit: string,
): number | null {
  if (amount === null || servingAmount === null || servingAmount <= 0) return null;
  const base = toBase(servingAmount, servingUnit);
  if (!base || base.family === "count") return null;
  if (base.amount === 0) return null;
  return (amount / base.amount) * 100;
}

export function compareNutrition(left: ProductRecord, right: ProductRecord): NutrientCompareRow[] {
  const names = Array.from(
    new Set([...left.nutrition.values.map((v) => v.nutrient), ...right.nutrition.values.map((v) => v.nutrient)]),
  );
  return names.map((nutrient) => {
    const l = left.nutrition.values.find((v) => v.nutrient === nutrient);
    const r = right.nutrition.values.find((v) => v.nutrient === nutrient);
    const unit = l?.unit || r?.unit || "";
    const sameFamily =
      left.nutrition.servingSizeUnit &&
      right.nutrition.servingSizeUnit &&
      toBase(1, left.nutrition.servingSizeUnit)?.family === toBase(1, right.nutrition.servingSizeUnit)?.family &&
      toBase(1, left.nutrition.servingSizeUnit)?.family !== "count";

    if (sameFamily) {
      return {
        nutrient,
        unit: `${unit} / 100 ${toBase(1, left.nutrition.servingSizeUnit)?.family === "mass" ? "g" : "ml"}`,
        left: normalizePerGram(l?.amount ?? null, left.nutrition.servingSizeAmount, left.nutrition.servingSizeUnit),
        right: normalizePerGram(r?.amount ?? null, right.nutrition.servingSizeAmount, right.nutrition.servingSizeUnit),
        basis: "Normalized to 100 g or 100 ml from printed servings. Missing values stay missing.",
      };
    }
    return {
      nutrient,
      unit,
      left: l?.amount ?? null,
      right: r?.amount ?? null,
      basis: "Printed serving values (units not comparable for per-100 normalization).",
    };
  });
}

export function compareIngredients(left: ProductRecord, right: ProductRecord): IngredientDiff[] {
  const l = new Set(left.ingredients.map((i) => i.name.toLowerCase()));
  const r = new Set(right.ingredients.map((i) => i.name.toLowerCase()));
  const names = Array.from(new Set([...l, ...r]));
  return names
    .map((name) => ({
      name,
      inLeft: l.has(name),
      inRight: r.has(name),
    }))
    .sort((a, b) => Number(a.inLeft && a.inRight) - Number(b.inLeft && b.inRight) || a.name.localeCompare(b.name));
}

export function compareAllergens(left: ProductRecord, right: ProductRecord) {
  const set = (p: ProductRecord) =>
    new Set([
      ...(p.allergenStatement?.allergens ?? []),
      ...p.ingredients.flatMap((i) => i.allergenTags),
    ].map((a) => a.toLowerCase()));
  const L = set(left);
  const R = set(right);
  const all = Array.from(new Set([...L, ...R]));
  return all.map((allergen) => ({ allergen, left: L.has(allergen), right: R.has(allergen) }));
}

export function meaningfulDifferences(left: ProductRecord, right: ProductRecord): string[] {
  const notes: string[] = [];
  notes.push(
    `Criteria: ingredient presence, allergen declarations, vegan evidence status, and nutrition on a compatible serving basis. No single “health score” is assigned.`,
  );
  if (left.dietary.veganStatus !== right.dietary.veganStatus) {
    notes.push(
      `Vegan evidence status differs: ${left.name} is ${left.dietary.veganStatus}; ${right.name} is ${right.dietary.veganStatus}.`,
    );
  }
  const ings = compareIngredients(left, right).filter((d) => d.inLeft !== d.inRight);
  if (ings.length) {
    notes.push(`Ingredient name mismatches: ${ings.map((i) => i.name).join(", ")}.`);
  }
  const nuts = compareNutrition(left, right).filter(
    (r) => r.left !== null && r.right !== null && Math.abs(r.left - r.right) > 0.05 * Math.max(r.left, r.right, 1),
  );
  for (const n of nuts.slice(0, 6)) {
    notes.push(`${n.nutrient}: ${left.name} ${n.left} vs ${right.name} ${n.right} (${n.unit}).`);
  }
  return notes;
}
