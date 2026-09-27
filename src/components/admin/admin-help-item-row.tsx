import { Pencil } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { ExternalTextLink } from "@/components/ui/link";
import { cn, textMuted, toolbarButton } from "@/components/ui-primitives";
import { displayPhoneNumber } from "@/lib/admin/phone-display";
import { formatUpdatedMonth } from "@/lib/admin/renewal-dates";
import type { AdminHelpItem } from "@/lib/admin/help-items";
import { onCallTelHref } from "@/lib/on-call/home-modules";

/** "Yours", "Shared by another doctor" or "Statewide", each with its own date or "No date recorded". */
function provenanceLine(source: AdminHelpItem["source"], updatedOn: string | null): string {
  const who = source === "you" ? "Yours" : source === "shared" ? "Shared by another doctor" : "Statewide";
  return `${who} · ${updatedOn ? `Updated ${formatUpdatedMonth(updatedOn)}` : "No date recorded"}`;
}

/**
 * One Help row (a support service, an own or shared logistics entry, or a
 * workforce contact). Own rows (`source: "you"`) get an Edit control; shared
 * and statewide rows have none. A row backed by a stored entry carries
 * `onCallEntryAnchorId`, so a redirected bookmark still lands on it.
 */
export function AdminHelpItemRow({ item, onEdit }: { item: AdminHelpItem; onEdit?: (item: AdminHelpItem) => void }) {
  const telHref = onCallTelHref(item.phone ?? undefined);
  return (
    <li
      id={item.entry ? onCallEntryAnchorId(item.entry.id) : undefined}
      tabIndex={item.entry ? -1 : undefined}
      className="flex min-w-0 items-stretch gap-2 border-b border-[color:var(--border)] px-3 py-2 last:border-b-0"
      data-testid={`admin-help-item-${item.key}`}
    >
      <div className="grid min-w-0 flex-1 gap-0.5 self-center">
        <span className="break-words text-sm font-medium text-[color:var(--text-heading)]">{item.title}</span>
        {item.detail ? <span className={cn(textMuted, "break-words text-sm")}>{item.detail}</span> : null}
        {item.phone ? (
          <a
            href={telHref ?? `tel:${item.phone}`}
            className={cn(focusRing, "nums inline w-fit break-words rounded-sm text-sm text-[color:var(--text)]")}
          >
            {displayPhoneNumber(item.phone, "own-list")}
          </a>
        ) : null}
        {item.url ? (
          <ExternalTextLink href={item.url} className="inline-flex w-fit min-h-tap items-center text-xs">
            More info
          </ExternalTextLink>
        ) : null}
        <span className={cn(textMuted, "text-xs")}>{provenanceLine(item.source, item.updatedOn)}</span>
      </div>
      {item.source === "you" && onEdit ? (
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Edit ${item.title}`}
            data-testid={`admin-help-item-${item.key}-edit`}
            className={cn(toolbarButton, "shrink-0")}
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </li>
  );
}
