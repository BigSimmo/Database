import { describe, expect, it } from "vitest";
import {
  computeParity,
  EXPECTED_GITHUB_VARIABLES,
  EXPECTED_GITHUB_SECRETS,
  EXPECTED_RAILWAY_APP_VARIABLES,
  EXPECTED_RAILWAY_SECRETS,
  EXPECTED_RAILWAY_WORKER_VARIABLES,
  parseCiEnvNames,
  parseEnvExampleNames,
  parseEnvFilePresence,
  parseEnvSchemaNames,
  presenceRows,
  railwayVariableArgs,
} from "../scripts/check-env-parity.mjs";
import { hasCompletedCleanupReview, parseLedgerBranches } from "../scripts/sweep-branch-ledger.mjs";

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

  it("extracts active and documented optional names from .env.example-style text", () => {
    const names = parseEnvExampleNames(
      ["OPENAI_API_KEY=replace-with-key", "#OPENAI_SAFETY_IDENTIFIER_SECRET=", "# explanation"].join("\n"),
    );
    expect(names).toEqual(["OPENAI_API_KEY", "OPENAI_SAFETY_IDENTIFIER_SECRET"]);
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

  it("covers hosted project identity, runtime privacy, and scheduled health config", () => {
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
    expect(EXPECTED_GITHUB_VARIABLES).toContain("PROD_HEALTH_URL");
  });

  it("reduces process and env-file values to PRESENT/MISSING without retaining values", () => {
    const secretSentinel = "do-not-include-this-value-in-the-report";
    const processReport = presenceRows(
      {
        OPENAI_API_KEY: secretSentinel,
        RAG_QUERY_HASH_SECRET: "replace-with-query-hash-secret",
      },
      ["OPENAI_API_KEY", "RAG_QUERY_HASH_SECRET"],
    );
    const fileReport = parseEnvFilePresence(`OPENAI_API_KEY=${secretSentinel}\nRAG_QUERY_HASH_SECRET=\n`, [
      "OPENAI_API_KEY",
      "RAG_QUERY_HASH_SECRET",
    ]);

    expect(processReport).toEqual([
      { name: "OPENAI_API_KEY", status: "PRESENT" },
      { name: "RAG_QUERY_HASH_SECRET", status: "MISSING" },
    ]);
    expect(fileReport).toEqual([
      { name: "OPENAI_API_KEY", status: "PRESENT" },
      { name: "RAG_QUERY_HASH_SECRET", status: "MISSING" },
    ]);
    expect(JSON.stringify({ processReport, fileReport })).not.toContain(secretSentinel);
  });

  it("pins Railway reads to the production project, environment, and named service", () => {
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
