#!/usr/bin/env node
// check-design-drift-ratchet — ratchet guard for two design-token drift metrics.
//
// docs/design-system/drift-measurement-2026-09-02.md audited two unmeasured drifts away
// from the shared design-token contract for the first time:
//   1. Inline `style={{ }}` attributes under src/** — 232 at measurement time, most of
//      them legitimate (computed/dynamic values with no token category), some of them
//      bypasses (a literal that duplicates or should use an existing token).
//   2. Registered design-system components with zero product importers — 16 of 55 at
//      measurement time (docs/design-system/adoption-manifest.json).
//
// Neither number had ever been counted before, so neither had ever been able to grow
// silently. This is not a migration gate — it does not require either number to go down,
// and it does not block on individual BYPASS classifications (converting those is tracked
// separately; see the ranked list in the measurement doc). It is a ratchet: the ceiling in
// docs/design-system/drift-ratchet.json is the ceiling that a normal `npm run
// check:design-drift-ratchet` run can never move upward. Only `--update --allow-increase`
// can raise it, and that combination prints the before/after ceiling so it shows up in
// review — an accidental regression can lower the count back down and pass silently, but
// it cannot raise the ceiling to hide a regression without that showing in the diff of
// drift-ratchet.json itself.
//
// Usage:
//   node scripts/check-design-drift-ratchet.mjs                        report + fail on growth (exit 1)
//   node scripts/check-design-drift-ratchet.mjs --update                lower/match ceilings to current counts
//   node scripts/check-design-drift-ratchet.mjs --update --allow-increase   also allow raising a ceiling
//   node scripts/check-design-drift-ratchet.mjs --json                 machine-readable report on stdout

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const RATCHET_PATH = `${ROOT}docs/design-system/drift-ratchet.json`;
const MANIFEST_PATH = `${ROOT}docs/design-system/adoption-manifest.json`;

const args = process.argv.slice(2);
const update = args.includes("--update");
const allowIncrease = args.includes("--allow-increase");
const json = args.includes("--json");

// A line is treated as a comment (and excluded) when, after trimming, it starts with
// `//` or `*` (single-line comments and JSDoc/block-comment continuation lines). This is
// a deliberately simple heuristic that mirrors how the one false positive found during
// the initial audit (src/components/card-recipes.ts) actually looked: prose inside a
// `/** ... */` block describing a style attribute, not a real one. It is NOT a parser —
// see the measurement doc's adversarial section for how this heuristic can be gamed, and
// treat any future gaming finding as a reason to tighten this function, not to relax the
// ratchet.
function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*");
}

function countInlineStyles() {
  const files = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|jsx?)$/.test(f));

  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(`${ROOT}${file}`, "utf8");
    } catch {
      continue;
    }
    text.split("\n").forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (line.includes("style={{")) hits.push({ file, line: i + 1 });
    });
  }
  return hits;
}

function countUnimportedRegisteredComponents() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const { registeredComponentCount, productImportedComponentCount } = manifest.summary;
  if (typeof registeredComponentCount !== "number" || typeof productImportedComponentCount !== "number") {
    console.error("design-drift-ratchet: adoption-manifest.json summary is missing expected counts.");
    process.exit(1);
  }
  return registeredComponentCount - productImportedComponentCount;
}

const ratchet = JSON.parse(readFileSync(RATCHET_PATH, "utf8"));
const inlineStyleHits = countInlineStyles();
const unimportedCount = countUnimportedRegisteredComponents();

const metrics = [
  {
    key: "inlineStyles",
    label: "inline style={{ }} attributes",
    current: inlineStyleHits.length,
    ceiling: ratchet.inlineStyles.ceiling,
  },
  {
    key: "unimportedRegisteredComponents",
    label: "registered components with zero product importers",
    current: unimportedCount,
    ceiling: ratchet.unimportedRegisteredComponents.ceiling,
  },
];

if (update) {
  const nowIso = new Date().toISOString();
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  let blocked = false;
  for (const m of metrics) {
    const raising = m.current > m.ceiling;
    if (raising && !allowIncrease) {
      console.error(
        `design-drift-ratchet: --update would RAISE ${m.key} from ${m.ceiling} to ${m.current}. ` +
          `Refusing — pass --allow-increase to do this deliberately, with a reason in the commit message.`,
      );
      blocked = true;
      continue;
    }
    if (m.current !== m.ceiling) {
      console.log(
        `design-drift-ratchet: ${m.key} ${raising ? "raised" : "lowered"} ${m.ceiling} -> ${m.current}`,
      );
    }
    ratchet[m.key].ceiling = m.current;
    ratchet[m.key].measuredAt = nowIso;
    ratchet[m.key].baselineSource = headSha;
  }
  if (blocked) process.exit(1);
  writeFileSync(RATCHET_PATH, `${JSON.stringify(ratchet, null, 2)}\n`);
  console.log(`design-drift-ratchet: ${RATCHET_PATH} updated.`);
  process.exit(0);
}

if (json) {
  console.log(JSON.stringify({ metrics }, null, 2));
} else {
  console.log("design-drift-ratchet:");
  for (const m of metrics) {
    const mark = m.current > m.ceiling ? "✗" : "✓";
    console.log(`  ${mark} ${m.label}: ${m.current} (ceiling ${m.ceiling})`);
  }
}

const failures = metrics.filter((m) => m.current > m.ceiling);
if (failures.length > 0) {
  console.error(
    "\ndesign-drift-ratchet: FAILED — the following grew past their committed ceiling in " +
      "docs/design-system/drift-ratchet.json:",
  );
  for (const m of failures) {
    console.error(`  - ${m.key}: ${m.ceiling} -> ${m.current} (+${m.current - m.ceiling})`);
  }
  if (failures.some((m) => m.key === "inlineStyles")) {
    console.error(
      "\n  New inline styles found (first 20):\n" +
        inlineStyleHits
          .slice(0, 20)
          .map((h) => `    ${h.file}:${h.line}`)
          .join("\n"),
    );
    console.error(
      "\n  Classify each new site per docs/design-system/drift-measurement-2026-09-02.md: LEGITIMATE " +
        "(genuinely dynamic, no token fits) or BYPASS (use the token instead). If it's genuinely LEGITIMATE, " +
        "lower the count elsewhere or run `npm run check:design-drift-ratchet -- --update --allow-increase` " +
        "with a reason in the commit message.",
    );
  }
  if (failures.some((m) => m.key === "unimportedRegisteredComponents")) {
    console.error(
      "\n  A newly-registered design-system component has no product importer yet, or one that had an " +
        "importer lost it. See docs/design-system/drift-measurement-2026-09-02.md for the demand-driven " +
        "adoption policy (ledger #266) before deciding whether that's expected.",
    );
  }
  process.exit(1);
}

process.exit(0);
