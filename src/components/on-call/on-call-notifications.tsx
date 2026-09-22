"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ON_CALL_SECTION_HREFS, ON_CALL_VIEW_HREFS } from "@/components/on-call/on-call-section-identity";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { type OnCallNotification } from "@/lib/on-call/notifications";

/**
 * What this hub is asking its owner to deal with.
 *
 * ## Why this is a panel and not a second header button
 *
 * `UniversalHeaderTrailingPortal` says in its own docblock that it moves *one*
 * page-owned control into the header, and that `globals.css` stands the
 * new-chat button down "so the region still holds exactly one control". A
 * second portalled button would render — two `createPortal` calls append to the
 * same host — but it would put two controls in a region documented to hold one,
 * on a phone header that was never laid out for two.
 *
 * So the page menu keeps the single trigger and grows a count, and this list
 * opens inside the sheet that trigger already opens. The ellipsis also holds
 * "Add an entry", which on an empty hub is the only way to put anything in;
 * taking that slot for notifications would have left a reader no way to add a
 * row.
 *
 * ## Why the list is derived rather than stored
 *
 * See `src/lib/on-call/notifications.ts`. In short: every item here is already
 * a fact about an entry the reader is holding, so a stored copy could only
 * disagree with the page it points at.
 *
 * ## Nothing here asserts compliance
 *
 * A compliance item says the recorded date has passed and that the record is
 * worth checking. It never says lapsed, expired, valid or current, and there is
 * no tick — the reader may have renewed last week and not updated the row.
 * `recordedExpiryHasPassed` carries the same rule in its own docblock, and
 * `tests/on-call-notifications.test.ts` holds the wording to it.
 */
export function OnCallNotificationsPanel({
  notifications,
  onNavigate,
}: {
  notifications: readonly OnCallNotification[];
  /** Closes the sheet the list lives in, so a tap does not leave it open over
   *  the page it just navigated to. */
  onNavigate?: () => void;
}) {
  return (
    <section aria-labelledby="on-call-notifications-heading" className="grid gap-2">
      <h3 id="on-call-notifications-heading" className={eyebrowText}>
        Needs attention
      </h3>

      {notifications.length === 0 ? (
        <p className={cn("text-xs", textMuted)} data-testid="on-call-notifications-empty">
          Nothing right now. A requirement whose recorded date has passed, or an entry nobody has confirmed in a long
          time, appears here.
        </p>
      ) : (
        <ul className="grid gap-1" data-testid="on-call-notifications-list">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={hrefFor(notification)}
                onClick={onNavigate}
                data-testid={`on-call-notification-${notification.kind}`}
                className={cn(
                  "flex min-h-tap items-start gap-2 rounded-md px-2 py-2 no-underline",
                  "text-[color:var(--text)] transition-colors motion-reduce:transition-none",
                  "hover:bg-[color:var(--surface-subtle)]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                )}
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-semibold text-[color:var(--text-heading)]">{notification.title}</span>
                  <span className={cn("text-xs", textMuted)}>{notification.detail}</span>
                </span>
                <ChevronRight aria-hidden="true" className="ml-auto mt-0.5 size-icon-xs shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Where a notification goes.
 *
 * Compliance is a VIEW rather than a stored section, so it is looked up in the
 * view map. Everything else is a real section and uses the section map — which
 * is why `deriveOnCallNotifications` returns a section and a kind rather than a
 * URL: the maps live here, under `src/components`, and the derivation must not
 * reach into the component tree to read them.
 */
function hrefFor(notification: OnCallNotification): string {
  if (notification.kind === "compliance-date-passed") return ON_CALL_VIEW_HREFS.compliance;
  return ON_CALL_SECTION_HREFS[notification.section];
}
