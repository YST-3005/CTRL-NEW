import { describe, expect, it } from "vitest";
import { scaleNutrition } from "./serving";
import type { NutritionFacts } from "@/types";

const facts: NutritionFacts = {
  servingSizeAmount: 50,
  servingSizeUnit: "g",
  values: [
    { nutrient: "Calories", amount: 100, unit: "kcal", source: "extracted_fact" },
    { nutrient: "Sodium", amount: null, unit: "mg", source: "unknown" },
  ],
  incomplete: false,
  notes: [],
};

describe("scaleNutrition", () => {
  it("doubles calories for double mass", () => {
    const r = scaleNutrition(facts, 100, "g");
    expect(r.valid).toBe(true);
    expect(r.factor).toBe(2);
    expect(r.scaled.values[0].amount).toBe(200);
  });

  it("keeps missing nutrients missing", () => {
    const r = scaleNutrition(facts, 100, "g");
    expect(r.scaled.values[1].amount).toBeNull();
  });

  it("rejects zero", () => {
    const r = scaleNutrition(facts, 0, "g");
    expect(r.valid).toBe(false);
  });

  it("rejects unit family mismatch", () => {
    const r = scaleNutrition(facts, 100, "ml");
    expect(r.valid).toBe(false);
  });
});
