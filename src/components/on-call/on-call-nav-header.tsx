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
 * narrowed by `useInPageSectionNav` to the ones actually rendered — so a flat
 * page (Referrals, Orientation, Teaching) resolves to none and the header drops
 * back to being a title with a back control and an actions sheet. That is the
 * behaviour, not a special case.
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
        back={{ href: "/on-call", label: "On Call" }}
        title={title}
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
      back={{ href: "/on-call", label: "On Call" }}
      title={title}
      sections={resolved}
      activeId={activeId}
      onSelectSection={selectSection}
      testIdPrefix={ON_CALL_SECTION_HEADER_PREFIX}
      actionsTitle={`${title} actions`}
      actionsDescription={actionsDescription}
      actionsNoun="page"
      actions={actions}
    />
  );
}
