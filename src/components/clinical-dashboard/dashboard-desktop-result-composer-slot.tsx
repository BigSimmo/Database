"use client";

import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";

export function DashboardDesktopResultComposerSlot({ slotId }: { slotId?: string }) {
  if (!slotId) return null;
  return (
    <DesktopComposerPortalSlot
      id={slotId}
      data-testid="desktop-page-search-composer-slot"
      className="hidden lg:block lg:empty:hidden"
    />
  );
}
