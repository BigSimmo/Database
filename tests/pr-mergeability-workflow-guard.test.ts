import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { checkPrMergeabilityWorkflow } from "../scripts/check-pr-mergeability-workflow.mjs";

/**
 * The merge-queue half of the PR mergeability contract. If "PR mergeability" is a required check,
 * it must report on merge_group runs or every queue entry waits forever. These cases prove the
 * guard requires a real pass-through and cannot be satisfied by a job that skips on merge_group.
 */
const workflow = readFileSync(new URL("../.github/workflows/pr-mergeability.yml", import.meta.url), "utf8");
const check = (text: string): string[] => checkPrMergeabilityWorkflow(text);

function mutate(from: string, to: string) {
  expect(workflow).toContain(from);
  return workflow.replace(from, to);
}

describe("PR mergeability workflow guard: merge queue", () => {
  it("accepts the committed workflow", () => {
    expect(check(workflow)).toEqual([]);
  });

  it("requires the merge_group trigger", () => {
    const failures = check(mutate("\n  merge_group:\n", "\n"));
    expect(failures.join("\n")).toMatch(/must trigger on merge_group/);
  });

  it("rejects a mergeability job that skips on merge_group", () => {
    const failures = check(
      mutate(
        "    if: github.event_name == 'pull_request_target' || github.event_name == 'merge_group'\n",
        "    if: github.event_name == 'pull_request_target'\n",
      ),
    );
    expect(failures.join("\n")).toMatch(/must run for pull_request_target and merge_group only/);
  });

  it("rejects a skipped duplicate job carrying the same check name", () => {
    const failures = check(
      workflow.replace(
        "\n  refresh-after-base-push:\n",
        "\n  mergeability-queue:\n    name: PR mergeability\n    if: github.event_name == 'merge_group'\n    runs-on: ubuntu-24.04\n    steps:\n      - run: true\n\n  refresh-after-base-push:\n",
      ),
    );
    expect(failures.join("\n")).toMatch(/exactly one job named "PR mergeability"/);
  });

  it("requires the pass-through step and keeps it limited to merge_group", () => {
    expect(check(mutate("- name: Accept merge queue entry", "- name: Something else")).join("\n")).toMatch(
      /missing the merge_group pass-through step/,
    );
    expect(
      check(
        mutate(
          "      - name: Accept merge queue entry\n        if: github.event_name == 'merge_group'\n",
          "      - name: Accept merge queue entry\n",
        ),
      ).join("\n"),
    ).toMatch(/pass-through step must run only for merge_group/);
  });

  it("rejects a pass-through that checks out or runs actions", () => {
    const failures = check(
      mutate(
        "        if: github.event_name == 'merge_group'\n        run:",
        "        if: github.event_name == 'merge_group'\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n        run:",
      ),
    );
    expect(failures.join("\n")).toMatch(/must not check out, call actions/);
  });

  it("keeps the classifier checkout and API call off merge_group runs", () => {
    const checkoutUnguarded = check(
      mutate(
        "      - name: Checkout trusted classifier\n        if: github.event_name == 'pull_request_target'\n",
        "      - name: Checkout trusted classifier\n",
      ),
    );
    expect(checkoutUnguarded.join("\n")).toMatch(/checkout must run only for pull_request_target/);

    const signalUnguarded = check(
      mutate(
        "      - name: Signal real merge conflicts\n        if: github.event_name == 'pull_request_target'\n",
        "      - name: Signal real merge conflicts\n",
      ),
    );
    expect(signalUnguarded.join("\n")).toMatch(/signal step must run only for pull_request_target/);
  });
});
