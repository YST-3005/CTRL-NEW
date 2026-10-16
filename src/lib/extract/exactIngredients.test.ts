import { describe, it, expect } from "vitest";
import {
  extractIngredientList,
  splitIngredients,
  extractAllergenStatement,
  extractNutrition,
  buildProductFromOcr,
} from "@/lib/extract/label";

describe("Exact Ingredient & Label Extraction", () => {
  const chocolateLabelOcr = `
HERSHEY'S MILK CHOCOLATE WITH PEANUTS
Nutrition Facts
Serving size 1 bar (41g)
Calories 220
Total Fat 14g
Saturated Fat 6g
Sodium 35mg
Total Carbohydrate 22g
Total Sugars 19g
Protein 5g

INGREDIENTS: Milk Chocolate (Sugar, Milk, Chocolate, Cocoa Butter, Milk Fat, Lecithin (Soy), PGPR, Natural Flavor), Peanuts.
Contains: Milk, Soy, Peanuts.
Manufactured by The Hershey Company, Hershey, PA 17033
`;

  it("extracts exact ingredient list from chocolate label without truncating at sub-ingredients", () => {
    const list = extractIngredientList(chocolateLabelOcr);
    expect(list).toBeTruthy();
    expect(list).toContain("Milk Chocolate (Sugar, Milk, Chocolate, Cocoa Butter, Milk Fat, Lecithin (Soy), PGPR, Natural Flavor)");
    expect(list).toContain("Peanuts");
    expect(list).not.toContain("Manufactured by");
  });

  it("splits parenthetical compound ingredients correctly without splitting inside parentheses", () => {
    const rawList = "Milk Chocolate (Sugar, Cocoa Butter, Milk, Soy Lecithin, PGPR), Roasted Peanuts (Peanuts, Canola Oil, Salt), Sea Salt (0.5%)";
    const parts = splitIngredients(rawList);

    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("Milk Chocolate (Sugar, Cocoa Butter, Milk, Soy Lecithin, PGPR)");
    expect(parts[1]).toBe("Roasted Peanuts (Peanuts, Canola Oil, Salt)");
    expect(parts[2]).toBe("Sea Salt (0.5%)");
  });

  it("extracts declared allergen statement separately from ingredients", () => {
    const statement = extractAllergenStatement(chocolateLabelOcr);
    expect(statement).toBeDefined();
    expect(statement?.text).toContain("Contains: Milk, Soy, Peanuts");
    expect(statement?.allergens).toEqual(["milk", "soy", "peanuts"]);
  });

  it("extracts nutrition table with serving size, calories, and nutrient amounts", () => {
    const nutrition = extractNutrition(chocolateLabelOcr);
    expect(nutrition.servingSizeAmount).toBe(41);
    expect(nutrition.servingSizeUnit).toBe("g");
    expect(nutrition.incomplete).toBe(false);

    const calories = nutrition.values.find((v) => v.nutrient === "Calories");
    expect(calories?.amount).toBe(220);

    const fat = nutrition.values.find((v) => v.nutrient === "Total Fat");
    expect(fat?.amount).toBe(14);

    const sugars = nutrition.values.find((v) => v.nutrient === "Total Sugars");
    expect(sugars?.amount).toBe(19);

    const protein = nutrition.values.find((v) => v.nutrient === "Protein");
    expect(protein?.amount).toBe(5);
  });

  it("builds a high-completeness product from clear chocolate packaging OCR", () => {
    const product = buildProductFromOcr({
      ocrText: chocolateLabelOcr,
      confidence: 85,
    });

    expect(product.completeness).toBeGreaterThanOrEqual(70);
    expect(product.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(product.allergenStatement?.allergens).toContain("milk");
    expect(product.dietary.veganStatus).toBe("NON-VEGAN"); // milk detected
  });

  it("marks incomplete labels when ingredients or nutrition are missing", () => {
    const emptyOcr = "Random marketing blurb with no ingredients or nutrition table.";
    const product = buildProductFromOcr({
      ocrText: emptyOcr,
      confidence: 40,
    });

    expect(product.completeness).toBeLessThan(35);
    expect(product.dietary.veganStatus).toBe("UNKNOWN");
    expect(product.missingInformation.length).toBeGreaterThan(0);
  });
});
