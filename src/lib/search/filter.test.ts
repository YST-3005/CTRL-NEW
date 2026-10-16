import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { filterProducts } from "./filter";

describe("search", () => {
  it("filters by name", () => {
    const r = filterProducts(SAMPLE_PRODUCTS, { query: "whey", sort: "name" });
    expect(r.some((p) => /whey/i.test(p.name))).toBe(true);
    expect(r.every((p) => /whey|cocoa|orbit/i.test(`${p.name} ${p.brand}`))).toBe(true);
  });

  it("filters vegan status", () => {
    const r = filterProducts(SAMPLE_PRODUCTS, { query: "", vegan: "NON-VEGAN", sort: "name" });
    expect(r.every((p) => p.dietary.veganStatus === "NON-VEGAN")).toBe(true);
  });
});
