// Generates static brand assets from the single source in src/lib/brand-mark.
// Currently emits src/app/icon.svg (the themed browser-tab icon). Run:
//   node scripts/run-tsx.mjs scripts/generate-brand-assets.ts          # write
//   node scripts/run-tsx.mjs scripts/generate-brand-assets.ts --check  # verify (CI)
//
// The --check mode is wired into `verify:cheap` so app/icon.svg can never drift
// from the brand-mark source (same idea as sitemap:check).
//
// NOTE: src/app/favicon.ico is a multi-resolution binary and cannot be emitted
// here — the toolchain has no rasteriser. Regenerate it offline from icon.svg
// when the mark changes; see docs/design-system.md.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { brandIconSvg } from "@/lib/brand-mark";

const check = process.argv.includes("--check");
const iconPath = resolve(process.cwd(), "src/app/icon.svg");
const expected = brandIconSvg();

if (!check) {
  writeFileSync(iconPath, expected);
  console.log("✓ brand: wrote src/app/icon.svg from the brand-mark source.");
  process.exit(0);
}

let actual: string;
try {
  actual = readFileSync(iconPath, "utf8");
} catch {
  console.error("✗ brand: src/app/icon.svg is missing. Run: npm run brand:update");
  process.exit(1);
}

if (actual !== expected) {
  console.error("✗ brand: src/app/icon.svg is out of sync with src/lib/brand-mark. Run: npm run brand:update");
  process.exit(1);
}

console.log("✓ brand: src/app/icon.svg matches the brand-mark source.");
