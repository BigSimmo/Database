// Single source of truth for the brand mark: the PsychSift S — two
// counter-turning strokes divided by one straight cut, with a settled point —
// on a rounded tile. Every surface that draws the mark derives from the
// geometry here so the favicon, the in-app <BrandMark>, the browser-tab icon
// (app/icon.svg), and the generated app-icon / maskable / OG image routes can
// never drift apart.
//
// The construction is recorded in docs/brand/psychsift-logo.md and the master
// artwork lives in public/brand/. Do not re-draw the paths below by hand: they
// are the exact output of that construction, and the two strokes are one path
// and its point reflection, which is what keeps the cut between them parallel.
//
// Pure data + strings (no JSX, no imports) so it is consumable everywhere: the
// React <BrandMark> renders the exported geometry as JSX; scripts/generate-
// brand-assets.ts writes app/icon.svg from brandIconSvg(); the next/og image
// routes embed brandMarkSvg() as a data: URI.

/** 512×512 coordinate system shared by every rendering — the master artwork's own. */
export const BRAND_VIEWBOX = "0 0 512 512";

/** Rounded tile: a corner radius of 3/16 of the side. */
export const BRAND_TILE = { x: 0, y: 0, size: 512, rx: 96 } as const;

/** Places the 100-unit glyph inside the tile, centred on its ink bounding box,
 *  at 80% of the tile height so the rounded corners keep their margin. */
export const BRAND_GLYPH_TRANSFORM = "translate(143.1125 51.2) scale(4.0804)";

/** The small-size variant sits wider, because its point is slid out of the
 *  cradle (see BRAND_POINT_SMALL) and so the ink bounding box it is centred on
 *  is 10 units wider. Same scale, different centring. */
export const BRAND_GLYPH_TRANSFORM_SMALL = "translate(122.7103 51.2) scale(4.0804)";

/** The same glyph with no tile behind it, scaled so its ink fills the box top to
 *  bottom. Used by the in-app mark, where the symbol stands on the page ground
 *  and the surrounding layout — not a tile — provides the breathing room. The
 *  mark therefore occupies exactly the slot the tiled version used to. */
export const BRAND_GLYPH_TRANSFORM_BARE = "translate(114.8907 0) scale(5.1006)";

/** The bare glyph's small-size placement — the counterpart of
 *  BRAND_GLYPH_TRANSFORM_SMALL for the untiled, in-app mark.
 *
 *  Not a new measurement. The brand doc fixes the two ink boxes: the primary
 *  glyph spans 0 to 55.33 horizontally, the small variant 0 to 65.33, and both
 *  span the same 0 to 100.38 vertically. Every placement here centres that box
 *  in the 512 viewBox, which is verifiable against the three transforms above —
 *  each lands its centre on 256.000 to within 0.003, the rounding of a
 *  two-decimal box figure.
 *
 *  Two consequences, and both are why this is a derivation rather than a redraw:
 *
 *  The vertical extent is identical between the variants (the point slides
 *  sideways; its cy and r do not move), so the scale is unchanged at 5.1006 —
 *  100.3813 x 5.1006 = 512.0, the bare variant's whole point.
 *
 *  The point moves exactly 10 units out and is the box's right edge, so the box
 *  widens by exactly 10 and its centre by exactly 5. The placement therefore
 *  shifts left by 5 glyph units at this scale: 114.8907 - 5 x 5.1006 = 89.3877.
 *  The same arithmetic reproduces the committed tiled pair (143.1125 - 5 x
 *  4.0804 = 122.7103, as shipped), which is the check that the rule is the one
 *  actually used rather than one that merely fits.
 *
 *  It travels with BRAND_STROKE_PATH_SMALL and BRAND_POINT_SMALL as a set. The
 *  doc is explicit that mixing one variant's point with the other's placement
 *  puts the glyph off-centre; `brandMarkOptics()` below is the only supported
 *  way to pick, so a caller cannot half-apply the variant. */
export const BRAND_GLYPH_TRANSFORM_BARE_SMALL = "translate(89.3877 0) scale(5.1006)";

/** The two optical variants of the bare glyph, as whole sets.
 *
 *  `display` is the primary construction. `chrome` is the small-size cut: the
 *  4.2-unit gap between the strokes opened to 7.2, and the point slid 10 units
 *  out of its cradle so the crescent opens from 7.26 to 11.55.
 *
 *  The threshold is 32px, from the brand doc's own "at 32 px and below two
 *  things close up" - below it the cut and the crescent both fall under two
 *  pixels and the dot fuses into the S, which reads as a heavy blob at the top
 *  of a mark whose lower stroke is already the thinner one. That fusion is what
 *  made the mark look top-heavy in app chrome; the deeper `--brand-mark-emphasis`
 *  ink compensates for it, and this fixes it.
 *
 *  Below about 20px the crescent is under two pixels whatever is done. That is
 *  the size, not the placement, and no variant rescues it. */
export function brandMarkOptics(variant: "display" | "chrome") {
  return variant === "chrome"
    ? { transform: BRAND_GLYPH_TRANSFORM_BARE_SMALL, stroke: BRAND_STROKE_PATH_SMALL, point: BRAND_POINT_SMALL }
    : { transform: BRAND_GLYPH_TRANSFORM_BARE, stroke: BRAND_STROKE_PATH, point: BRAND_POINT };
}

/** The upper stroke. Four arcs and the straight cut, meeting at two cusps. */
export const BRAND_STROKE_PATH =
  "M41.3675 2.6554 A17.7232 17.7232 0 0 0 29.0679 28.0493 A13 13 0 0 1 28.8667 40.1963 " +
  "L18.0434 59.8793 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z";

/** The small-size optical cut: the same silhouette with the 4.2-unit gap opened
 *  to 7.2 so it does not close up under 32 px. Used by the browser-tab icon. */
export const BRAND_STROKE_PATH_SMALL =
  "M41.3675 2.6554 A17.7232 17.7232 0 0 0 28.6276 27.115 A13 13 0 0 1 28.1033 38.5768 " +
  "L16.8897 58.9696 A55.1234 55.1234 0 0 1 3.9761 43.9116 A29.2009 29.2009 0 0 1 41.3675 2.6554 Z";

/** The lower stroke IS the upper one under this transform — a 180° rotation and
 *  a 7% enlargement in one step. The cut is positioned so this carries the upper
 *  stroke's facing edge exactly onto the lower one; see the brand doc. */
export const BRAND_COUNTER_TRANSFORM = "translate(55.1029 100.3813) scale(-1.07)";

/** The settled point, cradled in the S's throat. Its centre is exactly the
 *  centre of the throat arc (17.7232 at (44.8724, 20.0286)), so the crescent of
 *  white between the point and the curve that cups it is a constant 7.2646
 *  units all the way round — the same constant-width idea as the straight cut
 *  between the two strokes. Move it off that centre and the crescent starts to
 *  taper. */
export const BRAND_POINT = { cx: 44.8724, cy: 20.0286, r: 10.4586 } as const;

/** The small-size point: the same circle slid 10 units out of the cradle, so
 *  the crescent opens from 7.26 to 11.55 units and the point still separates
 *  from the S at 20–32 px instead of fusing into it. The counterpart of the
 *  widened cut in BRAND_STROKE_PATH_SMALL, and used by the same surfaces. At
 *  16 px the crescent is still under two pixels and the two do merge; that is
 *  the size, not the placement. */
export const BRAND_POINT_SMALL = { cx: 54.8724, cy: 20.0286, r: 10.4586 } as const;

/** Brand colours per theme. The symbol carries the colour and the ground stays
 *  out of its way: `ink` mirrors --clinical-accent, and `tile` mirrors the page
 *  ground it sits on (--surface-raised). So on a white page the mark reads as
 *  the bare symbol with no box around it, which is how it is meant to be seen;
 *  the tile exists only because a .ico and a raster app icon have no
 *  transparency to fall back on and must paint some ground.
 *
 *  These cannot read the tokens (the favicon and the generated PNG icon routes
 *  render outside any stylesheet), so they must be re-derived by hand whenever
 *  the accent moves — then `npm run brand:update` regenerates app/icon.svg,
 *  which `npm run brand:check` verifies in verify:cheap, and the design-token
 *  contract test fails if they ever disagree with the token. */
export const BRAND_LIGHT = { tile: "#ffffff", ink: "#1d6fb8" } as const;
export const BRAND_DARK = { tile: "#171b1e", ink: "#74bdf0" } as const;

export type BrandColors = { tile: string; ink: string };

/** Inner SVG markup (no <svg> wrapper) with explicit colours — shared by the
 *  flat SVG/PNG builders. The React <BrandMark> renders the same geometry from
 *  the exported constants above. */
export function brandMarkInner({ tile, ink }: BrandColors, small = false): string {
  const t = BRAND_TILE;
  // The small-size variant is a set: the widened cut, the point slid out of the
  // cradle, and the centring that its wider ink box needs. Mixing one with the
  // other's placement puts the glyph off-centre in the tile.
  const stroke = small ? BRAND_STROKE_PATH_SMALL : BRAND_STROKE_PATH;
  const p = small ? BRAND_POINT_SMALL : BRAND_POINT;
  const place = small ? BRAND_GLYPH_TRANSFORM_SMALL : BRAND_GLYPH_TRANSFORM;
  return (
    `<rect x="${t.x}" y="${t.y}" width="${t.size}" height="${t.size}" rx="${t.rx}" fill="${tile}" />` +
    `<g transform="${place}" fill="${ink}">` +
    `<path d="${stroke}" />` +
    `<path d="${stroke}" transform="${BRAND_COUNTER_TRANSFORM}" />` +
    `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" />` +
    `</g>`
  );
}

/** Standalone flat SVG (single colour pair) — embedded as a data: URI inside the
 *  next/og image routes (apple-icon, maskable, opengraph-image). */
export function brandMarkSvg(colors: BrandColors = BRAND_LIGHT): string {
  return `<svg viewBox="${BRAND_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${brandMarkInner(colors)}</svg>`;
}

/** Themed standalone SVG for the browser-tab icon (app/icon.svg): a
 *  prefers-color-scheme swap that a raster app-icon cannot do. Uses the
 *  small-size cut, because this is the file that renders at 16–32 px. Written to
 *  app/icon.svg by scripts/generate-brand-assets.ts (verified in verify:cheap). */
export function brandIconSvg(): string {
  const t = BRAND_TILE;
  const p = BRAND_POINT_SMALL;
  return `<svg viewBox="${BRAND_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .tile { fill: ${BRAND_LIGHT.tile}; }
    .ink { fill: ${BRAND_LIGHT.ink}; }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${BRAND_DARK.tile}; }
      .ink { fill: ${BRAND_DARK.ink}; }
    }
  </style>
  <rect class="tile" x="${t.x}" y="${t.y}" width="${t.size}" height="${t.size}" rx="${t.rx}" />
  <g class="ink" transform="${BRAND_GLYPH_TRANSFORM_SMALL}">
    <path d="${BRAND_STROKE_PATH_SMALL}" />
    <path d="${BRAND_STROKE_PATH_SMALL}" transform="${BRAND_COUNTER_TRANSFORM}" />
    <circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" />
  </g>
</svg>
`;
}
