import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPrimitiveRecipeSources } from "../scripts/design-system-contract-utils.mjs";

/**
 * Gate 1 / PR 3 — design-system recipes must not put the decoration tier on
 * text nodes (eyebrows, placeholders). Decorative glyphs use
 * `--decoration-soft`; `--text-soft` remains declaration-only compatibility.
 */

const primitives = readPrimitiveRecipeSources();

/**
 * The same rule, applied to the search surfaces that carry counts, labels
 * and disabled-facet copy. They are checked by source scan rather than by
 * rendering because the tier is chosen in a class string: a DOM assertion in
 * jsdom sees the class, not the resolved colour, so it would pass either way.
 *
 * Why these files specifically: the results-bar redesign introduced eight
 * new `--text-soft` text nodes, and `--text-soft` is a deprecated alias of
 * `--decoration-soft` that `ckb-v2-token-contract` pins *below* 4.5:1 on
 * purpose. Under the v1 palette they measured 4.72:1 and looked fine; under the
 * v2 palette the identical markup measures 2.99:1, which would have silently
 * undone the dead-end-facet contrast fix the moment the v2 layer activated.
 *
 * The dead-end facet, the count/hint span, and the find-a-filter field moved
 * out of `document-search-results.tsx` and into the shared
 * `result-filter-control.tsx` when documents converged onto
 * `ResultFilterSheet`/`ResultFilterFacetChips` (`docs/filter-contract.md`).
 * The markup relocated; the token rule these checks enforce did not change,
 * so the checks move with it rather than being deleted.
 */
const resultsBand = readFileSync(
  new URL("../src/components/clinical-dashboard/search-results-header-band.tsx", import.meta.url),
  "utf8",
);
const resultFilterControl = readFileSync(
  new URL("../src/components/clinical-dashboard/result-filter-control.tsx", import.meta.url),
  "utf8",
);

/** The line owning a marker, so an assertion names the surface it guards rather
    than the whole file. Icons in these files legitimately keep the decoration
    tier, so a file-wide sweep would be wrong as well as brittle. */
function lineContaining(source: string, marker: string) {
  const line = source.split("\n").find((candidate) => candidate.includes(marker));
  expect(line, `no line contains ${marker}`).toBeTruthy();
  return line!;
}

describe("decoration-on-text contracts", () => {
  it("keeps eyebrowText on a text-tier token, not --text-soft", () => {
    const match = primitives.match(/export const eyebrowText\s*=\s*"([^"]+)"/);
    expect(match, "eyebrowText recipe missing").toBeTruthy();
    expect(match![1]).not.toContain("--text-soft");
    expect(match![1]).not.toContain("--decoration-soft");
    expect(match![1]).toContain("--text-muted");
  });

  it("keeps fieldControl placeholders on --text-placeholder", () => {
    const match = primitives.match(/export const fieldControl\s*=\s*"([^"]+)"/);
    expect(match, "fieldControl recipe missing").toBeTruthy();
    expect(match![1]).toContain("placeholder:text-[color:var(--text-placeholder)]");
    expect(match![1]).not.toContain("placeholder:text-[color:var(--text-soft)]");
  });

  // The dead-end facet is the one that matters most: its whole reason to exist
  // is that the previous `opacity-50` treatment measured 2.34:1. Putting it on
  // the decoration tier reads as fixed under the v1 palette (4.72:1) and is
  // broken again under v2 (2.99:1) — the same markup, a different shell.
  it("keeps the disabled-facet copy on a text tier in both palettes", () => {
    const deadEnd = lineContaining(resultFilterControl, "cursor-default border-dashed");
    expect(deadEnd).toContain("text-[color:var(--text-muted)]");
    expect(deadEnd).not.toContain("var(--text-soft)");
    expect(deadEnd).not.toContain("var(--decoration-soft)");
    // The tier is only half of it; the dashed border is the non-chromatic half
    // and must survive forced-colors, where opacity does not.
    expect(deadEnd).toContain("border-dashed");
  });

  // Facet counts (`{facet.count}`) and the source-type tab count
  // (`{tab.count}`) both render through the same `option.hint` slot once a
  // mode builds its groups with `resultFilterGroup`/`resultFilterFacetGroup`
  // — one check now covers both call shapes.
  it("keeps facet and scope counts on a text tier", () => {
    // `hintLabel ?? hint` since counted options display a short form while the
    // announced name keeps the unit; the tier requirement is unchanged.
    const line = lineContaining(resultFilterControl, ">{option.hintLabel ?? option.hint}<");
    expect(line, "{option.hint} must not use the decoration tier").not.toContain("var(--text-soft)");
    expect(line).toContain("text-[color:var(--text-muted)]");
  });

  it("keeps the find-a-filter placeholder on --text-placeholder", () => {
    // Anchored on the element's own `className`, found by walking forward from
    // the testid, rather than on a fixed slice of characters after it. The
    // original form took 600 characters and broke the moment a comment was added
    // between the two — a guard that fails when someone documents the line it
    // guards trains people to delete the guard.
    const lines = resultFilterControl.split("\n");
    // The shared component derives this testid as a template literal
    // (`` `${testId}-find` ``), not a literal string — every mode's find
    // field carries the same class recipe because there is only one of them.
    const start = lines.findIndex((line) => line.includes("data-testid={`${testId}-find`}"));
    expect(start, "find-a-filter field missing").toBeGreaterThan(-1);
    const className = lines.slice(start, start + 12).find((line) => line.includes("className="));
    expect(className, "find-a-filter field has no className within 12 lines of its testid").toBeTruthy();
    expect(className!).toContain("placeholder:text-[color:var(--text-placeholder)]");
    expect(className!).not.toContain("placeholder:text-[color:var(--text-soft)]");
    // The sheet exists for phones, so this field sits on the tap floor with
    // everything else in it.
    expect(className!).toContain("min-h-tap");
  });

  it("keeps the applied-filter shelf label and its Clear on a text tier", () => {
    const label = lineContaining(resultsBand, "search-band-shelf-label hidden");
    expect(label).toContain("text-[color:var(--text-muted)]");
    expect(label).not.toContain("var(--text-soft)");

    const clear = lineContaining(resultsBand, "search-band-ghost inline-flex");
    expect(clear).toContain("text-[color:var(--text-muted)]");
    expect(clear).not.toContain("var(--text-soft)");
  });
});
