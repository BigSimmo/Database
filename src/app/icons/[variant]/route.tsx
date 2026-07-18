import { ImageResponse } from "next/og";

import { BRAND_ICON_FIELD, BRAND_MONOCHROME, BrandIconImage } from "@/lib/brand-image";

// PWA icon set referenced by app/manifest.ts. "any" icons are transparent so the
// mark's own rounded tile shows; "maskable" icons are full-bleed teal with the
// mark inside the ~72% safe zone so platform circular/rounded masks don't crop it;
// "monochrome" icons are a white alpha-only silhouette that platforms recolour.
const VARIANTS = {
  "icon-192": { size: 192, background: "transparent", inset: 1 },
  "icon-512": { size: 512, background: "transparent", inset: 1 },
  "maskable-192": { size: 192, background: BRAND_ICON_FIELD, inset: 0.72 },
  "maskable-512": { size: 512, background: BRAND_ICON_FIELD, inset: 0.72 },
  "monochrome-192": { size: 192, background: "transparent", inset: 1, colors: BRAND_MONOCHROME },
  "monochrome-512": { size: 512, background: "transparent", inset: 1, colors: BRAND_MONOCHROME },
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const conf = VARIANTS[variant as keyof typeof VARIANTS];
  if (!conf) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <BrandIconImage
      size={conf.size}
      background={conf.background}
      inset={conf.inset}
      colors={"colors" in conf ? conf.colors : undefined}
    />,
    { width: conf.size, height: conf.size },
  );
}
