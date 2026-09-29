import { create } from "qrcode";
import { useMemo } from "react";

import { cn } from "@/components/ui-primitives";

/*
 * The check-in QR as one SVG path from the `qrcode` module matrix: no canvas,
 * no image, no innerHTML. Dark on light in every theme (`--teaching-qr-*`,
 * which U1 does not redefine for dark), because cameras need a light quiet
 * zone; `forced-color-adjust` stops high contrast repainting it.
 */
const QUIET_ZONE = 4;

export function qrModulePath(value: string): { path: string; size: number } {
  const qr = create(value, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { path, size: count + QUIET_ZONE * 2 };
}

export function CheckinQr({ value, label, className }: { value: string; label: string; className?: string }) {
  const drawn = useMemo(() => qrModulePath(value), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${drawn.size} ${drawn.size}`}
      shapeRendering="crispEdges"
      data-testid="teaching-checkin-qr"
      data-qr-value={value}
      className={cn("block aspect-square w-full forced-color-adjust-none", className)}
    >
      <rect width={drawn.size} height={drawn.size} className="fill-[color:var(--teaching-qr-light)]" />
      <path d={drawn.path} className="fill-[color:var(--teaching-qr-dark)]" />
    </svg>
  );
}
