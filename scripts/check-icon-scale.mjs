#!/usr/bin/env node
// Guardrail/diagnostic: flags icon-sizing utilities that bypass the design
// icon-size scale.
//
// The scale lives in the @theme block of src/app/globals.css:
//   --spacing-icon-xs 12px  → size-icon-xs / h-icon-xs / w-icon-xs
//   --spacing-icon-sm 14px  → size-icon-sm
//   --spacing-icon-md 16px  → size-icon-md  (default)
//   --spacing-icon-lg 20px  → size-icon-lg
//   --spacing-icon-xl 24px  → size-icon-xl
//
// It enforces one unambiguous drift signal: the retired `4.5` half-step
// (h-4.5 / w-4.5 / size-4.5, 18px). 18px is off the 4px grid; it was only ever
// reached by icon glyphs and a handful of tiny boxes, and it resolves cleanly to
// size-icon-lg (glyphs) or h-5 (non-icon boxes).
//
// It intentionally does NOT flag raw h-4 w-4 / h-5 w-5 etc.: those integer
// spacing steps also size non-icons (the ToggleSwitch knob, status dots,
// avatars, container tiles), so a blanket ban would false-positive. Migrating
// icon glyphs onto size-icon-* is a codemod, not a lint rule — see
// docs/design-system.md §2. It also does NOT flag arbitrary h-[Npx]: those are
// used by deliberate non-icon elements too (e.g. count-badge bubbles at 18px),
// so flagging them would false-positive; genuine icon glyphs simply use the scale.
// Mockups (*mockup*) are design-scratch and out of scope.
//
// Usage:
//   node scripts/check-icon-scale.mjs           report only, exit 0 (default)
//   node scripts/check-icon-scale.mjs --strict  exit 1 if any found (promote to a
//                                               CI gate once the backlog is cleared)

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const strict = process.argv.includes("--strict");

// Retired 18px half-step: (min-)h-4.5 / (min-)w-4.5 / size-4.5.
const HALF_STEP = /\b(?:min-)?(?:h|w|size)-4\.5\b/g;

// Tracked source files under src (fast; respects .gitignore). Exclude mockups.
const files = execSync("git ls-files src", { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(tsx?|jsx?)$/.test(f))
  .filter((f) => !/mockup/i.test(f));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(HALF_STEP)) {
      hits.push({ file, line: i + 1, match: m[0] });
    }
  });
}

if (hits.length === 0) {
  console.log("✓ icon-scale: no retired 4.5 (18px) half-step icon sizes in src.");
  process.exit(0);
}

const byMatch = new Map();
for (const h of hits) byMatch.set(h.match, (byMatch.get(h.match) ?? 0) + 1);
const fileCount = new Set(hits.map((h) => h.file)).size;

console.log(`icon-scale: ${hits.length} off-scale icon sizes bypass the scale (across ${fileCount} files):\n`);
for (const [size, n] of [...byMatch.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${size}`);
}
console.log("\nPrefer a named @theme step from src/app/globals.css (size-icon-sm, size-icon-md, size-icon-lg, …).");

if (strict) {
  console.error("\n✗ --strict: off-scale icon sizes present.");
  process.exit(1);
}
process.exit(0);
