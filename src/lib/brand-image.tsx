// Server-only helpers for rendering the brand mark inside next/og ImageResponse
// routes (apple-icon, PWA maskable/any icons, opengraph-image). All derive from
// the single geometry source in ./brand-mark so raster app icons never drift
// from the in-app mark or the favicon.
import { BRAND_LIGHT, brandMarkSvg, type BrandColors } from "@/lib/brand-mark";

/** Teal field used behind full-bleed (apple / maskable) icons. */
export const BRAND_ICON_FIELD = BRAND_LIGHT.tile;

/** Single-colour palette for manifest `monochrome` icons: platforms read only
 *  the alpha channel and recolour the silhouette themselves, so the tile and
 *  ink collapse into one white glyph on a transparent field. */
export const BRAND_MONOCHROME: BrandColors = { tile: "#ffffff", ink: "#ffffff" };

/** data: URI of the flat brand-mark SVG for <img> inside ImageResponse. Satori
 *  rasterises the SVG server-side, so no browser CSP or network is involved.
 *  `#` in colours is percent-encoded by encodeURIComponent. */
export function brandMarkDataUri(colors: BrandColors = BRAND_LIGHT): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(colors))}`;
}

/**
 * A square brand-icon element for ImageResponse.
 * - `background: "transparent"` + `inset: 1` → the mark's own rounded tile shows
 *   (PWA "any" purpose).
 * - opaque `background` + `inset < 1` → full-bleed field with the mark centred in
 *   the safe zone (apple-icon, PWA "maskable" purpose).
 */
export function BrandIconImage({
  size,
  background = "transparent",
  inset = 1,
  colors = BRAND_LIGHT,
}: {
  size: number;
  background?: string;
  inset?: number;
  colors?: BrandColors;
}) {
  const px = Math.round(size * inset);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
      }}
    >
      <img src={brandMarkDataUri(colors)} width={px} height={px} alt="" />
    </div>
  );
}
