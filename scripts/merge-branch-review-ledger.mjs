#!/usr/bin/env node
/**
 * Git merge driver for docs/branch-review-ledger.md.
 *
 * Stock `merge=union` keeps concurrent appends, but when the same babysit row already
 * exists on both tips it also keeps a byte-identical twin — which then fails
 * `check:branch-review-ledger` and forces a ledger-hygiene follow-up commit on every
 * open PR that syncs main. This driver unions both sides and drops exact duplicate
 * dated records (the ledger contract has always allowed that).
 *
 * Installed by `scripts/install-git-hooks.mjs` as `merge.ledger.driver`.
 * Git invokes: node scripts/merge-branch-review-ledger.mjs %O %A %B
 *   %O = ancestor, %A = ours (write result here), %B = theirs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dedupeLedgerMarkdown, mergeLedgerMarkdown, RECORD_START } from "./branch-review-ledger.mjs";

function assert(condition, label) {
  if (!condition) throw new Error(`self-test failed: ${label}`);
}

function selfTest() {
  const preamble = [
    "# Branch Review Ledger",
    "",
    "This file is append-only.",
    "",
    "| Date | Branch or ref | Reviewed HEAD | Scope | Outcome | Checks |",
    "| --- | --- | --- | --- | --- | --- |",
  ].join("\n");
  const row = (head, scope = "s") => `| 2026-07-30 | codex/x | ${head} | ${scope} | o | c |`;
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  const c = "c".repeat(40);

  const ours = `${preamble}\n${row(a)}\n${row(b)}\n`;
  const theirs = `${preamble}\n${row(a)}\n${row(c)}\n`;
  const merged = mergeLedgerMarkdown(ours, theirs);
  assert(merged.recordCount === 3, "keeps three distinct rows");
  assert(merged.markdown.includes(row(a)), "keeps shared row once");
  assert(merged.markdown.includes(row(b)), "keeps ours-only row");
  assert(merged.markdown.includes(row(c)), "keeps theirs-only row");
  assert((merged.markdown.match(new RegExp(RECORD_START.source, "gm")) || []).length === 3, "no duplicate records");

  const duped = `${preamble}\n${row(a)}\n${row(a)}\n${row(b)}\n`;
  const deduped = dedupeLedgerMarkdown(duped);
  assert(deduped.removed === 1, "dedupe removes one exact twin");
  assert(deduped.kept === 2, "dedupe keeps two unique records");

  console.log("merge-branch-review-ledger self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const [, , basePath, oursPath, theirsPath] = process.argv;
  if (!oursPath || !theirsPath) {
    console.error("usage: merge-branch-review-ledger.mjs <base> <ours> <theirs>");
    console.error("       merge-branch-review-ledger.mjs --self-test");
    process.exit(2);
  }

  // Ancestor is unused for content: append-only union+dedupe only needs both tips.
  void basePath;
  const ours = readFileSync(oursPath, "utf8");
  const theirs = readFileSync(theirsPath, "utf8");
  const { markdown } = mergeLedgerMarkdown(ours, theirs);
  writeFileSync(oursPath, markdown, "utf8");
  process.exit(0);
}

const isMain =
  process.argv[1]?.endsWith("/merge-branch-review-ledger.mjs") ||
  process.argv[1]?.endsWith("\\merge-branch-review-ledger.mjs");
if (isMain) main();
