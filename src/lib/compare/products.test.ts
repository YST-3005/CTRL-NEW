import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { compareNutrition } from "./products";

describe("compare nutrition", () => {
  it("keeps nulls instead of coercing to zero", () => {
    const a = SAMPLE_PRODUCTS[0];
    const b = {
      ...SAMPLE_PRODUCTS[1],
      nutrition: {
        ...SAMPLE_PRODUCTS[1].nutrition,
        values: SAMPLE_PRODUCTS[1].nutrition.values.filter((v) => v.nutrient !== "Dietary Fiber"),
      },
    };
    const row = compareNutrition(a, b).find((r) => r.nutrient === "Dietary Fiber");
    expect(row?.right).toBeNull();
    expect(row?.left).not.toBe(0);
  });
});
