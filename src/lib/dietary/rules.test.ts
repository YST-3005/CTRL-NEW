import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { evaluateDietaryRules } from "./rules";
import { DEFAULT_PREFERENCES } from "@/types";

describe("dietary rules", () => {
  it("alerts peanuts on the peanut bar", () => {
    const bar = SAMPLE_PRODUCTS.find((p) => p.id === "sample-peanut-vector")!;
    const findings = evaluateDietaryRules(bar, DEFAULT_PREFERENCES);
    expect(findings.some((f) => /peanut/i.test(f.title))).toBe(true);
  });

  it("updates when vegan preference enabled", () => {
    const whey = SAMPLE_PRODUCTS.find((p) => p.id === "sample-nova-whey")!;
    const off = evaluateDietaryRules(whey, { ...DEFAULT_PREFERENCES, vegan: false });
    const on = evaluateDietaryRules(whey, { ...DEFAULT_PREFERENCES, vegan: true });
    expect(on.some((f) => f.id === "vegan-conflict")).toBe(true);
    expect(off.some((f) => f.id === "vegan-conflict")).toBe(false);
  });
});
