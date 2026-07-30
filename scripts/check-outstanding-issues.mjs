#!/usr/bin/env node
/**
 * Keep docs/outstanding-issues.md machine-checkable after concurrent agent edits.
 *
 * Two agents allocating IDs in the same hour have already collided (see #112): the
 * next-id marker is a plain HTML comment, and without merge=union a content conflict
 * can be resolved by taking one side wholesale and silently dropping the other rows.
 * This gate turns that silent loss into a red verify/CI failure by requiring:
 *   - exactly one `<!-- issues:next-id=NNN -->` marker
 *   - every table row ID (`| #NNN |`) appears exactly once across open + resolved
 *   - the marker is strictly greater than the maximum allocated ID
 *   - merge=union is active on the file (same append-safe contract as the review ledger)
 *   - no conflict markers are committed
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ISSUES_PATH = "docs/outstanding-issues.md";
const ROW_ID = /^\| #(\d+) /;
const MARKER = /<!--\s*issues:next-id=(\d+)\s*-->/g;
const conflictMarker = /^(?:<{7}(?: .*)?|={7}|>{7}(?: .*)?)\r?$/gm;

export function validateOutstandingIssues({ markdown, mergeAttribute }) {
  const failures = [];
  const lines = markdown.split(/\r?\n/);

  if (mergeAttribute !== "union") {
    failures.push(`${ISSUES_PATH} must resolve to merge=union (found ${JSON.stringify(mergeAttribute || "unset")}).`);
  }

  const markers = [...markdown.matchAll(conflictMarker)];
  if (markers.length > 0) {
    failures.push(
      `conflict marker(s) found at ${ISSUES_PATH} line(s): ${markers
        .map((match) => markdown.slice(0, match.index).split(/\r?\n/).length)
        .join(", ")}.`,
    );
  }

  const markerMatches = [...markdown.matchAll(MARKER)];
  if (markerMatches.length !== 1) {
    failures.push(
      `${ISSUES_PATH} must contain exactly one <!-- issues:next-id=NNN --> marker (found ${markerMatches.length}).`,
    );
  }

  const ids = [];
  lines.forEach((line, index) => {
    const match = line.match(ROW_ID);
    if (!match) return;
    ids.push({ id: Number(match[1]), line: index + 1 });
  });

  const formatId = (id) => `#${String(id).padStart(3, "0")}`;
  const seen = new Map();
  for (const entry of ids) {
    const prior = seen.get(entry.id);
    if (prior !== undefined) {
      failures.push(`duplicate issue id ${formatId(entry.id)} at lines ${prior} and ${entry.line}.`);
    } else {
      seen.set(entry.id, entry.line);
    }
  }

  if (markerMatches.length === 1 && ids.length > 0) {
    const nextId = Number(markerMatches[0][1]);
    const maxId = Math.max(...ids.map((entry) => entry.id));
    if (!(Number.isInteger(nextId) && nextId > maxId)) {
      failures.push(
        `issues:next-id=${nextId} must be an integer strictly greater than the maximum allocated id ${formatId(maxId)}.`,
      );
    }
  } else if (markerMatches.length === 1 && ids.length === 0) {
    failures.push(`${ISSUES_PATH} has a next-id marker but no table row IDs.`);
  }

  return { failures, idCount: ids.length, nextId: markerMatches[0] ? Number(markerMatches[0][1]) : null };
}

function effectiveMergeAttribute() {
  const output = execFileSync("git", ["check-attr", "merge", "--", ISSUES_PATH], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return output.match(/:\s*merge:\s*(\S+)$/)?.[1] ?? "";
}

function assert(condition, label) {
  if (!condition) throw new Error(`self-test failed: ${label}`);
}

function selfTest() {
  const sample = [
    "# Ledger",
    "",
    "<!-- issues:next-id=3 -->",
    "",
    "## Open items",
    "",
    "| ID | Pri | Type | Summary | Detail | Source | Added |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| #001 | P2 | task | open one | detail | session | 2026-07-29 |",
    "",
    "## Resolved / archive",
    "",
    "| ID | Type | Summary | Outcome | Resolved |",
    "| --- | --- | --- | --- | --- |",
    "| #002 | issue | closed one | fixed | 2026-07-30 |",
    "",
  ].join("\n");

  const valid = { markdown: sample, mergeAttribute: "union" };
  assert(validateOutstandingIssues(valid).failures.length === 0, "valid ledger passes");
  assert(validateOutstandingIssues(valid).idCount === 2, "counts row ids");

  const fails = (input, needle, label) =>
    assert(
      validateOutstandingIssues({ ...valid, ...input }).failures.some((failure) => failure.includes(needle)),
      label,
    );

  fails({ mergeAttribute: "" }, "merge=union", "missing union attribute fails");
  fails({ markdown: `${sample}<<<<<<< ours\n` }, "conflict marker", "conflict marker fails");
  fails(
    {
      markdown: sample.replace("| #002 |", "| #001 |"),
    },
    "duplicate issue id #001",
    "duplicate id fails",
  );
  fails(
    {
      markdown: sample.replace("issues:next-id=3", "issues:next-id=2"),
    },
    "strictly greater",
    "stale marker fails",
  );
  fails(
    {
      markdown: `${sample}\n<!-- issues:next-id=4 -->\n`,
    },
    "exactly one",
    "duplicate marker fails",
  );
  assert(
    validateOutstandingIssues({
      markdown: [
        "# Ledger",
        "",
        "<!-- issues:next-id=3 -->",
        "",
        "Mentions PR #001 and issue #002 only in prose, not as table rows.",
        "",
      ].join("\n"),
      mergeAttribute: "union",
    }).failures.some((failure) => failure.includes("no table row IDs")),
    "prose PR numbers are not treated as row ids",
  );

  console.log("outstanding-issues self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const result = validateOutstandingIssues({
    markdown: readFileSync(path.join(root, ISSUES_PATH), "utf8"),
    mergeAttribute: effectiveMergeAttribute(),
  });

  if (result.failures.length > 0) {
    console.error("Outstanding-issues ledger guard failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Outstanding-issues ledger guard passed: ${result.idCount} table ids, next-id=${result.nextId}, union merge active, no duplicates or conflict markers.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
