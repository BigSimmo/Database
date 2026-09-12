"use client";

import { Ellipsis, Lock, Printer, Tag } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { inPageActionRowClass } from "@/components/in-page-nav/in-page-nav-classes";
import { UniversalHeaderTrailingPortal } from "@/components/clinical-dashboard/universal-header-trailing-portal";
import { ON_CALL_VIEW_TITLES, type OnCallPageView } from "@/components/on-call/on-call-section-identity";
import { Sheet } from "@/components/ui/sheet";
import { cn, textMuted } from "@/components/ui-primitives";
import { ON_CALL_HOME_TAGS } from "@/lib/on-call/home-modules";

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
}: {
  /** The page this menu belongs to, or `"home"` for the dashboard. */
  view: OnCallPageView | "home";
  /** How many entries the page is showing, for the sheet's one-line summary. */
  entryCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const title = view === "home" ? "On Call" : ON_CALL_VIEW_TITLES[view];
  const summary =
    typeof entryCount === "number"
      ? `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`
      : "Everything this shift needs, in one place.";

  return (
    <>
      <UniversalHeaderTrailingPortal>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Open ${title} actions`}
          data-testid="on-call-page-menu-trigger"
          className={cn(
            "universal-header-icon-control inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-full",
            "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition",
            "hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          )}
        >
          <Ellipsis aria-hidden="true" className="size-icon-lg" strokeWidth={2.25} />
        </button>
      </UniversalHeaderTrailingPortal>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={summary}
        closeLabel="Close actions"
        returnFocusRef={triggerRef}
        portal
        testId="on-call-page-menu-sheet"
      >
        <div className="grid gap-2">
          <Link
            href="/on-call/card"
            onClick={() => setOpen(false)}
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
          <div
            className={cn(inPageActionRowClass, "cursor-default font-normal")}
            data-testid="on-call-page-menu-privacy"
          >
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
                {`Tag a contact "${ON_CALL_HOME_TAGS.callFirst}" or "${ON_CALL_HOME_TAGS.ward}", or a playbook scenario "${ON_CALL_HOME_TAGS.pinned}", to put it on the home.`}
              </span>
            </span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
