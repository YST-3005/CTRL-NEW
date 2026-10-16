import type { ProductRecord } from "@/types";
import { normalizeName } from "@/lib/utils";

export interface LabelChange {
  type:
    | "ingredient_added"
    | "ingredient_removed"
    | "ingredient_order"
    | "nutrition"
    | "serving"
    | "allergen"
    | "completeness";
  title: string;
  detail: string;
  supported: boolean;
}

export function diffLabelVersions(older: ProductRecord, newer: ProductRecord): LabelChange[] {
  const changes: LabelChange[] = [];
  const oNames = older.ingredients.map((i) => normalizeName(i.name));
  const nNames = newer.ingredients.map((i) => normalizeName(i.name));
  const oSet = new Set(oNames);
  const nSet = new Set(nNames);

  for (const name of nSet) {
    if (!oSet.has(name)) {
      changes.push({
        type: "ingredient_added",
        title: `Added: ${name}`,
        detail: `Present on the newer capture, not on the older capture.`,
        supported: true,
      });
    }
  }
  for (const name of oSet) {
    if (!nSet.has(name)) {
      changes.push({
        type: "ingredient_removed",
        title: `Removed: ${name}`,
        detail: `Present on the older capture, not on the newer capture.`,
        supported: true,
      });
    }
  }

  const shared = oNames.filter((n) => nSet.has(n));
  const oOrder = shared.map((n) => oNames.indexOf(n)).join(",");
  const nOrder = shared.map((n) => nNames.indexOf(n)).join(",");
  if (oOrder !== nOrder && shared.length > 1) {
    changes.push({
      type: "ingredient_order",
      title: "Ingredient order changed among shared names",
      detail: `Older order: ${older.ingredients.map((i) => i.name).join(", ")}. Newer order: ${newer.ingredients.map((i) => i.name).join(", ")}. Order changes can also be OCR artifacts.`,
      supported: true,
    });
  }

  if (
    older.nutrition.servingSizeAmount !== newer.nutrition.servingSizeAmount ||
    older.nutrition.servingSizeUnit !== newer.nutrition.servingSizeUnit
  ) {
    changes.push({
      type: "serving",
      title: "Serving size changed",
      detail: `${older.nutrition.servingSizeAmount} ${older.nutrition.servingSizeUnit} → ${newer.nutrition.servingSizeAmount} ${newer.nutrition.servingSizeUnit}`,
      supported: true,
    });
  }

  for (const nv of newer.nutrition.values) {
    const ov = older.nutrition.values.find((v) => v.nutrient === nv.nutrient);
    if (!ov) {
      changes.push({
        type: "nutrition",
        title: `${nv.nutrient} appeared`,
        detail: `Newer capture lists ${nv.amount} ${nv.unit}. Older capture did not list this nutrient.`,
        supported: true,
      });
      continue;
    }
    if (ov.amount !== null && nv.amount !== null && ov.amount !== nv.amount) {
      changes.push({
        type: "nutrition",
        title: `${nv.nutrient} ${ov.amount} → ${nv.amount} ${nv.unit}`,
        detail: "Numeric change between the two captured nutrition tables.",
        supported: true,
      });
    }
  }

  const oAll = older.allergenStatement?.text ?? "";
  const nAll = newer.allergenStatement?.text ?? "";
  if (oAll !== nAll) {
    changes.push({
      type: "allergen",
      title: "Allergen statement changed",
      detail: `Older: “${oAll || "none detected"}”. Newer: “${nAll || "none detected"}”.`,
      supported: true,
    });
  }

  if (older.completeness !== newer.completeness) {
    changes.push({
      type: "completeness",
      title: "Data completeness changed",
      detail: `${older.completeness}% → ${newer.completeness}%. Completeness can change from OCR quality without a formulation change.`,
      supported: true,
    });
  }

  if (!changes.length) {
    changes.push({
      type: "completeness",
      title: "No supported differences",
      detail: "The two records do not contain evidenced additions, removals, or numeric nutrition changes.",
      supported: false,
    });
  }

  return changes;
}
