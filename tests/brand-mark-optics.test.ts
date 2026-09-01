import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAND_GLYPH_TRANSFORM,
  BRAND_GLYPH_TRANSFORM_BARE,
  BRAND_GLYPH_TRANSFORM_BARE_SMALL,
  BRAND_GLYPH_TRANSFORM_SMALL,
  BRAND_POINT,
  BRAND_POINT_SMALL,
  BRAND_STROKE_PATH,
  BRAND_STROKE_PATH_SMALL,
  brandMarkOptics,
} from "@/lib/brand-mark";

/**
 * The mark is a construction, not a bitmap, and it does not simply get smaller.
 * Two pieces of its negative space — the 4.2-unit cut between the strokes and
 * the 7.26-unit crescent around the point — close up at 32px and below, which
 * fuses the dot into the S and reads as a heavy blob above an already-thinner
 * lower stroke. That is the top-heavy look; `docs/brand/psychsift-logo.md`
 * §"Small sizes" specifies a separate optical cut for exactly that range.
 *
 * These tests guard the two ways that can go wrong: the placement arithmetic,
 * and a call site drawing the wrong cut for the size it renders at.
 */

/** Ink bounding boxes, from docs/brand/psychsift-logo.md. */
const INK = { displayWidth: 55.33, chromeWidth: 65.33, height: 100.38 };
const VIEWBOX = 512;
/** Two-decimal box figures, so the centre lands within a rounding of 256. */
const CENTRING_TOLERANCE = 0.01;

function parseTransform(transform: string) {
  const match = /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/.exec(transform);
  expect(match, `unparseable transform: ${transform}`).not.toBeNull();
  const [, x, y, scale] = match as RegExpExecArray;
  return { x: Number(x), y: Number(y), scale: Number(scale) };
}

describe("the glyph placements all centre their own ink box", () => {
  it.each([
    ["BRAND_GLYPH_TRANSFORM (tiled, display)", BRAND_GLYPH_TRANSFORM, INK.displayWidth],
    ["BRAND_GLYPH_TRANSFORM_SMALL (tiled, chrome)", BRAND_GLYPH_TRANSFORM_SMALL, INK.chromeWidth],
    ["BRAND_GLYPH_TRANSFORM_BARE (bare, display)", BRAND_GLYPH_TRANSFORM_BARE, INK.displayWidth],
    ["BRAND_GLYPH_TRANSFORM_BARE_SMALL (bare, chrome)", BRAND_GLYPH_TRANSFORM_BARE_SMALL, INK.chromeWidth],
  ])("%s lands its centre on 256", (_name, transform, inkWidth) => {
    const { x, scale } = parseTransform(transform);
    expect(x + (inkWidth / 2) * scale).toBeCloseTo(VIEWBOX / 2, 1);
    expect(Math.abs(x + (inkWidth / 2) * scale - VIEWBOX / 2)).toBeLessThan(CENTRING_TOLERANCE * VIEWBOX);
  });
});

describe("the bare pair is one construction at two cuts", () => {
  const display = parseTransform(BRAND_GLYPH_TRANSFORM_BARE);
  const chrome = parseTransform(BRAND_GLYPH_TRANSFORM_BARE_SMALL);

  it("shares a scale, because only the point's x moves between variants", () => {
    // BRAND_POINT_SMALL keeps cy and r, so the vertical extent is identical and
    // the bare scale — which exists to fill the box top to bottom — cannot change.
    expect(BRAND_POINT_SMALL.cy).toBe(BRAND_POINT.cy);
    expect(BRAND_POINT_SMALL.r).toBe(BRAND_POINT.r);
    expect(chrome.scale).toBe(display.scale);
    expect(chrome.y).toBe(display.y);
  });

  it("fills the box top to bottom at that scale", () => {
    expect(INK.height * display.scale).toBeCloseTo(VIEWBOX, 0);
  });

  it("shifts left by exactly half the point's travel", () => {
    // The point moves 10 units out and is the box's right edge, so the box
    // widens by 10 and its centre by 5.
    const travel = BRAND_POINT_SMALL.cx - BRAND_POINT.cx;
    expect(travel).toBe(10);
    expect(INK.chromeWidth - INK.displayWidth).toBeCloseTo(travel, 1);
    expect(display.x - chrome.x).toBeCloseTo((travel / 2) * display.scale, 2);
  });

  it("uses the rule the committed tiled pair already used", () => {
    // The check that this is the rule actually in use, not one that merely fits.
    const tiledDisplay = parseTransform(BRAND_GLYPH_TRANSFORM);
    const tiledChrome = parseTransform(BRAND_GLYPH_TRANSFORM_SMALL);
    expect(tiledDisplay.x - tiledChrome.x).toBeCloseTo(5 * tiledDisplay.scale, 2);
  });
});

describe("the variants are selected as whole sets", () => {
  // Mixing one variant's point with the other's placement puts the glyph
  // off-centre; the doc calls that out by name. One selector makes it unreachable.
  it("pairs each stroke with its own point and placement", () => {
    expect(brandMarkOptics("display")).toEqual({
      transform: BRAND_GLYPH_TRANSFORM_BARE,
      stroke: BRAND_STROKE_PATH,
      point: BRAND_POINT,
    });
    expect(brandMarkOptics("chrome")).toEqual({
      transform: BRAND_GLYPH_TRANSFORM_BARE_SMALL,
      stroke: BRAND_STROKE_PATH_SMALL,
      point: BRAND_POINT_SMALL,
    });
  });

  it("keeps the cuts genuinely different", () => {
    expect(BRAND_STROKE_PATH_SMALL).not.toBe(BRAND_STROKE_PATH);
    expect(BRAND_POINT_SMALL.cx).toBeGreaterThan(BRAND_POINT.cx);
  });
});

/** The brand doc's threshold: "at 32 px and below two things close up". */
const CHROME_CUT_MAX_PX = 32;
const REM_PX = 16;

/**
 * Tailwind `h-N` is N/4 rem; a CSS-module class is resolved to its own rule.
 *
 * The module lookup must go through the *specific* import identifier, not every
 * `.module.css` the file imports. `ward-management-navigation.tsx` imports two
 * modules and BOTH define `.brandGlyph`, at 2.5rem and 2rem — an identifier-blind
 * resolver merges them and reports every site there as spanning 32-40px, which
 * is a defect in this helper that reads exactly like a defect in the source.
 */
function renderedHeightsPx(className: string, sourcePath: string): number[] {
  const cssModule = /\{\s*(\w+)\.(\w+)\s*\}/.exec(className);
  if (!cssModule) {
    return [...className.matchAll(/(?:^|\s|:)h-(\d+)\b/g)].map(([, n]) => (Number(n) / 4) * REM_PX);
  }
  const [, identifier, cssClass] = cssModule;
  const source = readFileSync(sourcePath, "utf8");
  const importPath = new RegExp(String.raw`import\s+${identifier}\s+from\s+"([^"]*\.module\.css)"`).exec(source)?.[1];
  if (!importPath) return [];
  const css = readFileSync(path.resolve(path.dirname(sourcePath), importPath), "utf8");
  const rule = new RegExp(String.raw`\.${cssClass}\s*\{[^}]*?height:\s*([\d.]+)rem`, "s").exec(css);
  return rule ? [Number(rule[1]) * REM_PX] : [];
}

describe("every production call site draws the cut its size needs", () => {
  const files = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file.endsWith(".tsx") && !/mockups?\b/.test(file));

  const callSites = files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(/<BrandMark\b([^>]*?)\/>/gs)].map((match) => ({
      file,
      attributes: match[1],
      optical: /optical="chrome"/.test(match[1]) ? "chrome" : "display",
      heights: renderedHeightsPx(
        /className=(?:"([^"]*)"|(\{[^}]*\}))/.exec(match[1])?.slice(1).find(Boolean) ?? "",
        file,
      ),
    }));
  });

  it("finds the production call sites at all", () => {
    // Guards the scan itself: a regex that silently matches nothing would make
    // every assertion below pass vacuously.
    expect(callSites.length).toBeGreaterThanOrEqual(10);
    expect(callSites.every((site) => site.heights.length > 0)).toBe(true);
  });

  it.each([
    ["never straddles the threshold, which would need a human decision", "straddle"],
    ["draws the chrome cut at 32px and below", "chrome"],
    ["draws the display cut above 32px", "display"],
  ])("%s", (_name, mode) => {
    for (const site of callSites) {
      const smallest = Math.min(...site.heights);
      const largest = Math.max(...site.heights);
      if (mode === "straddle") {
        expect(
          smallest > CHROME_CUT_MAX_PX || largest <= CHROME_CUT_MAX_PX,
          `${site.file} renders ${smallest}-${largest}px, spanning the ${CHROME_CUT_MAX_PX}px cut ` +
            "threshold. One element draws one cut, so pick deliberately rather than by rounding.",
        ).toBe(true);
        continue;
      }
      if (mode === "chrome" && largest <= CHROME_CUT_MAX_PX) {
        expect(site.optical, `${site.file} renders at ${largest}px and needs optical="chrome"`).toBe("chrome");
      }
      if (mode === "display" && smallest > CHROME_CUT_MAX_PX) {
        expect(
          site.optical,
          `${site.file} renders at ${smallest}px, above the small-cut range; the widened gap is not for it`,
        ).toBe("display");
      }
    }
  });
});
