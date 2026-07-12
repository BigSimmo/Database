// Single source of truth for the Clinical KB brand mark: a refined ECG pulse on
// a rounded clinical-teal tile. Every surface that draws the mark derives from
// the geometry here so the favicon, the in-app <BrandMark>, the browser-tab
// icon (app/icon.svg), and the generated app-icon / maskable / OG image routes
// can never drift apart.
//
// Pure data + strings (no JSX, no imports) so it is consumable everywhere: the
// React <BrandMark> renders the exported geometry as JSX; scripts/generate-
// brand-assets.ts writes app/icon.svg from brandIconSvg(); the next/og image
// routes embed brandMarkSvg() as a data: URI.

/** 48×48 coordinate system shared by every rendering. */
export const BRAND_VIEWBOX = "0 0 48 48";

/** Rounded tile. */
export const BRAND_TILE = { x: 2, y: 2, size: 44, rx: 14 } as const;
/** Subtle baked-in top highlight (theme-independent, very low opacity). */
export const BRAND_HIGHLIGHT_PATH = "M2 16C2 8.3 8.3 2 16 2h16c7.7 0 14 6.3 14 14v1H2z";
/** The refined ECG pulse: flat baseline, one clean QRS spike, flat baseline. */
export const BRAND_PULSE_PATH = "M7 26h10.4l2.4-10 4 19 3-9H41";
export const BRAND_PULSE_WIDTH = 3.3;

/** Brand colours per theme. Light = clinical-teal tile / white ink; dark inverts. */
export const BRAND_LIGHT = { tile: "#0b6f86", ink: "#ffffff" } as const;
export const BRAND_DARK = { tile: "#4ccfd0", ink: "#04252a" } as const;

export type BrandColors = { tile: string; ink: string };

/** Inner SVG markup (no <svg> wrapper) with explicit colours — shared by the
 *  flat SVG/PNG builders. The React <BrandMark> renders the same geometry from
 *  the exported constants above. */
export function brandMarkInner({ tile, ink }: BrandColors): string {
  const t = BRAND_TILE;
  return (
    `<rect x="${t.x}" y="${t.y}" width="${t.size}" height="${t.size}" rx="${t.rx}" fill="${tile}" />` +
    `<path d="${BRAND_HIGHLIGHT_PATH}" fill="#fff" opacity=".08" />` +
    `<path d="${BRAND_PULSE_PATH}" fill="none" stroke="${ink}" stroke-width="${BRAND_PULSE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/** Standalone flat SVG (single colour pair) — embedded as a data: URI inside the
 *  next/og image routes (apple-icon, maskable, opengraph-image). */
export function brandMarkSvg(colors: BrandColors = BRAND_LIGHT): string {
  return `<svg viewBox="${BRAND_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${brandMarkInner(colors)}</svg>`;
}

/** Themed standalone SVG for the browser-tab icon (app/icon.svg): a
 *  prefers-color-scheme swap that a raster app-icon cannot do. Written to
 *  app/icon.svg by scripts/generate-brand-assets.ts (verified in verify:cheap). */
export function brandIconSvg(): string {
  const t = BRAND_TILE;
  return `<svg viewBox="${BRAND_VIEWBOX}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .tile { fill: ${BRAND_LIGHT.tile}; }
    .pulse { stroke: ${BRAND_LIGHT.ink}; }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${BRAND_DARK.tile}; }
      .pulse { stroke: ${BRAND_DARK.ink}; }
    }
  </style>
  <rect class="tile" x="${t.x}" y="${t.y}" width="${t.size}" height="${t.size}" rx="${t.rx}" />
  <path d="${BRAND_HIGHLIGHT_PATH}" fill="#fff" opacity=".08" />
  <path class="pulse" d="${BRAND_PULSE_PATH}" fill="none" stroke-width="${BRAND_PULSE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;
}
