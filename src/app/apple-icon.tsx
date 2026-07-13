import { ImageResponse } from "next/og";

import { BRAND_ICON_FIELD, BrandIconImage } from "@/lib/brand-image";

// Fixes the appleWebApp.capable mismatch: without this, iOS "Add to Home
// Screen" falls back to a page screenshot. iOS masks corners and paints
// transparency black, so render a full-bleed opaque teal field.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandIconImage size={size.width} background={BRAND_ICON_FIELD} inset={0.82} />, {
    ...size,
  });
}
