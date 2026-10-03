"use client";

import { Pin, PinOff } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/primitive-recipes/feedback";
import { cn, textMuted } from "@/components/ui-primitives";
import { setAdminPinned, useAdminPins } from "@/lib/admin/pins";

/**
 * Pins one stored row to the top of Help and to Today (owner decision,
 * 2026-10-01). Only the row id is kept, on this device. When the device refuses
 * the write (private browsing, storage full) the button says so instead of
 * pretending the pin took.
 */
export function AdminPinButton({ entryId, title, testId }: { entryId: string; title: string; testId: string }) {
  const pins = useAdminPins();
  const pinned = pins.includes(entryId);
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center">
      <IconButton
        label={pinned ? `Unpin ${title}` : `Pin ${title}`}
        icon={pinned ? PinOff : Pin}
        aria-pressed={pinned}
        data-testid={testId}
        className={cn(pinned ? "text-[color:var(--text-heading)]" : textMuted)}
        onClick={() => setFailed(!setAdminPinned(entryId, !pinned))}
      />
      <span role="status" className="sr-only">
        {failed ? "This device could not save the pin." : ""}
      </span>
    </span>
  );
}
