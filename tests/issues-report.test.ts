import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildIssuesReport, classifyAgentSafeWins, loadRevalidatedLedger } from "../scripts/issues-report.mjs";

const queueRows = [
  {
    order: 1,
    ids: ["#001"],
    acuity: "A1",
    capability: "Operator security",
    when: "Now",
    estimate: "1–2 hours",
    outcome: "Rotate a live provider key.",
  },
  {
    order: 2,
    ids: ["#002"],
    acuity: "A2",
    capability: "High — process",
    when: "Next",
    estimate: "30–60 min",
    outcome: "Add an offline guard.",
  },
  {
    order: 3,
    ids: ["#003"],
    acuity: "A3",
    capability: "High — frontend",
    when: "After owner decision",
    estimate: "2–4 hours",
    outcome: "Implement after human decision.",
  },
  {
    order: 4,
    ids: ["#004"],
    acuity: "A3",
    capability: "Standard",
    when: "Next",
    estimate: "0.5–1 day",
    outcome: "Refactor locally.",
  },
];

describe("issues report", () => {
  it("classifies only bounded provider-free, decision-free wins without changing acuity", () => {
    const wins = classifyAgentSafeWins(queueRows);
    expect(wins.map((row: { ids: string[] }) => row.ids[0])).toEqual(["#002"]);
    expect(queueRows[0].acuity).toBe("A1");
  });

  it("excludes human-only rows (design-owner review, do-not-close, human-decision phrases)", () => {
    const humanOnlyRows = [
      {
        order: 1,
        ids: ["#010"],
        acuity: "A3",
        capability: "High — frontend",
        when: "After design-owner review",
        estimate: "2 hours",
        outcome: "Implement after design-owner review.",
      },
      {
        order: 2,
        ids: ["#011"],
        acuity: "A3",
        capability: "Standard",
        when: "Next",
        estimate: "1 hour",
        outcome: "The decision is a human's; do not close automatically.",
      },
      {
        order: 3,
        ids: ["#012"],
        acuity: "A3",
        capability: "Standard",
        when: "Next",
        estimate: "30 min",
        outcome: "Safe offline task.",
      },
    ];
    const wins = classifyAgentSafeWins(humanOnlyRows);
    expect(wins.map((row: { ids: string[] }) => row.ids[0])).toEqual(["#012"]);
  });

  it("excludes hosted-CI uploads and human-review gates from agent-safe wins", () => {
    const gatedRows = [
      {
        order: 1,
        ids: ["#118"],
        acuity: "A3",
        capability: "High — CI/visual/perf gates",
        when: "Next",
        estimate: "2–4 hours",
        outcome: "Commit the CI-uploaded visual baselines.",
      },
      {
        order: 2,
        ids: ["#242"],
        acuity: "A2",
        capability: "High — design-system baselines",
        when: "After human review of Linux baselines",
        estimate: "1–2 hours",
        outcome: "Commit approved Linux visual baselines.",
      },
    ];

    expect(classifyAgentSafeWins(gatedRows)).toEqual([]);
  });

  it("builds machine-readable counts and preserves the A1 blocker separately", () => {
    const markdown = [
      "# Outstanding",
      "<!-- issues:next-id=5 -->",
      "## Recommended execution queue",
      "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |",
      "| ----: | ---- | ---- | ---- | ---- | ---- | ---- |",
      "| 1 | `#001` | A1 | Operator | Now | 1 hour | Live action |",
      "| 2 | `#002` | A2 | Standard | Next | 30 min | Offline guard |",
      "## Open items",
      "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
      "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
      "| #001 | P1 | task | urgent | detail | src | 2026-01-01 |",
      "| #002 | P2 | task | safe | detail | src | 2026-01-01 |",
      "## Resolved / archive",
      "| ID | Type | Summary | Outcome | Resolved |",
      "| ---- | ---- | ---- | ---- | ---- |",
      "| #004 | task | old | done | 2026-01-01 |",
    ].join("\n");
    const report = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true });
    expect(report.counts).toEqual({ open: 2, recommended: 2 });
    expect(report.priorityBlockers[0].ids).toEqual(["#001"]);
    expect(report.agentSafeWins.map((row: { ids: string[] }) => row.ids[0])).toEqual(["#002"]);
    expect(report.open[0].added).toBe("2026-01-01");
  });

  it("labels a readable origin/main ref as cached rather than remotely revalidated", () => {
    const directory = mkdtempSync(join(tmpdir(), "issues-report-"));
    try {
      execFileSync("git", ["init", "--quiet"], { cwd: directory });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: directory });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: directory });
      mkdirSync(join(directory, "docs"));
      writeFileSync(join(directory, "docs", "outstanding-issues.md"), "# Cached ledger\n");
      execFileSync("git", ["add", "docs/outstanding-issues.md"], { cwd: directory });
      execFileSync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: directory });
      execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: directory });

      const { markdown, source } = loadRevalidatedLedger(directory);
      expect(markdown).toBe("# Cached ledger");
      expect(source).toMatchObject({ ref: "origin/main (cached)", revalidated: false });
      expect(source.warning).toContain("local remote-tracking ref");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
