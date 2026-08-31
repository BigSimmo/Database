import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildIssuesReport,
  classifyAgentSafeWins,
  loadRevalidatedLedger,
  parseCliArgs,
} from "../scripts/issues-report.mjs";

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
      "| 2 | `#ABCDEF` | A2 | Standard | Next | 30 min | Offline guard |",
      "## Open items",
      "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
      "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
      "| #001 | P1 | task | urgent | detail | src | 2026-01-01 |",
      "| #ABCDEF <!-- issue-ulid:0000000000ABCDEF0000000000 --> | P2 | task | safe | detail | src | 2026-01-01 |",
      "## Resolved / archive",
      "| ID | Type | Summary | Outcome | Resolved |",
      "| ---- | ---- | ---- | ---- | ---- |",
      "| #004 | task | old | done | 2026-01-01 |",
    ].join("\n");
    const report = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true });
    expect(report.counts).toEqual({ open: 2, recommended: 2 });
    expect(report.priorityBlockers[0].ids).toEqual(["#001"]);
    expect(report.agentSafeWins.map((row: { ids: string[] }) => row.ids[0])).toEqual(["#ABCDEF"]);
    expect(report.open[1].id).toBe("#ABCDEF");
    expect(report.open[0].added).toBe("2026-01-01");
  });

  it("reports queue prose from the cited row's detail, so a stale queue cell cannot misdirect", () => {
    // The regression this pins: the queue Outcome cell and the row Detail cell
    // were independent copies of the same prose. They drifted, and because the
    // queue is what /issues and the SessionStart hook read back, the drifted
    // copy was the one acted on — for #231, the top clinical P1, the queue spent
    // days pointing at an approach that row had already recorded as refuted.
    const markdown = [
      "# Outstanding",
      "<!-- issues:next-id=5 -->",
      "## Recommended execution queue",
      "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |",
      "| ----: | ---- | ---- | ---- | ---- | ---- | ---- |",
      "| 1 | `#001` | A1 | Operator | Now | 1 hour | STALE: do the refuted thing |",
      "| 2 | `#002`, `#003` | A2 | Standard | Next | 30 min | composite stays as written |",
      "## Open items",
      "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
      "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
      "| #001 | P1 | task | urgent | CURRENT: that approach was refuted; do this instead | src | 2026-01-01 |",
      "| #002 | P2 | task | left | detail two | src | 2026-01-01 |",
      "| #003 | P2 | task | right | detail three | src | 2026-01-01 |",
      "## Resolved / archive",
      "| ID | Type | Summary | Outcome | Resolved |",
      "| ---- | ---- | ---- | ---- | ---- |",
      "| #004 | task | old | done | 2026-01-01 |",
    ].join("\n");
    const report = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true });

    type QueueRow = { ids: string[]; outcome: string; acuity: string; when: string };
    const solo = report.recommended.find((row: QueueRow) => row.ids[0] === "#001");
    expect(solo, "the #001 queue row must be reported").toBeDefined();
    expect(solo!.outcome).toBe("CURRENT: that approach was refuted; do this instead");
    expect(solo!.outcome).not.toContain("STALE");
    // The A1 blocker list is a separate projection and must carry the same text.
    expect(report.priorityBlockers[0].outcome).not.toContain("STALE");
    // Metadata that exists only on the queue row is still the queue's.
    expect(solo!.acuity).toBe("A1");
    expect(solo!.when).toBe("Now");

    // A composite row has no single row to speak for it, so it keeps its own text.
    const composite = report.recommended.find((row: QueueRow) => row.ids.length > 1);
    expect(composite, "the composite queue row must be reported").toBeDefined();
    expect(composite!.outcome).toBe("composite stays as written");
  });

  it("keeps queue-only safety gates when deriving displayed queue prose", () => {
    const markdown = [
      "# Outstanding",
      "<!-- issues:next-id=255 -->",
      "## Recommended execution queue",
      "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |",
      "| ----: | ---- | ---- | ---- | ---- | ---- | ---- |",
      "| 1 | \`#118\` | A3 | High — CI/visual/perf gates | Next | 2–4 hours | Commit CI-uploaded baselines. **Stop:** never commit developer-machine baselines. |",
      "| 2 | \`#253\` | A2 | High — phone results UI | Next | 15–30 min | Close #1606 as superseded. **Stop:** the decision is a human's; do not close automatically. |",
      "## Open items",
      "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
      "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
      "| #118 | P2 | task | visual baselines | Displayed #118 detail | src | 2026-01-01 |",
      "| #253 | P3 | task | hand-merge | Displayed #253 detail | src | 2026-01-01 |",
      "## Resolved / archive",
      "| ID | Type | Summary | Outcome | Resolved |",
      "| ---- | ---- | ---- | ---- | ---- |",
      "| #254 | task | old | done | 2026-01-01 |",
    ].join("\n");
    const report = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true });

    expect(report.recommended.map((row: { outcome: string }) => row.outcome)).toEqual([
      "Displayed #118 detail",
      "Displayed #253 detail",
    ]);
    expect(report.agentSafeWins.map((row: { ids: string[] }) => row.ids[0])).not.toContain("#118");
    expect(report.agentSafeWins.map((row: { ids: string[] }) => row.ids[0])).not.toContain("#253");
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
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("separates Ward Flow and core repository tasks with ward, core, and query filters", () => {
    const markdown = [
      "# Outstanding",
      "<!-- issues:next-id=10 -->",
      "## Recommended execution queue",
      "| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |",
      "| ----: | ---- | ---- | ---- | ---- | ---- | ---- |",
      "| 1 | `#001` | A2 | Standard | Next | 1 hour | Core repo task outcome |",
      "| 2 | `#002` | A3 | Standard | Next | 2 hours | Ward Flow: screen feature outcome |",
      "## Open items",
      "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
      "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
      "| #001 | P2 | task | Infrastructure fix | Core details | src | 2026-01-01 |",
      "| #002 | P3 | task | Ward Flow: role screens | Ward screen details | src | 2026-01-01 |",
      "| #003 | P3 | rec | Ward Flow: roadmap enhancement | Enhancement details | src | 2026-01-01 |",
      "## Resolved / archive",
      "| ID | Type | Summary | Outcome | Resolved |",
      "| ---- | ---- | ---- | ---- | ---- |",
      "| #004 | task | old | done | 2026-01-01 |",
    ].join("\n");

    const wardReport = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true }, { ward: true });
    expect(wardReport.counts).toEqual({ open: 2, recommended: 1 });
    expect(wardReport.open.map((r: { id: string }) => r.id)).toEqual(["#002", "#003"]);
    expect(wardReport.recommended.map((r: { ids: string[] }) => r.ids[0])).toEqual(["#002"]);

    const coreReport = buildIssuesReport(markdown, { ref: "origin/main", revalidated: true }, { core: true });
    expect(coreReport.counts).toEqual({ open: 1, recommended: 1 });
    expect(coreReport.open.map((r: { id: string }) => r.id)).toEqual(["#001"]);
    expect(coreReport.recommended.map((r: { ids: string[] }) => r.ids[0])).toEqual(["#001"]);

    const queryReport = buildIssuesReport(
      markdown,
      { ref: "origin/main", revalidated: true },
      { filter: "enhancement" },
    );
    expect(queryReport.counts).toEqual({ open: 1, recommended: 0 });
    expect(queryReport.open[0].id).toBe("#003");
  });

  it("validates CLI argument parsing and rejects malformed or missing --filter values", () => {
    expect(parseCliArgs(["--json", "--ward"])).toEqual({
      json: true,
      winsOnly: false,
      ward: true,
      core: false,
      filter: undefined,
    });

    expect(parseCliArgs(["--core", "--agent-safe-wins"])).toEqual({
      json: false,
      winsOnly: true,
      ward: false,
      core: true,
      filter: undefined,
    });

    expect(parseCliArgs(["--filter", "myterm", "--json"])).toEqual({
      json: true,
      winsOnly: false,
      ward: false,
      core: false,
      filter: "myterm",
    });

    expect(parseCliArgs(["--filter=myterm"])).toEqual({
      json: false,
      winsOnly: false,
      ward: false,
      core: false,
      filter: "myterm",
    });

    expect(() => parseCliArgs(["--filter", "--json"])).toThrow("Option '--filter' requires a non-empty value");
    expect(() => parseCliArgs(["--filter"])).toThrow("Option '--filter' requires a non-empty value");
    expect(() => parseCliArgs(["--filter="])).toThrow("Option '--filter' requires a non-empty value");
    expect(() => parseCliArgs(["--ward", "--core"])).toThrow("Cannot specify both --ward and --core");
    expect(() => parseCliArgs(["--unknown"])).toThrow("Unknown option: --unknown");
  });
});
