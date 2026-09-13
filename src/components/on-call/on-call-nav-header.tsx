"use client";

import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { BrowserPrintButton } from "@/components/ui/print-output";

/**
 * The mode's in-page headers: one for the essentials card, one for the section
 * pages.
 *
 * Both live here because `tests/mode-nav-addon-slot.dom.test.tsx` pins one
 * claimant FILE per mode — every route that claims the phone header's addon
 * slot registers that claim in its mode's `*-nav-header.tsx` sibling, so the
 * set of pages competing for the single collapse owner can be read off a list
 * of files rather than discovered by grepping every page component. The card
 * briefly mounted `InPageNavHeader` itself and turned that test red.
 *
 * The section pages carried the shared `ModeNav` rail until the owner pointed
 * out what it was doing: the mode pill already opens On Call's nine pages, and
 * the rail listed the same nine underneath it. Two controls, one job, and
 * nothing at all helping a reader move around the page in front of them —
 * Contacts runs to six groups and several screens. So the rail is gone and this
 * template takes the row, listing the CURRENT PAGE's groups. Cross-page
 * navigation keeps its one home in the pill.
 *
 * `back` targets `/on-call`, the mode's dashboard. It used to target
 * `consolidatedModeSearchPath("on-call")` because `/on-call` was a redirect stub
 * that rendered nothing to land on; it is now the mode home, and that helper
 * throws for a mode outside the consolidated map.
 *
 * The card's print control sits in its actions sheet, following
 * `DictionaryTermPage` — the one place every converted information page keeps
 * its print row.
 */
export function OnCallCardNavHeader() {
  return (
    <InPageNavHeader
      back={{ href: "/on-call", label: "On Call" }}
      title="Essentials card"
      testIdPrefix="on-call-card"
      actionsTitle="Card actions"
      actionsDescription="Print the numbers flagged for this card."
      actionsNoun="card"
      actions={
        <div className="grid gap-1">
          <BrowserPrintButton label="Print card" />
        </div>
      }
    />
  );
}

/** The prefix `InPageNavHeader` composes this mode's header testids from. */
export const ON_CALL_SECTION_HEADER_PREFIX = "on-call-section";

/**
 * The three testids that header renders, written out rather than composed.
 *
 * Two records outside React read them as plain text — the mockup ledger's gate
 * scans this directory for testid literals, and the boards spec names them —
 * and an interpolated `${prefix}-detail-header` is invisible to both.
 * `tests/on-call-section-header-testids.test.ts` pins each one against the
 * prefix and against the suffixes `InPageNavHeader` actually emits, so the two
 * cannot drift apart quietly.
 */
export const ON_CALL_SECTION_HEADER_TEST_IDS = {
  header: "on-call-section-detail-header",
  sectionTrigger: "on-call-section-section-trigger",
  actionsTrigger: "on-call-section-actions-trigger",
} as const;

/**
 * The section pages' header.
 *
 * `sections` are the page's own groups, declared by `onCallPageSections` and
 * narrowed by `useInPageSectionNav` to the ones actually rendered — so a page
 * with nothing to group by (Teaching) resolves to none and the header is just
 * the page's name and its actions. That is the behaviour, not a special case.
 *
 * NO BACK CONTROL, deliberately. Every page in this mode is a destination in
 * the mode pill's own list — the hub included, as "Tonight" — so an arrow
 * pointing at the hub described a parent-child hierarchy that does not exist.
 * It also put a control that leaves the page at the head of a row whose entire
 * job is moving around INSIDE the page, which is the confusion this row was
 * built to end. The way out is the pill that got you here.
 *
 * `OnCallCardNavHeader` above keeps its arrow: the pocket card is reached by
 * an action ("Print the pocket card") as well as by the pill, and backing out
 * of an action is what an arrow is for.
 */
export function OnCallSectionNavHeader({
  title,
  sections,
  actions,
  actionsDescription,
}: {
  title: string;
  sections: readonly PageSection[];
  actions?: ReactNode;
  actionsDescription?: string;
}) {
  const { sections: resolved, activeId, selectSection } = useInPageSectionNav(sections);

  if (resolved.length === 0) {
    return (
      <InPageNavHeader
        title={title}
        // Phone only: this bar is portaled INTO the universal header's own
        // collapse slot, so its solid surface painted a second panel inside a
        // glass one and the two rows read as two objects with a seam between
        // them. Transparent lets one material carry both. It keeps its bottom
        // rule here — with no groups there is no track to draw the edge — and
        // from `sm` it is a standalone sticky bar with content scrolling
        // under it, so it keeps the opaque background too.
        className="max-sm:bg-transparent"
        testIdPrefix={ON_CALL_SECTION_HEADER_PREFIX}
        actionsTitle={`${title} actions`}
        actionsDescription={actionsDescription}
        actionsNoun="page"
        actions={actions}
      />
    );
  }

  return (
    <InPageNavHeader
      title={title}
      sections={resolved}
      activeId={activeId}
      onSelectSection={selectSection}
      // One line, not two. The mode pill directly above already switches this
      // mode's pages; a second stacked line of small text under the page name
      // read as more description rather than as the control it is.
      sectionLabelPlacement="inline"
      // Same material as the flat variant above, and no bottom rule on the
      // phone: the weighted track is the block's edge, and a hairline directly
      // above it drew the seam back in.
      className="max-sm:border-b-0 max-sm:bg-transparent"
      testIdPrefix={ON_CALL_SECTION_HEADER_PREFIX}
      actionsTitle={`${title} actions`}
      actionsDescription={actionsDescription}
      actionsNoun="page"
      actions={actions}
    />
  );
}
