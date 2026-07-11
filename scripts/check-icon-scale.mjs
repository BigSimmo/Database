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
// It tracks two kinds of drift that are unambiguously icon sizing:
//   1. The retired `4.5` half-step (h-4.5 / w-4.5 / size-4.5, 18px) — always an
//      icon size, replaced by size-icon-sm/-md/-lg per site.
//   2. Arbitrary square pixel sizes in the icon range (<= 24px), e.g.
//      h-[18px] w-[18px] / size-[16px] — bypass the scale.
//
// It intentionally does NOT flag raw h-4 w-4 / h-5 w-5 etc.: those integer
// spacing steps also size non-icons (the ToggleSwitch knob, status dots,
// avatars, container tiles), so a blanket ban would false-positive. Migrating
// icon glyphs onto size-icon-* is a codemod, not a lint rule — see
// docs/design-system.md §2. Only the unambiguous drift above is enforced here.
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
// Arbitrary square pixel sizes: (min-)h-[Npx] / (min-)w-[Npx] / size-[Npx].
const ARBITRARY_PX = /\b(?:min-)?(?:h|w|size)-\[(\d+)px\]/g;

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
    for (const m of line.matchAll(ARBITRARY_PX)) {
      // Only the icon glyph range (12–24px). Below 12px is dividers/dots/rules
      // (e.g. w-[2px]); above 24px is avatars/tiles/shells — none are icon glyphs.
      const px = Number(m[1]);
      if (px >= 12 && px <= 24) hits.push({ file, line: i + 1, match: m[0] });
    }
  });
}

if (hits.length === 0) {
  console.log("✓ icon-scale: no off-scale icon sizes (4.5 half-step / arbitrary ≤24px) in src.");
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
