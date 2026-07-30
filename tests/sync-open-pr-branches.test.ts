import { describe, expect, it } from "vitest";
import {
  classifyPr,
  inFlightRunNames,
  repositoryNameWithOwner,
  validateApplyIdentity,
} from "../scripts/sync-open-pr-branches.mjs";

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

  it("does not update a behind branch while exact-head CI is queued or running", () => {
    expect(
      classifyPr({ title: "ready", labels: [] }, 3, [
        { name: "Secret Scan", status: "completed", conclusion: "success" },
        { name: "CI", status: "in_progress", conclusion: "" },
        { name: "PR Policy", status: "queued", conclusion: "" },
      ]),
    ).toEqual({
      action: "skip",
      reason: "ci-in-flight:CI,PR Policy",
    });

    expect(inFlightRunNames([{ name: "CI", status: "completed", conclusion: "failure" }])).toEqual([]);
  });
});

describe("sync-open-pr-branches apply identity", () => {
  it("accepts an authenticated human/operator identity", () => {
    expect(validateApplyIdentity({ login: "BigSimmo" })).toBe("BigSimmo");
  });

  it("fails closed for missing and bot identities", () => {
    expect(() => validateApplyIdentity(undefined)).toThrow(/human\/operator/);
    expect(() => validateApplyIdentity({ login: "github-actions[bot]" })).toThrow(/human\/operator/);
    expect(() => validateApplyIdentity({ login: "dependabot[bot]" })).toThrow(/human\/operator/);
  });
});

describe("sync-open-pr-branches repository identity", () => {
  it("extracts the structured gh repository response", () => {
    expect(repositoryNameWithOwner({ nameWithOwner: "BigSimmo/Database" })).toBe("BigSimmo/Database");
  });

  it("rejects missing or malformed repository identity", () => {
    expect(() => repositoryNameWithOwner(undefined)).toThrow(/nameWithOwner/);
    expect(() => repositoryNameWithOwner({ nameWithOwner: "Database" })).toThrow(/nameWithOwner/);
  });
});
