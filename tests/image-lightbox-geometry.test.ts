import { describe, expect, it } from "vitest";

import {
  clampScale,
  clampTranslate,
  displayedSize,
  isQuarterTurn,
  legibleOpenScale,
  LEGIBLE_OPEN_MAX,
  MAX_SCALE,
  MIN_SCALE,
  rotationFitScale,
  topLeftTranslate,
  zoomAboutPoint,
  type LightboxGeometry,
} from "@/components/clinical-dashboard/image-lightbox-geometry";

/**
 * jsdom performs no layout, so none of this could be proven in the lightbox's
 * own DOM test — which is exactly why the maths lives in a pure module. The
 * component keeps only measurement and state; every number it renders is
 * decided here.
 *
 * Stage numbers below model a fullscreen phone sheet: 393 x 688 (viewport minus
 * the Sheet header and the control footer).
 */

const phone = (natural: { width: number; height: number }): LightboxGeometry => ({
  stage: { width: 393, height: 688 },
  natural,
});

/** A wide clinical table crop — the case from the reported defect. */
const wideTable = phone({ width: 1800, height: 300 });
/** A near-square figure that reads fine whole. */
const diagram = phone({ width: 1200, height: 900 });

describe("clampScale", () => {
  it("holds the viewer between whole-image fit and the zoom ceiling", () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(2.5)).toBe(2.5);
  });

  it("degrades a non-finite scale to the whole image, never to a NaN transform", () => {
    // Both NaN and Infinity fall back to MIN_SCALE rather than MAX_SCALE: on a
    // clinical surface the conservative failure is the complete figure, not the
    // maximum zoom into an unknown corner of it.
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MIN_SCALE);
  });
});

describe("isQuarterTurn", () => {
  it("identifies the rotations that swap the on-screen axes", () => {
    expect(isQuarterTurn(0)).toBe(false);
    expect(isQuarterTurn(180)).toBe(false);
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(270)).toBe(true);
  });
});

describe("rotationFitScale", () => {
  it("is inert when the image is not turned", () => {
    expect(rotationFitScale(wideTable, 0)).toBe(1);
    expect(rotationFitScale(wideTable, 180)).toBe(1);
  });

  it("re-fits a quarter-turned image to the stage instead of letting it overflow", () => {
    // This is the defect: object-contain sizes the box *before* rotation, so a
    // rotated wide table used to keep its 393x65 layout box and spill out of the
    // stage. Contained box is 393 x 65.5; turned, it needs min(393/65.5, 688/393).
    const factor = rotationFitScale(wideTable, 90);
    expect(factor).toBeCloseTo(Math.min(393 / (393 / 6), 688 / 393), 5);

    // The proof that matters: at scale 1 the turned image fits the stage exactly.
    const turned = displayedSize(wideTable, 90, 1);
    expect(turned.width).toBeLessThanOrEqual(393 + 0.001);
    expect(turned.height).toBeLessThanOrEqual(688 + 0.001);
    // ...and it fills one axis, so it is a fit rather than a shrink.
    expect(Math.max(turned.width / 393, turned.height / 688)).toBeCloseTo(1, 5);
  });

  it("degrades to 1 when nothing has been measured yet", () => {
    expect(rotationFitScale(null, 90)).toBe(1);
    expect(rotationFitScale(phone({ width: 0, height: 0 }), 90)).toBe(1);
  });
});

describe("legibleOpenScale", () => {
  it("opens a wide table at source-pixel density rather than an unreadable strip", () => {
    // Contained fit renders 1800px of table across 393px — a 4.58x downscale.
    // Capped at LEGIBLE_OPEN_MAX so the reader still gets a sense of the table.
    expect(legibleOpenScale(wideTable, 0)).toBe(LEGIBLE_OPEN_MAX);
  });

  it("opens a near-square figure whole, because its shape is worth seeing first", () => {
    expect(legibleOpenScale(diagram, 0)).toBe(MIN_SCALE);
  });

  it("recomputes for the rotated orientation", () => {
    // Turned, the table occupies 114x688 at scale 1 — still a thin ribbon on a
    // 393px-wide stage, so it opens zoomed and pans down the table's length.
    const opening = legibleOpenScale(wideTable, 90);
    expect(opening).toBeGreaterThan(1);
    expect(opening).toBeLessThanOrEqual(LEGIBLE_OPEN_MAX);
  });

  it("never opens zoomed on an image the stage already upscales", () => {
    // A tiny wide sliver: the contained fit enlarges it, so 1:1 would be a
    // zoom *out*, and MIN_SCALE must win.
    expect(legibleOpenScale(phone({ width: 200, height: 40 }), 0)).toBe(MIN_SCALE);
  });

  it("returns the identity before measurement", () => {
    expect(legibleOpenScale(null, 0)).toBe(MIN_SCALE);
  });
});

describe("clampTranslate", () => {
  it("refuses any pan while the image fits the stage", () => {
    expect(clampTranslate(diagram, 0, 1, { x: 500, y: -500 })).toEqual({ x: 0, y: 0 });
  });

  it("bounds panning to the overflow, so the image cannot be dragged away and lost", () => {
    const scale = 3;
    const painted = displayedSize(wideTable, 0, scale);
    const maxX = (painted.width - 393) / 2;
    expect(clampTranslate(wideTable, 0, scale, { x: 99999, y: 99999 })).toEqual({
      x: maxX,
      y: Math.max(0, (painted.height - 688) / 2),
    });
    expect(clampTranslate(wideTable, 0, scale, { x: -99999, y: 0 }).x).toBe(-maxX);
  });

  it("leaves an in-range pan untouched", () => {
    expect(clampTranslate(wideTable, 0, 3, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it("swaps its bounds with the rotation", () => {
    // Unrotated the table overflows horizontally; turned, it overflows vertically.
    const flat = clampTranslate(wideTable, 0, 3, { x: 99999, y: 99999 });
    const turned = clampTranslate(wideTable, 90, 3, { x: 99999, y: 99999 });
    expect(flat.x).toBeGreaterThan(0);
    expect(flat.y).toBe(0);
    expect(turned.y).toBeGreaterThan(0);
    expect(turned.x).toBe(0);
  });

  it("absorbs unmeasured geometry and non-finite deltas", () => {
    expect(clampTranslate(null, 0, 3, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 });
    expect(clampTranslate(wideTable, 0, 3, { x: Number.NaN, y: Number.NaN })).toEqual({ x: 0, y: 0 });
  });
});

describe("zoomAboutPoint", () => {
  it("keeps the tapped point stationary", () => {
    const point = { x: 90, y: 300 };
    const before = { scale: 1, translate: { x: 0, y: 0 } };
    const after = zoomAboutPoint({
      geometry: wideTable,
      rotation: 0,
      scale: before.scale,
      translate: before.translate,
      nextScale: 3,
      point,
    });

    // The invariant: the content coordinate sitting under the finger — the point
    // in the image's own space — must be the same before and after the zoom.
    const contentUnderFinger = (scale: number, translate: { x: number; y: number }) => ({
      x: (point.x - 393 / 2 - translate.x) / scale,
      y: (point.y - 688 / 2 - translate.y) / scale,
    });

    const held = contentUnderFinger(before.scale, before.translate);
    const moved = contentUnderFinger(after.scale, after.translate);

    // Anchoring holds on the axis that can actually move. The wide table has no
    // vertical overflow at this scale, so clampTranslate pins y to 0 and the
    // y anchor is deliberately not honoured — the clamp outranks the anchor,
    // because an image that fits an axis must not drift along it.
    expect(moved.x).toBeCloseTo(held.x, 5);
    expect(after.translate.y).toBe(0);

    // Guard against a vacuously-passing invariant: a naive centre-anchored zoom
    // (translate left at 0) would move this content, so the x assertion above is
    // only satisfiable by real anchoring.
    const naive = contentUnderFinger(after.scale, before.translate);
    expect(naive.x).not.toBeCloseTo(held.x, 5);
  });

  it("holds the anchor on both axes when both can move", () => {
    // A tall, wide scan overflows in both directions at 3x, so nothing is clamped
    // away and the full two-axis anchor is observable.
    const bigScan = phone({ width: 3000, height: 4000 });
    // Near the centre on purpose: a tap close to an edge zooms past the pan
    // bound, and the clamp (correctly) trims the anchor — that case is covered
    // by "still clamps, so an edge tap cannot zoom the image out of view".
    const point = { x: 250, y: 400 };
    const after = zoomAboutPoint({
      geometry: bigScan,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: 3,
      point,
    });
    const content = (scale: number, t: { x: number; y: number }) => ({
      x: (point.x - 393 / 2 - t.x) / scale,
      y: (point.y - 688 / 2 - t.y) / scale,
    });
    const held = content(1, { x: 0, y: 0 });
    const moved = content(after.scale, after.translate);
    expect(moved.x).toBeCloseTo(held.x, 5);
    expect(moved.y).toBeCloseTo(held.y, 5);
  });

  it("still clamps, so an edge tap cannot zoom the image out of view", () => {
    const after = zoomAboutPoint({
      geometry: wideTable,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: 3,
      point: { x: 0, y: 0 },
    });
    const painted = displayedSize(wideTable, 0, after.scale);
    expect(Math.abs(after.translate.x)).toBeLessThanOrEqual((painted.width - 393) / 2 + 0.001);
    expect(after.translate.y).toBe(0);
  });

  it("falls back to a centred zoom when there is no anchor point", () => {
    const after = zoomAboutPoint({
      geometry: wideTable,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: 2,
      point: null,
    });
    expect(after).toEqual({ scale: 2, translate: { x: 0, y: 0 } });
  });

  it("honours the zoom ceiling", () => {
    const after = zoomAboutPoint({
      geometry: wideTable,
      rotation: 0,
      scale: 1,
      translate: { x: 0, y: 0 },
      nextScale: 500,
      point: null,
    });
    expect(after.scale).toBe(MAX_SCALE);
  });
});

describe("topLeftTranslate", () => {
  it("starts a zoomed read at the first column and row, not the middle of the table", () => {
    const opening = legibleOpenScale(wideTable, 0);
    const translate = topLeftTranslate(wideTable, 0, opening);
    const painted = displayedSize(wideTable, 0, opening);
    // Positive translate moves the image right/down, revealing its top-left.
    expect(translate.x).toBeCloseTo((painted.width - 393) / 2, 5);
    expect(translate.x).toBeGreaterThan(0);
  });

  it("is a no-op when the whole image already fits", () => {
    expect(topLeftTranslate(diagram, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(topLeftTranslate(null, 0, 3)).toEqual({ x: 0, y: 0 });
  });
});
