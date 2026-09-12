"use client";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { BrowserPrintButton } from "@/components/ui/print-output";

/**
 * The essentials card's header — the mode's one remaining `InPageNavHeader`.
 *
 * The six section pages used to mount one of these too. They now carry the
 * shared `ModeNav` rail instead (`RegistryModeNav`, mounted by
 * `OnCallSectionPage`), which is what the 2026-09-04 design spec §8.3 always
 * intended and what gives the mode a rail its sections can navigate between.
 * The card keeps this template because it is not a peer section: it is a print
 * output reached from the rail, and it needs the two things the rail has no
 * place for — a back control and an actions sheet holding the print row.
 *
 * It lives here rather than in `on-call-card.tsx` because
 * `tests/mode-nav-addon-slot.dom.test.tsx` pins one claimant file per mode:
 * every route that claims the phone header's addon slot registers that claim in
 * its mode's `*-nav-header.tsx` sibling, so the set of pages competing for the
 * single collapse owner can be read off a list of files rather than discovered
 * by grepping every page component. The card briefly mounted `InPageNavHeader`
 * itself and turned that test red.
 *
 * `back` targets `/on-call`, the mode's dashboard. It used to target
 * `consolidatedModeSearchPath("on-call")` because `/on-call` was a redirect stub
 * that rendered nothing to land on; it is now the mode home, and that helper
 * throws for a mode outside the consolidated map.
 *
 * The print control sits in the actions sheet, following `DictionaryTermPage` —
 * the one place every converted information page keeps its print row.
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
