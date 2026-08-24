import { describe, expect, it } from "vitest";
import {
  classifyPr,
  hasRequiredCiInFlight,
  repositoryNameWithOwner,
  validateApplyIdentity,
} from "../scripts/sync-open-pr-branches.mjs";

describe("sync-open-pr-branches classifyPr", () => {
  it("never updates a PR whose user-owned auto-merge is armed", () => {
    expect(classifyPr({ autoMergeRequest: { enabledAt: "2026-08-13T00:00:00Z" } }, 5)).toEqual({
      action: "skip",
      reason: "auto-merge-armed",
    });
  });

  it("skips every Run PR branch-mutation opt-out label", () => {
    expect(classifyPr({ title: "x", labels: [{ name: "hold" }] }, 3)).toEqual({
      action: "skip",
      reason: "label:hold",
    });
    expect(classifyPr({ title: "x", labels: [{ name: "skip-branch-sync" }] }, 3)).toEqual({
      action: "skip",
      reason: "label:skip-branch-sync",
    });
    expect(classifyPr({ title: "x", labels: [{ name: "skip-codex-review" }] }, 3)).toEqual({
      action: "skip",
      reason: "label:skip-codex-review",
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

  it("defers a behind branch while its required CI is queued or running", () => {
    expect(classifyPr({ title: "ready", labels: [], requiredCiInFlight: true }, 4)).toEqual({
      action: "skip",
      reason: "required-ci-in-flight",
    });
  });
});

describe("sync-open-pr-branches required CI state", () => {
  it("recognizes queued and in-progress CI runs only", () => {
    expect(hasRequiredCiInFlight({ workflow_runs: [{ name: "CI", status: "queued" }] })).toBe(true);
    expect(
      hasRequiredCiInFlight({ workflow_runs: [{ path: ".github/workflows/ci.yml", status: "in_progress" }] }),
    ).toBe(true);
    expect(hasRequiredCiInFlight({ workflow_runs: [{ name: "CI", status: "completed" }] })).toBe(false);
    expect(hasRequiredCiInFlight({ workflow_runs: [{ name: "SAST", status: "in_progress" }] })).toBe(false);
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
