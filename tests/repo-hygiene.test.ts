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
import {
  branchCoverageRefusal,
  fetchRefspecCoversAllBranches,
  hasCompletedCleanupReview,
  parseLedgerBranches,
  shallowCloneRefusal,
} from "../scripts/sweep-branch-ledger.mjs";
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

describe("shallowCloneRefusal", () => {
  /*
   * Ledger #109. Every signal the sweep reports comes from a merge-base, and a shallow
   * clone has a grafted root, so those numbers are wrong WITHOUT erroring. Measured
   * 2026-07-29 in a real `--depth 1` clone: the unguarded sweep exited 0 and named the
   * live checked-out branch as a deletion candidate with "no unique patch content". A
   * green exit recommending deletion of an active branch is the exact hazard here, so
   * the guard must refuse rather than degrade.
   */
  it("refuses on a shallow clone and names the remedy", () => {
    // The exact stdout of `git rev-parse --is-shallow-repository` in a shallow clone.
    const refusal = shallowCloneRefusal("true");
    expect(refusal).not.toBe("");
    // The operator must be told how to fix it, not merely that something is wrong.
    expect(refusal).toContain("git fetch --unshallow");
    // Cite the ledger item so the reason survives without this comment.
    expect(refusal).toContain("#109");
    // Name the specific signals that are untrustworthy, not just "unreliable".
    expect(refusal).toContain("merge-base");
  });

  it("stays silent ONLY on an explicit complete-history result", () => {
    // A full clone prints the STRING "false" — truthy. Coercing on truthiness rather than
    // on the exact value would refuse on every healthy repo, so this is the regression
    // that matters most in the safe direction.
    expect(shallowCloneRefusal("false")).toBe("");
  });

  it("refuses when the shallow state cannot be determined", () => {
    /*
     * `tryGit` swallows every error into "", so an unverifiable precondition is
     * indistinguishable from a healthy one unless it is treated as its own failure.
     * Proceeding here would emit merge-base-derived numbers while unable to establish that
     * the merge-bases are real — the #109 defect in a different guise. Both CodeRabbit and
     * Codex flagged this independently on PR #1392; an earlier revision of this test
     * asserted the opposite and was wrong.
     */
    for (const indeterminate of ["", "shallow", "yes"]) {
      expect(shallowCloneRefusal(indeterminate)).not.toBe("");
    }
    expect(shallowCloneRefusal(undefined)).not.toBe("");
  });

  it("distinguishes a known-shallow clone from an undeterminable one", () => {
    // The remedy differs: one needs --unshallow, the other needs a real git checkout.
    expect(shallowCloneRefusal("true")).toContain("SHALLOW clone");
    expect(shallowCloneRefusal("")).toContain("could not determine");
    expect(shallowCloneRefusal("true")).not.toBe(shallowCloneRefusal(""));
  });

  it("tolerates surrounding whitespace from git stdout in both directions", () => {
    expect(shallowCloneRefusal(" true\n")).not.toBe("");
    // A padded "false" must still be recognised as healthy, or every sweep refuses.
    expect(shallowCloneRefusal(" false\n")).toBe("");
  });
});

/*
 * Complete history is NOT complete branch coverage — the second way to get a confident wrong
 * answer, and it survives the shallow guard. `git clone --depth 1` implies `--single-branch`,
 * pinning `remote.origin.fetch` to one branch; `git fetch --unshallow` converts the history so
 * `--is-shallow-repository` reads `false`, but leaves the refspec narrow. Measured in a fixture
 * with `main` and `feature`: after unshallowing, `ls-remote` listed both while
 * `refs/remotes/origin` held only `origin/main`, and the sweep exited 0 with `"branches": []`.
 * Codex raised this on PR #1392 after the shallow fix landed.
 */
describe("branchCoverageRefusal", () => {
  it("treats a heads wildcard into refs/remotes/origin as covering every branch", () => {
    expect(fetchRefspecCoversAllBranches("+refs/heads/*:refs/remotes/origin/*")).toBe(true);
    // Unprefixed (non-forced) wildcards are still wildcards.
    expect(fetchRefspecCoversAllBranches("refs/heads/*:refs/remotes/origin/*")).toBe(true);
  });

  it("rejects a wildcard whose destination is not refs/remotes/origin", () => {
    /*
     * The source says which refs are fetched; `<dst>` says which local ref is updated, and the
     * sweep enumerates `refs/remotes/origin` and nothing else. An earlier revision of this test
     * asserted that a mirror's `+refs/*:refs/*` counted as covered — mine, and wrong in the
     * dangerous direction. Measured with `+refs/heads/*:refs/remotes/upstream/*`:
     * `refs/remotes/upstream` held `upstream/main` and `upstream/feature` while
     * `refs/remotes/origin` was empty and the sweep exited 0 with `"branches": []`.
     * Codex raised this on PR #1398.
     */
    expect(fetchRefspecCoversAllBranches("+refs/*:refs/*")).toBe(false);
    expect(fetchRefspecCoversAllBranches("+refs/heads/*:refs/remotes/upstream/*")).toBe(false);
    expect(branchCoverageRefusal("+refs/*:refs/*", false)).not.toBe("");
    // The sweep's own fetch writes into refs/remotes/origin explicitly, so it still repairs this.
    expect(branchCoverageRefusal("+refs/*:refs/*", true)).toBe("");
  });

  it("rejects a refs/* source even when the destination is refs/remotes/origin/*", () => {
    /*
     * Git substitutes the matched suffix into `<dst>`. Fetching `refs/heads/main` against
     * `+refs/*:refs/remotes/origin/*` therefore writes `refs/remotes/origin/heads/main`, not
     * `refs/remotes/origin/main`. Measured in a two-branch fixture: the sweep enumerated
     * `heads/main` and `heads/feature`, failed to resolve its `origin/main` comparison base,
     * swallowed both comparison failures as zeroes, and exited 0 marking both as deletion
     * candidates. An earlier revision of this suite asserted the opposite — that a `refs/*`
     * source counted as covered when the destination looked right. Codex raised this on PR #1398.
     */
    expect(fetchRefspecCoversAllBranches("+refs/*:refs/remotes/origin/*")).toBe(false);
    expect(branchCoverageRefusal("+refs/*:refs/remotes/origin/*", false)).not.toBe("");
    expect(branchCoverageRefusal("+refs/*:refs/remotes/origin/*", false)).toContain("refs/remotes/origin/heads/");
    // The sweep's own fetch still uses +refs/heads/*:…, so a completed fetch repairs this.
    expect(branchCoverageRefusal("+refs/*:refs/remotes/origin/*", true)).toBe("");
  });

  it("rejects the single-branch refspec that `git clone --depth 1` leaves behind", () => {
    expect(fetchRefspecCoversAllBranches("+refs/heads/main:refs/remotes/origin/main")).toBe(false);
    // Several narrow refspecs are still narrow: naming two branches does not cover the rest.
    expect(
      fetchRefspecCoversAllBranches(
        "+refs/heads/main:refs/remotes/origin/main\n+refs/heads/feature:refs/remotes/origin/feature",
      ),
    ).toBe(false);
    // `git config --get-all` exits 1 when the key is absent, which `tryGit` turns into "".
    expect(fetchRefspecCoversAllBranches("")).toBe(false);
    expect(fetchRefspecCoversAllBranches(undefined)).toBe(false);
  });

  it("treats a negative refspec as not covering every branch", () => {
    /*
     * A `^` exclusion sits alongside a wildcard and removes branches from it. Measured on git
     * 2.43.0 with `+refs/heads/*:refs/remotes/origin/*` plus `^refs/heads/feature`: an ordinary
     * `git fetch --prune origin` honoured the exclusion and left `origin/feature` absent, so
     * reading the wildcard alone and calling it covered would report a partial inventory as
     * complete. Codex raised this on PR #1392.
     */
    const excluded = "+refs/heads/*:refs/remotes/origin/*\n^refs/heads/feature";
    expect(fetchRefspecCoversAllBranches(excluded)).toBe(false);
    expect(branchCoverageRefusal(excluded, false)).not.toBe("");
    // But the sweep's explicit command-line wildcard OVERRIDES a configured exclusion — measured
    // in the same fixture, the ref came back — so a completed fetch still establishes coverage.
    expect(branchCoverageRefusal(excluded, true)).toBe("");
  });

  it("accepts a mixed config as long as one refspec is a wildcard", () => {
    const mixed = "+refs/heads/main:refs/remotes/origin/main\n+refs/heads/*:refs/remotes/origin/*";
    expect(fetchRefspecCoversAllBranches(mixed)).toBe(true);
    expect(branchCoverageRefusal(mixed, false)).toBe("");
  });

  it("stays silent when the configured refspec already covers every branch", () => {
    // The ordinary case for a normal clone: no fetch needed to establish coverage.
    expect(branchCoverageRefusal("+refs/heads/*:refs/remotes/origin/*", false)).toBe("");
  });

  it("stays silent when the sweep's own wildcard fetch completed", () => {
    // The sweep passes an explicit +refs/heads/*:refs/remotes/origin/* rather than relying on
    // the configured refspec, so a successful fetch establishes coverage even in a
    // single-branch clone — without rewriting the operator's config.
    expect(branchCoverageRefusal("+refs/heads/main:refs/remotes/origin/main", true)).toBe("");
  });

  it("refuses a narrow refspec when nothing established coverage", () => {
    // --no-fetch, offline, or a failed fetch. An empty inventory is NOT a safe failure here:
    // it reads as "nothing to clean up".
    const refusal = branchCoverageRefusal("+refs/heads/main:refs/remotes/origin/main", false);
    expect(refusal).not.toBe("");
    // Name the actual cause, so the operator does not go looking at the history again.
    expect(refusal).toContain("remote.origin.fetch");
    expect(refusal).toContain("--single-branch");
    // And give the remedy, not just the diagnosis.
    expect(refusal).toContain("git remote set-branches origin '*'");
  });

  it("is distinct from the shallow refusal, because the remedies differ", () => {
    const refusal = branchCoverageRefusal("", false);
    expect(refusal).not.toBe(shallowCloneRefusal("true"));
    // `--unshallow` fixes history and does nothing for the refspec, so it must not be the
    // prescribed command — it appears in the body only as the thing that does NOT fix this.
    // Sending the operator to `--unshallow` here means they re-run and get the same empty
    // inventory, now doubly convinced it is correct.
    const fixLine = refusal.split("\n").find((line) => line.startsWith("Fix:")) ?? "";
    expect(fixLine).toContain("git remote set-branches origin '*'");
    expect(fixLine).not.toContain("--unshallow");
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
    expect(headMatches("bc5b51c2 (squash)", "bc5b51c2f0a9d3e4b5c6d7e8f9a0b1c2d3e4f5a6")).toBe(true);
    expect(headMatches("see PR head", "a".repeat(40))).toBe(false);
    expect(headMatches("n/a - see deadbeef", `deadbeef${"0".repeat(32)}`)).toBe(false);
    expect(headMatches("bc5b51c2", "0123456789abcdef0123456789abcdef01234567")).toBe(false);
  });

  it("finds a prior review across origin/ and 'PR #N /' ref spellings", () => {
    const md = [row({ ref: "PR #1 / `codex/thing`" }), row({ ref: "origin/codex/other", head: "b".repeat(40) })].join(
      "\n",
    );
    expect(findReviews(md, { ref: "codex/thing", head: "a".repeat(40) }).atHead).toHaveLength(1);
    expect(findReviews(md, { ref: "codex/other", head: "b".repeat(40) }).atHead).toHaveLength(1);
  });

  it("requires an exact scope match so deletion-pending rows do not skip cleanup", () => {
    const md = row({ scope: "branch-cleanup-deletion-pending" });
    expect(findReviews(md, { ref: "codex/thing", head: "a".repeat(40), scope: "branch-cleanup" }).atHead).toHaveLength(
      0,
    );
    expect(
      findReviews(md, {
        ref: "codex/thing",
        head: "a".repeat(40),
        scope: "branch-cleanup-deletion-pending",
      }).atHead,
    ).toHaveLength(1);
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
