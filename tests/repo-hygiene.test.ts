import { describe, expect, it } from "vitest";
import {
  computeParity,
  EXPECTED_GITHUB_SECRETS,
  EXPECTED_GITHUB_VARIABLES,
  EXPECTED_RAILWAY_APP_VARIABLES,
  EXPECTED_RAILWAY_SECRETS,
  EXPECTED_RAILWAY_WORKER_VARIABLES,
  githubListArgs,
  parseCiEnvNames,
  parseEnvExampleNames,
  parseEnvSchemaNames,
  railwayVariableArgs,
} from "../scripts/check-env-parity.mjs";
import { hasCompletedCleanupReview, parseLedgerBranches } from "../scripts/sweep-branch-ledger.mjs";
import { buildRow, findReviews, headMatches, parseLedgerRows, sanitizeCell } from "../scripts/branch-review-ledger.mjs";
import { validateLedger } from "../scripts/check-branch-review-ledger.mjs";

describe("check-env-parity name parsing", () => {
  it("extracts UPPER_SNAKE schema keys from env.ts-style text", () => {
    const text = [
      "const envSchema = z.object({",
      "  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),",
      "  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),",
      "  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().default(16000),",
      "  RAG_PERSIST_RAW_QUERY_TEXT: z",
      '    .enum(["true", "false"])',
      '    .default("false"),',
      "  notAKey: 3,",
      "});",
    ].join("\n");
    const names = parseEnvSchemaNames(text);
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names).toContain("OPENAI_MAX_OUTPUT_TOKENS");
    expect(names).toContain("RAG_PERSIST_RAW_QUERY_TEXT");
    expect(names).not.toContain("notAKey");
  });

  it("extracts names from check-ci-env quoted literals and process.env access", () => {
    const text = `const required = ["E2E_USER_EMAIL", "E2E_USER_PASSWORD"]; if (process.env.E2E_AUTH_ENABLED) {}`;
    const names = parseCiEnvNames(text);
    expect(names).toEqual(expect.arrayContaining(["E2E_USER_EMAIL", "E2E_USER_PASSWORD", "E2E_AUTH_ENABLED"]));
  });

  it("reports missing expected secrets and unknown live names", () => {
    const parity = computeParity({
      canonical: ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      liveNames: ["OPENAI_API_KEY", "LEFTOVER_OLD_KEY"],
      expectedSecrets: ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    });
    expect(parity.missingSecrets).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
    expect(parity.unknownLive).toEqual(["LEFTOVER_OLD_KEY"]);
  });

  it("extracts active and documented optional names from .env.example-style text", () => {
    const names = parseEnvExampleNames(
      ["OPENAI_API_KEY=replace-with-key", "#OPENAI_SAFETY_IDENTIFIER_SECRET=", "# explanation"].join("\n"),
    );
    expect(names).toEqual(["OPENAI_API_KEY", "OPENAI_SAFETY_IDENTIFIER_SECRET"]);
  });

  it("keeps CI-only E2E credentials out of Railway expectations", () => {
    expect(EXPECTED_GITHUB_SECRETS).toEqual(
      expect.arrayContaining(["E2E_USER_EMAIL", "E2E_USER_PASSWORD", "HEALTH_DEEP_PROBE_SECRET"]),
    );
    expect(EXPECTED_RAILWAY_SECRETS).toEqual(
      expect.arrayContaining([
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY",
        "OPENAI_SAFETY_IDENTIFIER_SECRET",
        "RAG_QUERY_HASH_SECRET",
        "HEALTH_DEEP_PROBE_SECRET",
      ]),
    );
    expect(EXPECTED_RAILWAY_SECRETS).not.toEqual(expect.arrayContaining(["E2E_USER_EMAIL", "E2E_USER_PASSWORD"]));
  });

  it("covers app, worker, and scheduled-health configuration separately", () => {
    expect(EXPECTED_RAILWAY_APP_VARIABLES).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_PROJECT_REF",
        "SUPABASE_PROJECT_NAME",
        "OPENAI_SAFETY_IDENTIFIER_SECRET",
      ]),
    );
    expect(EXPECTED_RAILWAY_WORKER_VARIABLES).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_PROJECT_REF",
        "SUPABASE_PROJECT_NAME",
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY",
      ]),
    );
    expect(EXPECTED_RAILWAY_WORKER_VARIABLES).not.toContain("HEALTH_DEEP_PROBE_SECRET");
    expect(EXPECTED_GITHUB_VARIABLES).toEqual(["PROD_HEALTH_URL"]);
  });

  it("pins GitHub and Railway reads to the intended repository and production services", () => {
    expect(githubListArgs("secret")).toEqual(
      expect.arrayContaining(["secret", "list", "--repo", "BigSimmo/Database", "--json", "name"]),
    );
    expect(railwayVariableArgs("Database")).toEqual(
      expect.arrayContaining([
        "--project",
        "5deaad0b-675a-4c13-978e-5ca2b5b877f9",
        "--environment",
        "6aa16f7b-d3e8-4aa2-9854-ee9ead9fcbd4",
        "--service",
        "Database",
      ]),
    );
    expect(railwayVariableArgs("worker")).toContain("worker");
  });
});

describe("sweep-branch-ledger parsing", () => {
  it("extracts claude/ and codex/ branch names from ledger markdown", () => {
    const md = [
      "| 2026-07-10 | codex/design-ux-review-fixes | abc | scope | out | checks |",
      "| 2026-07-11 | PR #487 / claude/answer-page-design-polish-ffd5a6 | def | s | o | c |",
    ].join("\n");
    const names = parseLedgerBranches(md);
    expect(names.has("codex/design-ux-review-fixes")).toBe(true);
    expect(names.has("claude/answer-page-design-polish-ffd5a6")).toBe(true);
  });

  it("extracts every branch namespace, not just claude/ and codex/", () => {
    const md = [
      "| 2026-07-14 | copilot/fix-failing-ci | a | branch-cleanup-deletion-pending | out | c |",
      "| 2026-07-14 | cursor/fix-pr654-ci-53b4 | b | branch-cleanup | out | c |",
      "| 2026-07-14 | fix/accessibility-remaining-findings | c | branch-cleanup | out | c |",
    ].join("\n");
    const names = parseLedgerBranches(md);
    expect(names.has("copilot/fix-failing-ci")).toBe(true);
    expect(names.has("cursor/fix-pr654-ci-53b4")).toBe(true);
    expect(names.has("fix/accessibility-remaining-findings")).toBe(true);
  });

  it("normalizes origin/* remote-tracking rows to the short name the sweep compares against", () => {
    const md = "| 2026-07-14 | origin/claude/codebase-index-coverage | a | branch-cleanup | out | c |";
    const names = parseLedgerBranches(md);
    // the sweep strips origin/ from live refs before ledgerBranches.has(short)
    expect(names.has("claude/codebase-index-coverage")).toBe(true);
    expect(names.has("origin/claude/codebase-index-coverage")).toBe(false);
  });
});

describe("hasCompletedCleanupReview", () => {
  it("matches an exact completed branch-cleanup review (name + HEAD + scope)", () => {
    const md = "| 2026-07-14 | copilot/fix | headsha | branch-cleanup | out | c |";
    expect(hasCompletedCleanupReview(md, "copilot/fix", "headsha")).toBe(true);
    // matches origin/-prefixed and "PR #N / " prefixed rows too
    const md2 = "| 2026-07-14 | PR #654 / origin/fix/a11y | h2 | branch-cleanup | out | c |";
    expect(hasCompletedCleanupReview(md2, "fix/a11y", "h2")).toBe(true);
  });

  it("does NOT treat a deletion-pending row as a completed review", () => {
    const md = "| 2026-07-14 | copilot/fix-yet-again | headsha | branch-cleanup-deletion-pending | out | c |";
    // scope differs, so the still-undeleted branch must be surfaced for retry
    expect(hasCompletedCleanupReview(md, "copilot/fix-yet-again", "headsha")).toBe(false);
  });

  it("does NOT match when the HEAD has moved since the review", () => {
    const md = "| 2026-07-14 | codex/foo | oldsha | branch-cleanup | out | c |";
    expect(hasCompletedCleanupReview(md, "codex/foo", "newsha")).toBe(false);
  });
});

describe("branch-review-ledger row parsing", () => {
  const row = (over: Record<string, string> = {}) => {
    const cells = {
      date: "2026-07-29",
      ref: "codex/thing",
      head: "a".repeat(40),
      scope: "diff review",
      outcome: "fine",
      checks: "npm run test",
      ...over,
    };
    return `| ${[cells.date, cells.ref, cells.head, cells.scope, cells.outcome, cells.checks].join(" | ")} |`;
  };

  it("keeps an escaped prose pipe inside one cell", () => {
    const [parsed] = parseLedgerRows(row({ outcome: String.raw`kept \| escaped` }));
    expect(parsed.cells).toHaveLength(6);
    expect(parsed.outcome).toBe(String.raw`kept \| escaped`);
    expect(parsed.checks).toBe("npm run test");
  });

  it("treats an abbreviated recorded HEAD as the same commit", () => {
    expect(headMatches("`bc5b51c2`", "bc5b51c2f0a9d3e4b5c6d7e8f9a0b1c2d3e4f5a6")).toBe(true);
    expect(headMatches("see PR head", "a".repeat(40))).toBe(false);
    expect(headMatches("bc5b51c2", "0123456789abcdef0123456789abcdef01234567")).toBe(false);
  });

  it("finds a prior review across origin/ and 'PR #N /' ref spellings", () => {
    const md = [row({ ref: "PR #1 / `codex/thing`" }), row({ ref: "origin/codex/other", head: "b".repeat(40) })].join(
      "\n",
    );
    expect(findReviews(md, { ref: "codex/thing", head: "a".repeat(40) }).atHead).toHaveLength(1);
    expect(findReviews(md, { ref: "codex/other", head: "b".repeat(40) }).atHead).toHaveLength(1);
  });

  it("separates records at a different HEAD so only the delta is re-reviewed", () => {
    const md = [row(), row({ head: "b".repeat(40), scope: "later pass" })].join("\n");
    const result = findReviews(md, { ref: "codex/thing", head: "b".repeat(40) });
    expect(result.atHead.map((r) => r.scope)).toEqual(["later pass"]);
    expect(result.otherHead).toHaveLength(1);
  });

  it("escapes pipes and collapses newlines when building a row", () => {
    expect(sanitizeCell("before | after\nnext line")).toBe(String.raw`before \| after next line`);
    const built = buildRow({
      date: "2026-07-29",
      ref: "codex/thing",
      head: "a".repeat(40),
      scope: "s",
      outcome: "a | b",
      checks: "c",
    });
    expect(parseLedgerRows(built)[0].cells).toHaveLength(6);
  });

  it("refuses a row whose HEAD no lookup could ever match", () => {
    const base = { date: "2026-07-29", ref: "x", scope: "s", outcome: "o", checks: "c" };
    expect(() => buildRow({ ...base, head: "see PR head" })).toThrow(/full 40-character SHA/);
    expect(() => buildRow({ ...base, head: "abc1234" })).toThrow(/full 40-character SHA/);
    expect(buildRow({ ...base, head: "n/a - branch never pushed" })).toContain("n/a - branch never pushed");
  });
});

describe("branch-review-ledger guard", () => {
  const valid = {
    ledger: ["This file is append-only.", `| 2026-07-29 | codex/x | ${"a".repeat(40)} | s | o | c |`, ""].join("\n"),
    mergeAttribute: "union",
    protocol: "The ledger is append-only: append corrections.",
  };

  it("accepts a well-formed ledger", () => {
    expect(validateLedger(valid).failures).toEqual([]);
  });

  it("rejects mojibake left by a non-UTF-8 append", () => {
    const ledger = valid.ledger.replace("| o |", "| restored ??? arc |");
    expect(validateLedger({ ...valid, ledger }).failures.join(" ")).toMatch(/mojibake/);
  });

  it("rejects a record that is not six cells", () => {
    const ledger = valid.ledger.replace("| s | o | c |", "| s | o has a | pipe | c |");
    expect(validateLedger({ ...valid, ledger }).failures.join(" ")).toMatch(/6 cells/);
  });

  it("rejects a record written as a dated heading inside the table", () => {
    const ledger = `${valid.ledger}\n## 2026-07-29 - a review\n`;
    expect(validateLedger({ ...valid, ledger }).failures.join(" ")).toMatch(/dated heading/);
  });

  it("rejects an unmatchable HEAD only for records under the machine-readable contract", () => {
    const strict = valid.ledger.replace("a".repeat(40), "see PR head");
    expect(validateLedger({ ...valid, ledger: strict }).failures.join(" ")).toMatch(/no lookup can match/);
    const legacy = strict.replace("2026-07-29", "2026-07-01");
    expect(validateLedger({ ...valid, ledger: legacy }).failures).toEqual([]);
  });
});
