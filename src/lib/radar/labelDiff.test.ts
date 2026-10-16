import { describe, expect, it } from "vitest";
import { LABEL_VERSION_DEMO } from "@/data/samples";
import { diffLabelVersions } from "./labelDiff";

describe("label radar", () => {
  it("detects honey added on demo v2", () => {
    const changes = diffLabelVersions(LABEL_VERSION_DEMO.older, LABEL_VERSION_DEMO.newer);
    expect(changes.some((c) => /honey/i.test(c.title))).toBe(true);
  });

  it("does not invent a change on identical records", () => {
    const changes = diffLabelVersions(LABEL_VERSION_DEMO.older, LABEL_VERSION_DEMO.older);
    expect(changes.every((c) => c.type === "completeness" || !c.supported || c.title.includes("No supported"))).toBe(true);
  });
});
