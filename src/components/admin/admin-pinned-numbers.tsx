"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AdminPinButton } from "@/components/admin/admin-pin-button";
import { ADMIN_PAGE_HREFS } from "@/components/admin/admin-page-sections";
import { focusRing } from "@/components/card-recipes";
import { ModeDialRow } from "@/components/mode-kit/dial-row";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { cn, textMuted } from "@/components/ui-primitives";
import type { AdminHelpItem } from "@/lib/admin/help-items";
import { displayPhoneNumber } from "@/lib/admin/phone-display";
import { useAdminPins } from "@/lib/admin/pins";
import { onCallTelHref } from "@/lib/on-call/home-modules";

/** The pinned items still present in `items`, in pin order. A pin whose row has gone is skipped, not shown. */
export function pinnedHelpItems(pins: readonly string[], items: readonly AdminHelpItem[]): AdminHelpItem[] {
  return pins.flatMap((id) => {
    const item = items.find((candidate) => candidate.entry?.id === id);
    return item ? [item] : [];
  });
}

/**
 * "Pinned": the numbers the doctor pinned on Help, shown under the crisis lines
 * (never above them) and on Today. A row with a number dials; a row without one
 * opens its full entry on Help. Renders nothing until something is pinned.
 */
export function AdminPinnedNumbers({ items, testId }: { items: readonly AdminHelpItem[]; testId: string }) {
  const pinned = pinnedHelpItems(useAdminPins(), items);
  if (pinned.length === 0) return null;
  return (
    <ModeGroupedList eyebrow="Pinned" testId={testId}>
      {pinned.map((item) => {
        const id = item.entry?.id as string;
        const tel = onCallTelHref(item.phone ?? undefined);
        const unpin = <AdminPinButton entryId={id} title={item.title} testId={`${testId}-${item.key}-pin`} />;
        if (item.phone && tel) {
          return (
            <ModeDialRow
              key={item.key}
              testId={`${testId}-${item.key}`}
              label={item.title}
              subtitle={item.detail ?? undefined}
              number={{ display: displayPhoneNumber(item.phone, "own-list"), tel }}
              trailingAction={unpin}
            />
          );
        }
        return (
          <li key={item.key} className="flex min-h-12 items-center gap-1 pl-3" data-testid={`${testId}-${item.key}`}>
            <Link
              href={`${ADMIN_PAGE_HREFS.help}#${onCallEntryAnchorId(id)}`}
              className={cn(focusRing, "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-sm")}
            >
              <span className="grid min-w-0">
                <span className="break-words text-sm font-medium text-[color:var(--text-heading)]">{item.title}</span>
                {item.detail ? <span className={cn(textMuted, "break-words text-xs")}>{item.detail}</span> : null}
              </span>
              <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
            </Link>
            {unpin}
          </li>
        );
      })}
    </ModeGroupedList>
  );
}
