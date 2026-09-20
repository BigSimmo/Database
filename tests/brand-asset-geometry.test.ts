import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BRAND_COUNTER_TRANSFORM,
  BRAND_POINT,
  BRAND_POINT_SMALL,
  BRAND_STROKE_PATH,
  BRAND_STROKE_PATH_SMALL,
} from "@/lib/brand-mark";

/**
 * The shipped artwork in `public/brand/` is NOT generated.
 *
 * `scripts/generate-brand-assets.ts` writes exactly two files — `src/app/icon.svg`
 * and `public/offline.html` — and `npm run brand:check` verifies only those. The
 * fifteen files a designer actually downloads are hand-maintained, so nothing
 * failed when one of them fell behind.
 *
 * That is not hypothetical. `psychsift-lockup-horizontal-tagline.svg` carried the
 * retired brand-sheet line "CLARITY. EVIDENCE. BETTER CARE." long after the
 * strapline settled as "From question to source", and no gate noticed; it was
 * found by reading the file. A full sweep on 2026-09-20 confirmed every asset's
 * GEOMETRY was still current, so this suite is not repairing a known break — it
 * is closing the hole that let the strapline rot, before the next redesign uses it.
 *
 * What is asserted is the one invariant the brand doc states and a hand-edit can
 * silently violate: the cut, the point and the counter-rotation are a SET. Mixing
 * the display stroke with the small-size point, or vice versa, produces a glyph
 * that is off-centre in its own tile and reads as a different mark. Placement is
 * deliberately NOT asserted here — the favicon and the maskable icon each centre
 * their ink at their own scale, and `brand-mark-optics.test.ts` already owns that
 * arithmetic.
 */

const BRAND_DIR = new URL("../public/brand/", import.meta.url);

/** The settled strapline. The lockup, the construction record and the asset sheet must agree on it. */
const STRAPLINE = "From question to source";
/** Its outlined, tracked-caps form inside the lockup artwork. */
const STRAPLINE_CAPS = "FROM QUESTION TO SOURCE";
/** Retired lines that must never reappear as a current claim. */
const RETIRED_TAGLINES = ["CLARITY. EVIDENCE. BETTER CARE.", "Clinical clarity. Evidence. Better care."];

function readAsset(name: string) {
  return readFileSync(new URL(name, BRAND_DIR), "utf8");
}

const assetNames = readdirSync(new URL(BRAND_DIR))
  .filter((name) => name.endsWith(".svg"))
  .sort();

/** Files that draw the mark carry the counter transform; the wordmark alone does not. */
const glyphAssets = assetNames.filter((name) => readAsset(name).includes(BRAND_COUNTER_TRANSFORM));

function countOccurrences(haystack: string, needle: string) {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at > -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

describe("the shipped brand assets are discoverable at all", () => {
  it("finds the SVG set, and the wordmark is the only one without the mark", () => {
    expect(assetNames.length).toBeGreaterThanOrEqual(13);
    const withoutGlyph = assetNames.filter((name) => !glyphAssets.includes(name));
    expect(withoutGlyph).toEqual(["psychsift-wordmark.svg"]);
  });
});

describe("every shipped asset draws one complete geometry set", () => {
  it.each(glyphAssets)("%s pairs its cut with the point that belongs to it", (name) => {
    const svg = readAsset(name);

    const displayStrokes = countOccurrences(svg, BRAND_STROKE_PATH);
    const smallStrokes = countOccurrences(svg, BRAND_STROKE_PATH_SMALL);

    // Exactly one cut, drawn twice — once as itself and once counter-turned.
    expect(
      displayStrokes > 0 && smallStrokes > 0,
      `${name} mixes the display cut and the small-size cut in one drawing`,
    ).toBe(false);
    const usesSmall = smallStrokes > 0;
    expect(usesSmall ? smallStrokes : displayStrokes, `${name} does not draw its cut exactly twice`).toBe(2);

    // The lower stroke is the upper one counter-turned, never a second drawing.
    expect(countOccurrences(svg, BRAND_COUNTER_TRANSFORM), `${name} does not counter-turn its lower stroke once`).toBe(
      1,
    );

    // The point that travels with that cut, and no other.
    const point = usesSmall ? BRAND_POINT_SMALL : BRAND_POINT;
    const other = usesSmall ? BRAND_POINT : BRAND_POINT_SMALL;
    const circles = [...svg.matchAll(/<circle\s+cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g)];
    expect(circles, `${name} does not draw exactly one point`).toHaveLength(1);
    const [, cx, cy, r] = circles[0];
    expect(
      { cx: Number(cx), cy: Number(cy), r: Number(r) },
      `${name} uses the ${usesSmall ? "small-size" : "display"} cut, so its point must be ${JSON.stringify(point)}, not ${JSON.stringify(other)}`,
    ).toEqual({ cx: point.cx, cy: point.cy, r: point.r });
  });
});

describe("the strapline lockup and the documents that describe it agree", () => {
  const lockup = "psychsift-lockup-horizontal-tagline.svg";

  it("the lockup names the settled strapline in its description", () => {
    const svg = readAsset(lockup);
    expect(svg).toContain(STRAPLINE);
    for (const retired of RETIRED_TAGLINES) {
      expect(svg, `${lockup} still names the retired line ${retired}`).not.toContain(retired);
    }
  });

  it.each([
    ["docs/brand/psychsift-logo.md", "docs/brand/psychsift-logo.md"],
    ["docs/brand/design-handover.md", "docs/brand/design-handover.md"],
    ["public/brand/preview.html", "public/brand/preview.html"],
  ])("%s describes that file with the current strapline", (_label, relative) => {
    const text = readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
    const rows = text.split("\n").filter((line) => line.includes(lockup));
    expect(rows.length, `${relative} never mentions ${lockup}`).toBeGreaterThan(0);
    for (const row of rows) {
      for (const retired of RETIRED_TAGLINES) {
        expect(row, `${relative} still describes ${lockup} as carrying ${retired}`).not.toContain(retired);
      }
    }
    expect(
      text.includes(STRAPLINE_CAPS) || text.includes(STRAPLINE),
      `${relative} does not state the current strapline anywhere`,
    ).toBe(true);
  });
});

describe("the two copies of the asset sheet stay identical", () => {
  it("public/brand/preview.html matches docs/brand/preview.html byte for byte", () => {
    const served = readFileSync(new URL("../public/brand/preview.html", import.meta.url));
    const documented = readFileSync(new URL("../docs/brand/preview.html", import.meta.url));
    expect(
      served.equals(documented),
      "public/brand/preview.html has drifted from docs/brand/preview.html — copy the documented sheet over the served one",
    ).toBe(true);
  });

  it("the sheet does not claim the assets are generated, because they are not", () => {
    const sheet = readFileSync(new URL("../public/brand/preview.html", import.meta.url), "utf8");
    const generated = readFileSync(new URL("../scripts/generate-brand-assets.ts", import.meta.url), "utf8");
    expect(
      generated.includes("public/brand/"),
      "generate-brand-assets.ts now writes public/brand/ — update this suite and the asset sheet's wording together",
    ).toBe(false);
    expect(
      sheet,
      "the asset sheet claims public/brand/ files are rebuilt together; nothing rebuilds them, and saying so is how the strapline rotted unnoticed",
    ).not.toContain("all\n      fifteen are rebuilt together");
  });
});

describe("the mark's own module stays the single source", () => {
  it("no shipped asset invents its own stroke geometry", () => {
    for (const name of glyphAssets) {
      const svg = readAsset(name);
      const paths = [...svg.matchAll(/<path d="(M41\.3675[^"]*)"/g)].map((match) => match[1]);
      expect(paths.length, `${name} draws no recognisable stroke`).toBeGreaterThan(0);
      for (const d of paths) {
        expect(
          d === BRAND_STROKE_PATH || d === BRAND_STROKE_PATH_SMALL,
          `${name} carries a stroke path that is in neither cut — it has been hand-edited away from src/lib/brand-mark.ts`,
        ).toBe(true);
      }
    }
  });
});
