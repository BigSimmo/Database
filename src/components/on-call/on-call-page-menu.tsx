"use client";

import { Check, Ellipsis, Lock, Plus, Printer, Tag } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { inPageActionRowClass } from "@/components/in-page-nav/in-page-nav-classes";
import { UniversalHeaderTrailingPortal } from "@/components/clinical-dashboard/universal-header-trailing-portal";
import { ON_CALL_VIEW_TITLES, type OnCallPageView } from "@/components/on-call/on-call-section-identity";
import { OnCallNotificationsPanel } from "@/components/on-call/on-call-notifications";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { type OnCallContactsOrder } from "@/components/on-call/on-call-contacts-section";
import { ON_CALL_HOME_TAGS } from "@/lib/on-call/home-modules";
import { type OnCallNotification } from "@/lib/on-call/notifications";
import { type ReminderType } from "@/lib/reminders/settings";

/**
 * The page menu's rows, without a trigger or a sheet of its own.
 *
 * The section pages hand these to `InPageNavHeader`'s actions slot, which owns
 * the ellipsis and the sheet — one header row for the whole page. The mode home
 * has no in-page header, so it keeps `OnCallPageMenu` below, which wraps the
 * same rows in its own trigger and portals that into the universal header.
 * Splitting them is what stops the two surfaces drifting into different menus.
 */
export function OnCallPageMenuActions({
  order,
  onOrderChange,
  onAdd,
  addLabel,
  addHint,
  onVerifyAll,
  staleCount = 0,
  onNavigate,
}: {
  order?: OnCallContactsOrder;
  onOrderChange?: (next: OnCallContactsOrder) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** The line under `addLabel`. Omitted on a page with nothing useful to say. */
  addHint?: string;
  onVerifyAll?: () => void;
  staleCount?: number;
  /** Closes whichever surface is hosting these rows. */
  onNavigate?: () => void;
}) {
  return (
    <div className="grid gap-2">
      {order && onOrderChange ? (
        <div className="grid gap-1.5 pb-1" data-testid="on-call-page-menu-order">
          {/* Inside the sheet, not inline above the list: at phone width
                  the shared header puts a segmented control here rather than
                  claiming a band of its own, which is board 05's own note. */}
          <p className={cn(eyebrowText)} id="on-call-page-menu-order-label">
            Order
          </p>
          <SegmentedControl
            value={order}
            onChange={onOrderChange}
            ariaLabelledBy="on-call-page-menu-order-label"
            options={[
              { value: "role", label: "By role" },
              { value: "area", label: "By area" },
              { value: "overdue", label: "Overdue first" },
            ]}
          />
        </div>
      ) : null}

      {onAdd ? (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onAdd();
          }}
          className={inPageActionRowClass}
          data-testid="on-call-page-menu-add"
        >
          <Plus aria-hidden="true" className="size-icon-md shrink-0" />
          <span className="grid gap-0.5">
            <span>{addLabel ?? "Add an entry"}</span>
            {/* Per page, and absent where a page has nothing of its own to
                say. "Role first, name only if you must." was rendered under
                every add control in the mode, so the Compliance sheet read
                "Add requirement / Role first, name only if you must." —
                advice about naming other people, on the page holding your own
                registration. The page owns these strings (`ON_CALL_ADD_HINT`
                in `on-call-section-page.tsx`), next to the noun they sit
                under, so the two halves of one label cannot drift apart. */}
            {addHint ? <span className={cn(textMuted, "text-xs font-normal")}>{addHint}</span> : null}
          </span>
        </button>
      ) : null}

      {/* Offered only where the host passes `onVerifyAll`. Compliance
          deliberately does not — see the note on `offersBulkVerify` in
          `on-call-section-page.tsx`, which is where every view-by-view
          decision in this mode is made. */}
      {onVerifyAll && staleCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onVerifyAll();
          }}
          className={inPageActionRowClass}
          data-testid="on-call-page-menu-verify-all"
        >
          <Check aria-hidden="true" className="size-icon-md shrink-0" />
          <span className="grid gap-0.5">
            <span>Mark all as still correct</span>
            {/* The consequence, in the number it actually applies to.
                    "Stamps today on 42 entries" when only three are overdue
                    would be a lie about a write. */}
            <span className={cn(textMuted, "text-xs font-normal")}>
              {`Stamps today on ${staleCount} overdue ${staleCount === 1 ? "entry" : "entries"}.`}
            </span>
          </span>
        </button>
      ) : null}

      <Link
        href="/on-call/card"
        onClick={() => onNavigate?.()}
        className={inPageActionRowClass}
        data-testid="on-call-page-menu-card"
      >
        <Printer aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="grid gap-0.5">
          <span>Pocket card</span>
          {/* Every action states its consequence, so nothing surprises the
                  reader after the tap. */}
          <span className={cn(textMuted, "text-xs font-normal")}>
            One printable page. Excludes private and overdue entries.
          </span>
        </span>
      </Link>

      {/* Not a control: an explanation, in the place a reader looks when they
              wonder why something is missing. Making it a toggle would imply a
              private entry can be shown to someone who is not signed in, which is
              the one thing the shared read guarantees cannot happen. */}
      <div className={cn(inPageActionRowClass, "cursor-default font-normal")} data-testid="on-call-page-menu-privacy">
        <Lock aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="grid gap-0.5">
          <span className="font-bold">Private entries are yours alone</span>
          <span className={cn(textMuted, "text-xs")}>
            An entry marked private is visible only when you are signed in, never on the printed card, and never to
            anyone else.
          </span>
        </span>
      </div>

      <div className={cn(inPageActionRowClass, "cursor-default font-normal")} data-testid="on-call-page-menu-tags">
        <Tag aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="grid gap-0.5">
          <span className="font-bold">What the home shows</span>
          <span className={cn(textMuted, "text-xs")}>
            {`Tick "Call first on the home" when editing a contact. Tag a contact "${ON_CALL_HOME_TAGS.switchboard}" or "${ON_CALL_HOME_TAGS.ward}", or a playbook scenario "${ON_CALL_HOME_TAGS.pinned}", to put it on the home too.`}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The page menu, in the universal header's right-hand slot.
 *
 * The build prompt's §2.2: this mode's right-hand control is the page menu
 * rather than "new chat", which means nothing here. The button wears the same
 * bordered round treatment the control it replaces does, so the row still reads
 * as one system — the only thing that changed is what the button opens.
 *
 * What it holds is deliberately narrow. Per-entry actions (edit, verify, add)
 * live on the rows themselves, where the thing being acted on is; this carries
 * the two page-level facts a reader needs and cannot get from a row — where the
 * printable card is, and what makes an entry private. The site switcher joins it
 * with the sites table.
 */
export function OnCallPageMenu({
  view,
  entryCount,
  order,
  onOrderChange,
  onAdd,
  addLabel,
  addHint,
  onVerifyAll,
  staleCount = 0,
  summary,
  notifications,
  onSnoozeNotifications,
}: {
  /** The page this menu belongs to, or `"home"` for the dashboard. */
  view: OnCallPageView | "home";
  /** How many entries the page is showing, for the sheet's one-line summary. */
  entryCount?: number;
  /**
   * Overrides that one-liner. The section pages append the sentence explaining
   * how the page is filed — it used to sit in a hero above the list, and a
   * thing you read once belongs where you go looking for it rather than in
   * permanent chrome.
   */
  summary?: string;
  /** Contacts only: the order control the drawing puts at the top of the sheet. */
  order?: OnCallContactsOrder;
  onOrderChange?: (next: OnCallContactsOrder) => void;
  /** Opens the editor in create mode. Omitted when the viewer cannot write. */
  onAdd?: () => void;
  /** What one entry in this view is called, e.g. "Add a contact". */
  addLabel?: string;
  /** This view's own line under `addLabel`. Omitted where a view has none. */
  addHint?: string;
  /**
   * Stamps today on every overdue entry in this view. Omitted when nothing is
   * overdue, when the viewer cannot write, and on Compliance, where a bulk
   * freshness stamp is not a defensible action at all.
   */
  onVerifyAll?: () => void;
  staleCount?: number;
  /**
   * What this hub is asking its owner to deal with, already derived.
   *
   * Passed in rather than computed here because this component has an entry
   * COUNT, not the entries, and because a second `useOnCallEntries` mount would
   * fetch `/api/on-call/entries` a second time on every page that renders this
   * header. The caller already holds the list.
   */
  notifications?: readonly OnCallNotification[];
  /** Snoozes one reminder type for a week; passed through to the notification list. */
  onSnoozeNotifications?: (type: ReminderType) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const title = view === "home" ? "On Call" : ON_CALL_VIEW_TITLES[view];
  const notificationCount = notifications?.length ?? 0;
  const description =
    summary ??
    (typeof entryCount === "number"
      ? `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`
      : "Everything this shift needs, in one place.");

  return (
    <>
      <UniversalHeaderTrailingPortal>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          // The count is in the label, not only in the badge: a screen reader
          // gets the number without having to reach a decorative dot.
          aria-label={
            notificationCount > 0
              ? `Open ${title} actions. ${notificationCount} ${notificationCount === 1 ? "item needs" : "items need"} attention.`
              : `Open ${title} actions`
          }
          data-testid="on-call-page-menu-trigger"
          className={cn(
            "universal-header-icon-control relative inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-full",
            "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition",
            "hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          )}
        >
          <Ellipsis aria-hidden="true" className="size-icon-lg" strokeWidth={2.25} />
          {notificationCount > 0 ? (
            <span
              aria-hidden="true"
              data-testid="on-call-page-menu-notification-count"
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1",
                "bg-[color:var(--command)] text-3xs font-bold leading-4 text-[color:var(--command-contrast)]",
              )}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null}
        </button>
      </UniversalHeaderTrailingPortal>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        closeLabel="Close actions"
        returnFocusRef={triggerRef}
        portal
        testId="on-call-page-menu-sheet"
      >
        {/* Above the actions, because it is the only thing in this sheet the
            page is raising on its own rather than offering on request. */}
        {notifications ? (
          <div className="mb-4">
            <OnCallNotificationsPanel
              notifications={notifications}
              onNavigate={() => setOpen(false)}
              onSnooze={onSnoozeNotifications}
            />
          </div>
        ) : null}

        <OnCallPageMenuActions
          order={order}
          onOrderChange={onOrderChange}
          onAdd={onAdd}
          addLabel={addLabel}
          addHint={addHint}
          onVerifyAll={onVerifyAll}
          staleCount={staleCount}
          onNavigate={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
