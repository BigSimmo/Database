import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Invariants of the opt-in `.ckb-v2` token layer (`src/app/ckb-v2-tokens.css`).
 *
 * These are the relationships the v2 design review found broken in v1, each of
 * which was invisible to lint, typecheck and a screenshot diff:
 *
 *   #43 `--border-lux` was 55% alpha, which computed LIGHTER than `--border`, so
 *       panels had weaker edges than the cards nested inside them.
 *   #8/#19 the dark surfaces were not monotonic and `--surface-subtle` sat BELOW
 *       `--surface`, so "subtle" read as a hole rather than a lift.
 *   #20 `--text-soft` is decoration-only at ~3.2:1; the risk is someone using it
 *       for label text, or "fixing" it to pass 4.5:1 and losing the tier.
 *
 * Values are read out of the stylesheet rather than duplicated, so retuning a
 * token is allowed — breaking the RELATIONSHIP between tokens is not.
 */

const stylesheet = readFileSync(new URL("../src/app/ckb-v2-tokens.css", import.meta.url), "utf8");

function block(selector: string) {
  // After the cascade port there are two top-level `.ckb-v2` blocks (structural
  // and light shell) and the dark block opens with a grouped selector. Collect
  // every top-level block whose selector line starts with the given selector.
  const opener = `\n${selector} {`;
  const grouped = `\n${selector},`;
  const found: string[] = [];
  let start = stylesheet.indexOf(opener);
  if (start === -1) start = stylesheet.indexOf(grouped);
  while (start > -1) {
    const end = stylesheet.indexOf("\n}", start);
    found.push(stylesheet.slice(start, end));
    start = stylesheet.indexOf(opener, end);
  }
  expect(found.length, `${selector} block is missing from ckb-v2-tokens.css`).toBeGreaterThan(0);
  return found;
}

function declarations(source: string) {
  const map = new Map<string, string>();
  for (const [, name, value] of source.matchAll(/^ {2}(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    map.set(name, value.trim().replace(/\s*\/\*.*$/, ""));
  }
  return map;
}

const ckbBlocks = block(".ckb-v2");
expect(ckbBlocks.length, "expected distinct structural and light .ckb-v2 blocks").toBe(2);
const structural = declarations(ckbBlocks[0]);
// Parsed separately so a light-only token accidentally declared structural (or
// vice versa) fails here instead of passing through a merged map.
const lightShell = declarations(ckbBlocks[1]);
const darkShell = declarations(block(".dark .ckb-v2").join("\n"));

function hexOf(tokens: Map<string, string>, name: string) {
  const value = tokens.get(name);
  expect(value, `${name} is not declared`).toBeTruthy();
  expect(value, `${name} must be a 6-digit hex so the relationship is checkable`).toMatch(/^#[0-9a-f]{6}$/i);
  return value as string;
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const [darker, lighter] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => a - b);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("ckb-v2 layer stays opt-in", () => {
  it("declares nothing outside a .ckb-v2 scope, so the live app is untouched", () => {
    // Every top-level selector must be class-scoped. A stray `:root` here would
    // repaint the whole app the moment the file is imported.
    const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...withoutComments.matchAll(/^(\S[^{}\n]*)\{/gm)].map(([, selector]) => selector.trim());
    expect(selectors.length, "no top-level selectors parsed — the matcher is broken").toBeGreaterThan(0);
    const unscoped = selectors.filter((selector) => !selector.startsWith(".ckb-v2") && !selector.startsWith("@media"));
    expect(unscoped).toEqual([]);
    expect(stylesheet).not.toMatch(/^:root\s*\{/m);
  });

  it("is imported by globals.css so the layer actually ships", () => {
    const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    expect(globals).toContain('@import "./ckb-v2-tokens.css";');
  });
});

describe("ckb-v2 borders", () => {
  it("keeps --border-lux a solid colour that is no lighter than --border (#43)", () => {
    const border = hexOf(lightShell, "--border");
    const lux = hexOf(lightShell, "--border-lux");
    // The v1 bug: an alpha value computed lighter than --border, so a panel edge
    // was weaker than the card edges inside it. Solid, and at least as dark.
    expect(relativeLuminance(lux)).toBeLessThanOrEqual(relativeLuminance(border));
    expect(relativeLuminance(hexOf(darkShell, "--border-lux"))).toBeGreaterThanOrEqual(
      relativeLuminance(hexOf(darkShell, "--border")),
    );
  });

  it("keeps --border-strong stronger than --border in both themes", () => {
    expect(relativeLuminance(hexOf(lightShell, "--border-strong"))).toBeLessThan(
      relativeLuminance(hexOf(lightShell, "--border")),
    );
    expect(relativeLuminance(hexOf(darkShell, "--border-strong"))).toBeGreaterThan(
      relativeLuminance(hexOf(darkShell, "--border")),
    );
  });
});

describe("ckb-v2 dark surface ramp (#8, #19)", () => {
  // Four surfaces, each lighter than the one below it as elevation rises.
  const ramp = ["--surface-inset", "--background", "--surface", "--surface-raised", "--surface-lux"] as const;

  it("rises monotonically", () => {
    const luminances = ramp.map((token) => relativeLuminance(hexOf(darkShell, token)));
    const sorted = [...luminances].sort((a, b) => a - b);
    expect(luminances).toEqual(sorted);
  });

  it("keeps the four elevation steps separated rather than bunched", () => {
    const steps = ["--background", "--surface", "--surface-raised", "--surface-lux"] as const;
    for (let index = 1; index < steps.length; index += 1) {
      const ratio = contrastRatio(hexOf(darkShell, steps[index]), hexOf(darkShell, steps[index - 1]));
      expect(ratio, `${steps[index]} is indistinguishable from ${steps[index - 1]}`).toBeGreaterThan(1.06);
    }
  });

  it("aliases --surface-subtle UP, so 'subtle' lifts rather than sinks", () => {
    expect(relativeLuminance(hexOf(darkShell, "--surface-subtle"))).toBeGreaterThan(
      relativeLuminance(hexOf(darkShell, "--surface")),
    );
  });
});

describe("ckb-v2 ink tiers (#20)", () => {
  it("keeps body and label text above 4.5:1 on the light shell", () => {
    const surface = hexOf(lightShell, "--surface");
    expect(contrastRatio(hexOf(lightShell, "--text"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexOf(lightShell, "--text-muted"), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexOf(lightShell, "--text-heading"), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps --text-soft a decoration tier, not a text tier", () => {
    // Deliberately BELOW 4.5:1. If someone darkens it to pass, the tier collapses
    // into --text-muted and the "decoration only" rule silently loses its teeth —
    // so assert the ceiling as well as the floor.
    const ratio = contrastRatio(hexOf(lightShell, "--text-soft"), hexOf(lightShell, "--surface"));
    expect(ratio).toBeLessThan(4.5);
    expect(ratio, "--text-soft must still be visible as a non-text mark").toBeGreaterThanOrEqual(3);
  });

  it("keeps muted text readable on the dark shell too", () => {
    expect(contrastRatio(hexOf(darkShell, "--text-muted"), hexOf(darkShell, "--surface"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("ckb-v2 command colour (#1, #12)", () => {
  it("keeps a filled command button legible in both themes", () => {
    expect(
      contrastRatio(hexOf(lightShell, "--command"), hexOf(lightShell, "--command-contrast")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexOf(darkShell, "--command"), hexOf(darkShell, "--command-contrast"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("ckb-v2 structure", () => {
  it("keeps --shadow-well a true inset and leaves the --shadow-inset bevel un-overridden (#40, C1)", () => {
    // The v1 value was `0 0 0 1px …`, which is a ring — that is why inputs looked
    // outlined twice, once by their border and once by their "inset".
    expect(lightShell.get("--shadow-well")).toMatch(/^inset /);
    expect(darkShell.get("--shadow-well")).toMatch(/^inset /);
    // The DS bevel is owned by globals.css; a v2 redeclaration strips the bevel
    // highlight from its ~40 consumers (the C1 defect).
    expect(lightShell.get("--shadow-inset")).toBeUndefined();
    expect(darkShell.get("--shadow-inset")).toBeUndefined();
  });

  it("keeps the elevation ladder shadow-only, with no border baked in", () => {
    for (const tier of ["--e1", "--e2", "--e3", "--e4"] as const) {
      const value = lightShell.get(tier);
      expect(value, `${tier} is not declared`).toBeTruthy();
      // A `0 0 0 1px` spread-only layer is a border in disguise: borders own the
      // edge, shadows own the lift, never both on one element (#39).
      expect(value, `${tier} bakes a hairline ring into the shadow`).not.toMatch(/(^|,)\s*0 0 0 1px/);
    }
  });

  it("separates the tap-target floor from the static chip height (#7, #18)", () => {
    expect(structural.get("--tap-min")).toBe("2.75rem");
    expect(structural.get("--chip-height")).toBe("1.75rem");
    expect(structural.get("--row-compact")).not.toBe(structural.get("--tap-min"));
  });

  it("zeroes motion durations under prefers-reduced-motion", () => {
    const reducedMotion = stylesheet.slice(stylesheet.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const token of ["--duration-fast", "--duration-base", "--duration-slow"]) {
      expect(reducedMotion).toContain(`${token}: 0ms;`);
    }
  });

  it("gives every type step its own line-height and tracking (#3, #14, #35, #36)", () => {
    for (const step of ["xs", "sm", "body", "md", "lg", "xl"]) {
      expect(structural.has(`--text-${step}`), `--text-${step} missing`).toBe(true);
      expect(structural.has(`--text-${step}-lh`), `--text-${step}-lh missing`).toBe(true);
      expect(structural.has(`--text-${step}-tr`), `--text-${step}-tr missing`).toBe(true);
    }
    // Negative tracking only from 15px up — tightening small text hurts legibility.
    expect(structural.get("--text-xs-tr")).toBe("0");
    expect(structural.get("--text-sm-tr")).toBe("0");
    expect(structural.get("--text-body-tr")).toMatch(/^-/);
  });
});
