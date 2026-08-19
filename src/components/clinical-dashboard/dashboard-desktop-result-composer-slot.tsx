"use client";

import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { modeHomeComposerReservePendingValue } from "@/lib/mode-home-composer";

export function DashboardDesktopResultComposerSlot({ slotId }: { slotId?: string }) {
  if (!slotId) return null;
  return (
    <DesktopComposerPortalSlot
      id={slotId}
      data-testid="desktop-page-search-composer-slot"
      data-composer-reserve={modeHomeComposerReservePendingValue}
      className="hidden sm:block sm:min-h-0 sm:data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-wide)] sm:[&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-wide)]"
    />
  );
}
