import { describe, expect, it } from "vitest";
import { classifyIngredientName, summarizeProductVegan } from "./classify";

describe("vegan classification", () => {
  it("classifies gelatin as NON-VEGAN", () => {
    expect(classifyIngredientName("gelatin", 0).veganStatus).toBe("NON-VEGAN");
  });

  it("keeps glycerin UNKNOWN", () => {
    expect(classifyIngredientName("glycerin", 0).veganStatus).toBe("UNKNOWN");
  });

  it("keeps vitamin D3 UNKNOWN", () => {
    expect(classifyIngredientName("vitamin D3", 0).veganStatus).toBe("UNKNOWN");
  });

  it("keeps magnesium stearate UNKNOWN", () => {
    expect(classifyIngredientName("magnesium stearate", 0).veganStatus).toBe("UNKNOWN");
  });

  it("does not call an incomplete plant-looking list vegan", () => {
    const ings = [classifyIngredientName("oats", 0), classifyIngredientName("salt", 1)];
    expect(summarizeProductVegan(ings, false).veganStatus).toBe("UNKNOWN");
  });
});
