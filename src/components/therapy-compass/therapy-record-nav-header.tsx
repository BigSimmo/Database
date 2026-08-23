"use client";

import Link from "next/link";
import { Clock, Compass, FileText, Heart, Printer, Scale, Search, X } from "lucide-react";

import { inPageActionRowClass } from "@/components/in-page-nav/in-page-nav-classes";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { therapyScreenHref } from "@/lib/therapy-compass-navigation";

import { useTcBindings } from "./bindings";
import { therapyBtn } from "./controls";
import type { Therapy } from "./data/types";

/**
 * The pages that belong to one therapy record, in the order the header rail
 * offers them.
 *
 * Deliberately *routes*, not in-page panels. Medications swap a panel because a
 * medication's dosing and safety are two views of one record; a therapy's
 * patient sheet and brief intervention are separately generated artefacts with
 * their own URLs, print behaviour and workspace state. `compare` is last
 * because it is the one destination that leaves this therapy's own pages.
 */
export const THERAPY_RECORD_DESTINATIONS = ["overview", "sheet", "brief", "compare"] as const;
export type TherapyRecordDestination = (typeof THERAPY_RECORD_DESTINATIONS)[number];

export function isTherapyRecordDestination(value: string): value is TherapyRecordDestination {
  return (THERAPY_RECORD_DESTINATIONS as readonly string[]).includes(value);
}

/**
 * Labels are short enough for a phone rail slot; the fuller name rides in
 * `detail`, which is what the section sheet shows on the right of each row.
 */
const DESTINATIONS: Record<TherapyRecordDestination, Omit<PageSection, "weight">> = {
  overview: { id: "overview", label: "Overview", icon: Compass, detail: "Full record" },
  sheet: { id: "sheet", label: "Info sheet", icon: FileText, detail: "Patient handout" },
  brief: { id: "brief", label: "Brief", icon: Clock, detail: "Brief intervention" },
  compare: { id: "compare", label: "Compare", icon: Scale, detail: "Side by side" },
};

/**
 * True when this record actually ships the artefact behind a destination.
 *
 * A therapy with no patient sheet gets a three-slot rail rather than a fourth
 * slot that routes to a 404. `docs/wiring-conventions.md` allows a stated-reason
 * placeholder, but a rail slot has nowhere to carry that reason — so the honest
 * shape here is to omit it, which is also what `useResolvedPageSections` does
 * for an anchor that is not rendered.
 */
function destinationAvailable(therapy: Therapy, destination: TherapyRecordDestination): boolean {
  if (destination === "sheet") return therapy.patientSheetAvailable;
  if (destination === "brief") return therapy.briefInterventionAvailable;
  return true;
}

/**
 * The record's navigable pages, with explicit equal weights.
 *
 * Explicit rather than measured: `usePageSectionWeights` measures rendered
 * heights, and a destination that is a separate route has no height on this
 * page at all — measurement would report one full-width segment.
 */
export function buildTherapyRecordNavSections(therapy: Therapy): PageSection[] {
  const available = THERAPY_RECORD_DESTINATIONS.filter((id) => destinationAvailable(therapy, id));
  const weight = 1 / available.length;
  return available.map((id) => ({ ...DESTINATIONS[id], weight }));
}

/**
 * Shared header for every page that belongs to one therapy record — the record
 * itself, its patient sheet and its brief intervention.
 *
 * It configures the repository's default in-page navigation template
 * (`InPageNavHeader`) and adds nothing of its own: no second sticky header, no
 * second scroll-hide owner, no second collapse portal. On a phone the whole
 * subtree is carried into the universal header's collapse row by the portal
 * `InPageNavHeader` already mounts, which is the single owner of that motion.
 */
export function TherapyRecordNavHeader({
  therapy,
  active,
  backHref,
  backLabel,
  testIdPrefix,
  saved,
  onToggleSave,
}: {
  therapy: Therapy;
  active: TherapyRecordDestination;
  backHref: string;
  backLabel: string;
  testIdPrefix: string;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const b = useTcBindings();
  const inCompare = b.isInCompare(therapy.slug);

  function goTo(destination: TherapyRecordDestination) {
    if (destination === active) return;
    if (destination === "overview") b.open(therapy.slug);
    else if (destination === "sheet") b.openSheet(therapy.slug);
    else if (destination === "brief") b.openBrief(therapy.slug);
    // `toggleCompare` adds the therapy and navigates; once it is already in the
    // set, toggling would remove it, so an established member just navigates.
    else if (inCompare) b.goCompare();
    else b.toggleCompare(therapy.slug);
  }

  return (
    <InPageNavHeader
      back={{ href: backHref, label: backLabel }}
      title={therapy.name}
      actionsNoun="therapy"
      actionsDescription="Choose how to use this therapy record."
      testIdPrefix={testIdPrefix}
      className="sm:border-b-[color:var(--border-lux)] sm:bg-[color:var(--surface-lux)] sm:py-3 sm:shadow-[var(--e1)]"
      // Save is the one action worth reaching at any scroll position: it is the
      // decision a reader makes *while* reading, where every other action here
      // is taken once, at the end. The label moves with the state, so the
      // pressed state never rests on the fill alone.
      primaryAction={{
        label: saved ? "Saved" : "Save",
        icon: Heart,
        onClick: onToggleSave,
        pressed: saved,
      }}
      primaryActionIconOnly
      sections={buildTherapyRecordNavSections(therapy)}
      activeId={active}
      onSelectSection={(id) => {
        if (isTherapyRecordDestination(id)) goTo(id);
      }}
      // Measured, not guessed: these four labels render without truncation from
      // 500px and clip at 430px, which is the 31rem `balanced-four` band almost
      // exactly. `compact-four` (23rem) does fit four slots on a large phone but
      // clips every one of them to "Overvi…"; medication's counted calibration
      // holds them back to 42rem. This is the band the labels actually need.
      rail={{ label: "Therapy record", density: "balanced-four" }}
      actions={(close) => (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              close();
              window.print();
            }}
            className={`${therapyBtn} ${inPageActionRowClass}`}
          >
            <Printer className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            Print this record
          </button>
          {inCompare ? (
            <button
              type="button"
              onClick={() => {
                close();
                b.removeCompare(therapy.slug);
              }}
              className={`${therapyBtn} ${inPageActionRowClass}`}
            >
              <X className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Remove from comparison
            </button>
          ) : null}
          <Link href={b.workspaceHref(therapyScreenHref("search"))} onClick={close} className={inPageActionRowClass}>
            <Search className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            All therapies
          </Link>
        </div>
      )}
    />
  );
}
