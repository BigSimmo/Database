"use client";

import { CalendarDays, ClipboardList, Layers, ShieldAlert, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { appModeHomeHref } from "@/lib/app-modes";
import type { MedicationRecord, MedicationSection } from "@/lib/medications";

export const MEDICATION_TAB_IDS = ["summary", "dosing", "safety", "more"] as const;
export type MedicationTabId = (typeof MEDICATION_TAB_IDS)[number];

export function isMedicationTabId(value: string): value is MedicationTabId {
  return (MEDICATION_TAB_IDS as readonly string[]).includes(value);
}

/**
 * Which raw section types each tab claims.
 *
 * This lived inside `MedicationRecordDetail` as a `useMemo` over four inline
 * `Set`s. It moves here because it *is* the section index: the header's segment
 * weights and row details are derived from the same grouping the panel renders,
 * and two copies of it would drift into a track that no longer describes what a
 * tab contains.
 */
const tabSectionTypes: Record<MedicationTabId, ReadonlySet<string>> = {
  summary: new Set(["summary", "ind", "form"]),
  dosing: new Set(["dose"]),
  safety: new Set(["risk", "contra", "mon", "safe"]),
  more: new Set(["inter", "pearl", "evid", "spec", "comp", "sel", "src"]),
};

/**
 * Which tab panel holds a given catalogue section type.
 *
 * Derived from the same table the panels render, so a section that moves
 * between tabs cannot leave a "jump to this section" control pointing at the
 * tab it used to be in.
 */
export function medicationTabForSectionType(sectionType: string): MedicationTabId | null {
  const entry = (Object.entries(tabSectionTypes) as [MedicationTabId, ReadonlySet<string>][]).find(([, types]) =>
    types.has(sectionType),
  );
  return entry?.[0] ?? null;
}

export function medicationSectionsByTab(record: MedicationRecord): Record<MedicationTabId, MedicationSection[]> {
  return {
    summary: record.sections.filter((section) => tabSectionTypes.summary.has(section.type)),
    dosing: record.sections.filter((section) => tabSectionTypes.dosing.has(section.type)),
    safety: record.sections.filter((section) => tabSectionTypes.safety.has(section.type)),
    more: record.sections.filter((section) => tabSectionTypes.more.has(section.type)),
  };
}

/**
 * The medication record page's navigable sections.
 *
 * Ids carried over from the `SectionTabs` roving-tabindex tablist this replaces.
 * The final destination is labelled "Additional" so "More" can unambiguously
 * mean the Home/Therapy-style priority overflow control.
 *
 * Exported as the base table (the shape `docs/search-chrome-behaviour.md`
 * requires a nav-header sibling to own) with `buildMedicationNavSections` adding
 * the record-derived weight and detail on top. The ids are tab ids rather than
 * DOM anchor ids: these are discrete panels, so there is nothing to scroll to
 * and no `inPageAnchor` — the same model `differential-detail-page.tsx` uses.
 */
export const medicationNavSections: readonly PageSection[] = [
  { id: "summary", label: "Summary", icon: ClipboardList },
  { id: "dosing", label: "Dosing", icon: CalendarDays },
  { id: "safety", label: "Safety", icon: ShieldAlert },
  { id: "more", label: "Additional", icon: Layers },
];

/**
 * Raw weights before normalisation, anchored to how many sections each tab
 * actually holds so the track reads as proportion rather than as "which of
 * four". The floor keeps a tab with nothing in it visible and tappable-looking
 * — every tab is always offered, because a track whose length changed between
 * medications would read as a rendering bug — and the cap stops one dense tab
 * (Safety carries four section types) squeezing the rest to hairlines.
 */
function rawWeight(count: number): number {
  return Math.max(1, Math.min(5, count));
}

function plural(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/**
 * Builds the weighted section index for one medication. Pure and deterministic:
 * the same record always produces the same weights, so the track never shifts
 * between renders of the same page.
 *
 * Explicit weights rather than measured ones. `usePageSectionWeights` measures
 * rendered heights, and only the active panel is ever rendered here — measuring
 * would report one full-width segment and three empty ones.
 */
export function buildMedicationNavSections(record: MedicationRecord): PageSection[] {
  const byTab = medicationSectionsByTab(record);
  const weights = MEDICATION_TAB_IDS.map((id) => rawWeight(byTab[id].length));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return medicationNavSections.map((section, index) => {
    const count = byTab[section.id as MedicationTabId].length;
    return {
      ...section,
      count,
      detail: plural(count, "section"),
      weight: (weights[index] ?? 1) / total,
      // The trailing chevron in `DocumentSectionList` means "this row opens an
      // accordion". Selecting a tab swaps a panel instead, so never claim it.
      collapsible: false,
    };
  });
}

/**
 * The medication record page's in-page navigation.
 *
 * The page is already a Client Component, so this sibling is convention rather
 * than necessity — but it is the convention: `docs/search-chrome-behaviour.md`
 * pins the section table to a colocated nav-header sibling regardless of the
 * page's RSC boundary, so there is one answer to where the table lives and one
 * import path for the per-route contract test.
 */
export function MedicationNavHeader({
  title,
  record,
  activeTab,
  onSelectTab,
  onOpenPatientDetails,
  actions,
}: {
  title: string;
  /** Absent while the record is loading or unresolvable: no record, no sections. */
  record: MedicationRecord | null;
  activeTab: MedicationTabId;
  onSelectTab: (id: MedicationTabId) => void;
  /**
   * Opens the patient-details sheet. This is where the two cards that used to
   * sit in the page body now live — the entry point moved into the header, the
   * feature did not go anywhere.
   */
  onOpenPatientDetails: () => void;
  actions?: ReactNode;
}) {
  const back = { href: appModeHomeHref("prescribing"), label: "Medications" };
  const shared = {
    back,
    title,
    actions,
    actionsNoun: "medication" as const,
    actionsDescription: "Choose how to use this medication.",
    testIdPrefix: "medication" as const,
    // Icon-only at every width: a person glyph carries "patient" on its own, and
    // a labelled control here would push the group wide enough to squeeze the
    // record title on a phone.
    primaryAction: { label: "Patient details", icon: UserRound, onClick: onOpenPatientDetails },
    primaryActionIconOnly: true,
  };

  // No record means no sections to offer, so the header falls back to the
  // breadcrumb shape rather than drawing a four-segment rail over nothing.
  if (!record) return <InPageNavHeader {...shared} />;

  return (
    <InPageNavHeader
      {...shared}
      className="sm:border-b-[color:var(--border-lux)] sm:bg-[color:var(--surface-lux)] sm:py-3 sm:shadow-[var(--e1)]"
      sections={buildMedicationNavSections(record)}
      activeId={activeTab}
      onSelectSection={(id) => {
        if (isMedicationTabId(id)) onSelectTab(id);
      }}
      rail={{ label: "Medication sections" }}
    />
  );
}
