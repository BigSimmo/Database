import { describe, expect, it } from "vitest";
import {
  computeParity,
  EXPECTED_GITHUB_SECRETS,
  EXPECTED_RAILWAY_SECRETS,
  parseCiEnvNames,
  parseEnvSchemaNames,
  parseRailwayVariableNames,
} from "../scripts/check-env-parity.mjs";
import { hasCompletedCleanupReview, parseLedgerBranches } from "../scripts/sweep-branch-ledger.mjs";

describe("check-env-parity name parsing", () => {
  it("extracts UPPER_SNAKE schema keys from env.ts-style text", () => {
    const text = [
      "const envSchema = z.object({",
      "  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),",
      "  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),",
      "  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().default(16000),",
      "  notAKey: 3,",
      "});",
    ].join("\n");
    const names = parseEnvSchemaNames(text);
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names).toContain("OPENAI_MAX_OUTPUT_TOKENS");
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

  it("keeps CI-only E2E credentials out of Railway expectations", () => {
    expect(EXPECTED_GITHUB_SECRETS).toEqual(
      expect.arrayContaining(["E2E_USER_EMAIL", "E2E_USER_PASSWORD", "HEALTH_DEEP_PROBE_SECRET"]),
    );
    expect(EXPECTED_RAILWAY_SECRETS).toEqual(
      expect.arrayContaining([
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY",
        "RAG_QUERY_HASH_SECRET",
        "HEALTH_DEEP_PROBE_SECRET",
      ]),
    );
    expect(EXPECTED_RAILWAY_SECRETS).not.toEqual(expect.arrayContaining(["E2E_USER_EMAIL", "E2E_USER_PASSWORD"]));
  });

  it("extracts Railway JSON names without treating values as names", () => {
    expect(
      parseRailwayVariableNames(
        JSON.stringify({ OPENAI_API_KEY: "secret-with-UPPERCASE-fragments", RAG_PROVIDER_MODE: "offline" }),
      ),
    ).toEqual(["OPENAI_API_KEY", "RAG_PROVIDER_MODE"]);
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
