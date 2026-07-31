import { describe, expect, it } from "vitest";
import { validatePullRequestSnapshot } from "../scripts/final-merge-audit.mjs";

const greenSnapshot = {
  state: "OPEN",
  isDraft: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  title: "Improve phone chrome verification",
  headRefOid: "abc123",
  labels: [],
  statusCheckRollup: [{ name: "PR required", conclusion: "SUCCESS" }],
};

describe("validatePullRequestSnapshot", () => {
  it("accepts a settled, unlabelled PR at the expected head", () => {
    expect(validatePullRequestSnapshot(greenSnapshot, { expectedHead: "abc123" }).failures).toEqual([]);
  });

  it("fails closed on head drift, required-check failure, and a hold label", () => {
    const result = validatePullRequestSnapshot(
      {
        ...greenSnapshot,
        headRefOid: "changed",
        labels: [{ name: "hold" }],
        statusCheckRollup: [{ name: "pr-required", conclusion: "FAILURE" }],
      },
      { expectedHead: "abc123" },
    );
    expect(result.failures.join(" ")).toContain("does not match expected head");
    expect(result.failures.join(" ")).toContain("not settled successfully");
    expect(result.failures.join(" ")).toContain("blocking label");
  });

  it("fails closed while GitHub mergeability or merge state is unsettled", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      mergeable: "UNKNOWN",
      mergeStateStatus: "BEHIND",
    });
    expect(result.failures.join(" ")).toContain("expected MERGEABLE");
    expect(result.failures.join(" ")).toContain("expected CLEAN");
  });

  it("fails closed when the required aggregate check is absent", () => {
    const result = validatePullRequestSnapshot({ ...greenSnapshot, statusCheckRollup: [] });
    expect(result.failures).toContain("required check(s) missing: pr-required");
  });

  it("accepts GitHub's workflow-qualified required-check context", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [{ context: "CI / PR required", state: "SUCCESS" }],
    });
    expect(result.failures).toEqual([]);
  });

  it("does not let a failed advisory check block a successful required aggregate", () => {
    const result = validatePullRequestSnapshot({
      ...greenSnapshot,
      statusCheckRollup: [
        { name: "PR required", conclusion: "SUCCESS" },
        { name: "Advisory UI", conclusion: "FAILURE" },
      ],
    });
    expect(result.failures).toEqual([]);
    expect(result.unsettledChecks).toEqual([]);
  });

  it("uses merged-state semantics for post-merge tree and health audits", () => {
    expect(
      validatePullRequestSnapshot({ ...greenSnapshot, state: "MERGED" }, { expectedHead: "abc123", postMerge: true })
        .failures,
    ).toEqual([]);
  });
});
