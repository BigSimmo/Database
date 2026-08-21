import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../scripts/check-outstanding-issues-snapshot.mjs";

const BASE = {
  version: "outstanding-issues-snapshot-v1",
  counts: { open: 2, p1: 1 },
  open: [{ id: "#1" }, { id: "#2" }],
};

describe("compareSnapshots", () => {
  it("reports no differences when in step", () => {
    expect(compareSnapshots(BASE, structuredClone(BASE))).toEqual([]);
  });

  it("detects a stale snapshot", () => {
    const stale = structuredClone(BASE);
    stale.counts.open = 1;
    stale.open = [{ id: "#1" }];
    expect(compareSnapshots(stale, BASE).join(" ")).toMatch(/open/);
  });

  it("detects a version change", () => {
    const old = { ...structuredClone(BASE), version: "outstanding-issues-snapshot-v0" };
    expect(compareSnapshots(old, BASE).join(" ")).toMatch(/version/);
  });
});
