import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { answerAboutProduct } from "./grounded";

describe("grounded chat", () => {
  it("answers added sugar from nutrition evidence", () => {
    const p = SAMPLE_PRODUCTS[0];
    const msg = answerAboutProduct("Does this product contain added sugar?", p);
    expect(msg.content).toMatch(/8/);
    expect(msg.sources.length).toBeGreaterThan(0);
  });

  it("admits unknown instead of inventing", () => {
    const msg = answerAboutProduct("Is this gluten-free certified?", SAMPLE_PRODUCTS[3]);
    expect(msg.unknown || /missing|only use this label|unknown/i.test(msg.content)).toBe(true);
  });
});
