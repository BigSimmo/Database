// tests/ward-forced-colors-tokens.test.ts
//
// ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. It reads a stylesheet off
// disk and imports nothing from `src/`, so `vitest related` has no edge to it. A
// focused green has not run this. Run it by name, or let the full suite do it.
//
// WHAT THIS GUARDS. `src/app/ckb-v2-tokens.css` re-points 83 tokens under
// `@media (forced-colors: active)`, scoped to `.ckb-v2.ckb-v2`, and `.ckb-v2` is
// on the <html> element — so most of the ward token layer inherits high-contrast
// handling for free. Eight roles do not, because they alias tokens that block
// does not touch: the two border roles resolve to `--neutral-500` (the v2 block
// re-points `--border`, not the neutral ramp), and the six status roles resolve
// to `--success-text` / `--warning-text` / `--danger-text` and their `-bg`
// partners, which are not in it at all.
//
// The two border roles carry every panel edge and every row rule in Ward Flow.
// A screen that adopted the shared layer and deleted its own forced-colors block
// kept its text and its surfaces and lost its borders — visible only to someone
// actually running high-contrast mode, and no test in this repository renders
// under forced colours.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS = join(process.cwd(), "src/components/ward-management/ward-tokens.module.css");
const V2 = join(process.cwd(), "src/app/ckb-v2-tokens.css");

/** Text roles must become a foreground system colour; fills must become a background one. */
const MUST_BE_FOREGROUND = ["--ward-border", "--ward-divider", "--ward-success", "--ward-warning", "--ward-danger"];
const MUST_BE_BACKGROUND = ["--ward-success-soft", "--ward-warning-soft", "--ward-danger-soft"];

function forcedColorsBlock(css: string): string {
  const at = css.indexOf("@media (forced-colors: active)");
  expect(at, "no forced-colors block in the ward token layer").toBeGreaterThan(-1);
  // To the end of file is enough: this is the last block in the file and the
  // assertions below are about presence of specific declarations, not absence.
  return css.slice(at);
}

describe("the shared ward layer carries its own high-contrast handling", () => {
  const css = readFileSync(TOKENS, "utf8");
  const block = forcedColorsBlock(css);

  it.each(MUST_BE_FOREGROUND)("%s becomes a foreground system colour", (token) => {
    const declaration = new RegExp(`${token}:\\s*(CanvasText|ButtonText|LinkText|MarkText|GrayText)\\s*;`);
    expect(block, `${token} is not re-pointed to a foreground system colour under forced colours`).toMatch(declaration);
  });

  it.each(MUST_BE_BACKGROUND)("%s becomes a background system colour", (token) => {
    const declaration = new RegExp(`${token}:\\s*(Canvas|ButtonFace|Mark|transparent)\\s*;`);
    expect(block, `${token} is not re-pointed to a background system colour under forced colours`).toMatch(declaration);
  });

  it("re-points nothing to a themed value, which would silently do nothing", () => {
    // The failure this catches is `--ward-border: var(--border)` — which looks
    // like a fix, is inside the right block, and resolves to a themed colour
    // that forced-colours mode has already decided to ignore.
    const body = block.slice(block.indexOf("{"));
    const themed = [...body.matchAll(/(--ward-[a-z-]+):\s*(var\([^)]*\)|#[0-9a-fA-F]{3,8})/g)];
    expect(
      themed.map((m) => `${m[1]}: ${m[2]}`),
      "these are re-pointed to a themed value inside the forced-colors block, which changes nothing",
    ).toEqual([]);
  });

  it("does not re-point --ward-tap, because a spacing minimum is not a colour", () => {
    expect(block).not.toContain("--ward-tap:");
  });

  it("still covers every role the v2 layer leaves uncovered — derived, not listed", () => {
    // 🔴 THE ANTI-VACUITY HALF, AND THE ONE THAT MATTERS MOST. The lists above
    // are hand-written, so they can only go stale in the silent direction: add a
    // tenth `--ward-*` role tomorrow that aliases an unre-pointed token, and
    // every assertion above still passes while the new role is uncovered.
    //
    // So this derives the population instead: read every `--ward-x: var(--y)`
    // alias out of the token layer, read the token names the v2 forced-colors
    // block re-points, and require that any ward role whose target is NOT in
    // that set appears in this file's own forced-colors block.
    const aliases = [...css.matchAll(/(--ward-[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g)].map((m) => ({
      role: m[1],
      target: m[2],
    }));
    // Floor the POPULATION walked, never the finding. A pass over zero aliases
    // proves nothing at all, and this file is one refactor away from that.
    expect(aliases.length, "no --ward-* aliases found — this test stopped measuring anything").toBeGreaterThanOrEqual(
      18,
    );

    const v2 = readFileSync(V2, "utf8");
    const v2At = v2.indexOf("@media (forced-colors: active)");
    expect(v2At, "the v2 layer no longer has a forced-colors block — this test's premise is gone").toBeGreaterThan(-1);
    const v2Covered = new Set([...v2.slice(v2At).matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((m) => m[1]));
    expect(v2Covered.size, "read no tokens out of the v2 forced-colors block").toBeGreaterThanOrEqual(50);

    // `--ward-tap` is a spacing role and is excluded by name, with the reason in
    // the stylesheet beside the block.
    const uncovered = aliases
      .filter(({ role, target }) => role !== "--ward-tap" && !v2Covered.has(target))
      .map(({ role }) => role);
    const unhandled = uncovered.filter((role) => !new RegExp(`${role}:`).test(block));
    expect(
      unhandled,
      "these ward roles inherit no high-contrast handling from the v2 layer and are not re-pointed here either",
    ).toEqual([]);
  });
});
