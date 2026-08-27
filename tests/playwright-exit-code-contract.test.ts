import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * `scripts/run-playwright.mjs` propagates failure through its exit status.
 * Repository guidance said the opposite for a long time — that the wrapper
 * "exits 0 when tests fail and when it refuses to run" — which told callers to
 * discard a reliable signal and grep logs instead, losing the distinction
 * between *blocked* (retry later) and *red* (fix it).
 *
 * That wording was corrected in PR #2405 after automated review caught it in a
 * newly written document. Nothing pinned the exit codes, so the guidance had
 * been free to drift from the code for as long as it liked, and could drift
 * back. Ledger `#TBW7BR`.
 *
 * This test pins the behaviour the guidance describes. If the script's exit
 * contract legitimately changes, update the prose in the SAME change — that is
 * the point of the test, not an obstacle to it.
 */
const RUNNER = readFileSync("scripts/run-playwright.mjs", "utf8");

const DOCS_THAT_DESCRIBE_THE_CONTRACT = [
  "AGENTS.md",
  "docs/development-speed-playbook.md",
  "docs/ward-flow-phase-5-handover.md",
];

describe("run-playwright.mjs exit-code contract", () => {
  it("reserves a distinct exit code for admission contention", () => {
    expect(RUNNER).toMatch(/ADMISSION_BUSY_EXIT\s*=\s*75\b/);
  });

  it("emits a machine-readable marker alongside that code", () => {
    expect(RUNNER).toContain("DATABASE_HEAVY_RUN_ADMISSION_BUSY");
    expect(RUNNER).toMatch(/process\.exit\(ADMISSION_BUSY_EXIT\)/);
  });

  it("propagates Playwright's own exit status rather than swallowing it", () => {
    // The decisive line: the child's status becomes this process's status.
    expect(RUNNER).toMatch(/const exitCode = childProcessExitCode\(result\)/);
    expect(RUNNER).toMatch(/process\.exit\(exitCode\)/);
  });

  it("never hardcodes a success exit on the run path", () => {
    // `process.exit(0)` anywhere in this file would mean some path reports
    // success without reference to what actually happened.
    expect(RUNNER).not.toMatch(/process\.exit\(0\)/);
  });
});

describe("guidance describing that contract stays true to it", () => {
  it.each(DOCS_THAT_DESCRIBE_THE_CONTRACT)("%s does not assert the wrapper exits 0 on failure", (path) => {
    const text = readFileSync(path, "utf8");

    // A document is allowed - encouraged - to QUOTE the stale claim in order to
    // correct it, and two of these do exactly that. So the test forbids an
    // unrefuted assertion, not any mention. Each occurrence must sit near a
    // refutation; a bare restatement fails.
    const CLAIM = /exits 0 (?:both )?when tests fail/gi;
    const REFUTATION = /\b(not true|is not|incorrect|wrong|corrected|previously said|stale|no longer)\b/i;

    const unrefuted: string[] = [];
    for (const match of text.matchAll(CLAIM)) {
      const at = match.index ?? 0;
      const window = text.slice(Math.max(0, at - 400), at + 400);
      if (!REFUTATION.test(window)) unrefuted.push(text.slice(Math.max(0, at - 60), at + 60));
    }

    expect(
      unrefuted,
      `${path} states the stale claim without correcting it nearby:\n${unrefuted.join("\n---\n")}`,
    ).toEqual([]);
  });

  it("at least one document still tells the reader to check the status AND the output line", () => {
    // Guarding only against the wrong sentence would be satisfied by deleting
    // every sentence. The guidance has to still say the right thing.
    const playbook = readFileSync("docs/development-speed-playbook.md", "utf8");
    expect(playbook).toMatch(/75/);
    expect(playbook).toMatch(/N passed/);
  });
});
