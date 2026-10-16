import { describe, expect, it } from "vitest";
import { buildProductFromOcr, splitIngredients } from "./label";

const SAMPLE = `Helion Oats
INGREDIENTS: oats, honey, salt.
Contains: milk.
Serving size 40 g
Calories 160 Total Fat 2g Protein 5g Sodium 80mg Total Carbohydrate 30g Total Sugars 9g`;

describe("label extraction", () => {
  it("splits nested commas conservatively", () => {
    expect(splitIngredients("oats, sugar, salt").length).toBe(3);
  });

  it("extracts honey as non-vegan fact", () => {
    const p = buildProductFromOcr({ ocrText: SAMPLE, confidence: 80 });
    expect(p.ingredients.some((i) => i.veganStatus === "NON-VEGAN")).toBe(true);
    expect(p.extractedText).toContain("INGREDIENTS");
    expect(p.nutrition.values.find((v) => v.nutrient === "Calories")?.amount).toBe(160);
  });

  it("does not invent bounding boxes", () => {
    const p = buildProductFromOcr({ ocrText: SAMPLE, confidence: 40 });
    expect(p.ingredients.every((i) => !i.evidence[0]?.boundingBox)).toBe(true);
  });
});
