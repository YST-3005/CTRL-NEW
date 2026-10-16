import { describe, expect, it } from "vitest";
import { SAMPLE_PRODUCTS } from "@/data/samples";
import { buildSimulatedAlert, canSimulateAlert } from "@/lib/notifications/simulate";

describe("caregiver simulation", () => {
  it("never reports delivered and requires opt-in plus contact", () => {
    expect(canSimulateAlert(false, { name: "Alex", channel: "email", address: "a@b.test" })).toBe(false);
    expect(canSimulateAlert(true, null)).toBe(false);
    expect(canSimulateAlert(true, { name: "Alex", channel: "email", address: "a@b.test" })).toBe(true);
    const alert = buildSimulatedAlert(SAMPLE_PRODUCTS[0], "allergen.conflict");
    expect(alert.status).toBe("simulated");
    expect(alert.simulated).toBe(true);
    expect(alert.preview).toMatch(/No message was sent/i);
    expect(alert.status).not.toBe("delivered");
  });
});
