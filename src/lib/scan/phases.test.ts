import { describe, expect, it } from "vitest";
import { SCAN_FLOW, canTransition, isBusyPhase } from "@/lib/scan/machine";

describe("scan phases", () => {
  it("follows Idle → Uploading → Processing → Reviewing → Completed", () => {
    expect(SCAN_FLOW).toEqual(["idle", "uploading", "processing", "reviewing", "completed"]);
    expect(canTransition("idle", "uploading")).toBe(true);
    expect(canTransition("uploading", "processing")).toBe(true);
    expect(canTransition("processing", "reviewing")).toBe(true);
    expect(canTransition("reviewing", "completed")).toBe(true);
  });

  it("allows failure and retry without skipping the busy lock", () => {
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("failed", "uploading")).toBe(true);
    expect(canTransition("completed", "failed")).toBe(false);
    expect(isBusyPhase("processing")).toBe(true);
    expect(isBusyPhase("failed")).toBe(false);
  });
});
