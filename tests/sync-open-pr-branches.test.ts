import { describe, expect, it } from "vitest";
import { classifyPr } from "../scripts/sync-open-pr-branches.mjs";

describe("sync-open-pr-branches classifyPr", () => {
  it("skips hold / do-not-merge / skip-branch-sync labels", () => {
    expect(classifyPr({ title: "x", labels: [{ name: "hold" }] }, 3)).toEqual({
      action: "skip",
      reason: "label:hold",
    });
    expect(classifyPr({ title: "x", labels: [{ name: "skip-branch-sync" }] }, 3)).toEqual({
      action: "skip",
      reason: "label:skip-branch-sync",
    });
  });

  it("skips WIP titles and fork heads", () => {
    expect(classifyPr({ title: "WIP: not yet", labels: [] }, 2)).toEqual({
      action: "skip",
      reason: "wip-title",
    });
    expect(classifyPr({ title: "ready", labels: [], isCrossRepository: true }, 2)).toEqual({
      action: "skip",
      reason: "fork-head",
    });
  });

  it("skips already-current branches and updates behind ones", () => {
    expect(classifyPr({ title: "ready", labels: [] }, 0)).toEqual({
      action: "skip",
      reason: "already-current",
    });
    expect(classifyPr({ title: "ready", labels: [] }, 12)).toEqual({
      action: "update",
      reason: "behind=12",
    });
  });
});
