"use client";

import { ClipboardList, ListChecks, MessageSquareText, Signpost, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { dsmSearchHref } from "@/lib/app-modes";

/**
 * Ids and labels carried over from `dsmDiagnosisSections` in the pill rail this
 * replaces — with the two anchors it declared but the page never rendered now
 * wired in (`key-features`, `record-summary`, `dsm-diagnosis-page.tsx`). Before
 * that, three of these five resolved and the route drew a three-item rail.
 *
 * `key-features` is still conditional on the record carrying both key features
 * and criteria display text; `useInPageSectionNav` drops a section whose anchor
 * is not rendered, so a record without them shows four entries rather than a
 * dead one.
 */
export const dsmDiagnosisNavSections: readonly PageSection[] = [
  { id: "criteria", label: "Criteria", icon: ListChecks },
  { id: "key-features", label: "Key features", icon: Signpost },
  { id: "specifiers", label: "Specifiers", icon: SlidersHorizontal },
  { id: "documentation", label: "Documentation", icon: MessageSquareText },
  { id: "record-summary", label: "Record summary", icon: ClipboardList },
];

/**
 * The client half of `DsmDiagnosisPage`, which is a Server Component.
 *
 * `criteriaLabel` follows the record's criteria provenance: 145 of the 146
 * records supply no `criteria_display`, so on those the first section holds a
 * key-feature summary and is labelled as one. There is no collision with the
 * separate `key-features` section, which renders only when the record carries
 * both — i.e. only where this label stays "Criteria".
 */
export function DsmDiagnosisNavHeader({
  title,
  actions,
  criteriaLabel = "Criteria",
}: {
  title: string;
  actions?: ReactNode;
  criteriaLabel?: string;
}) {
  const navSections = dsmDiagnosisNavSections.map((section) =>
    section.id === "criteria" ? { ...section, label: criteriaLabel } : section,
  );
  const { sections, activeId, selectSection } = useInPageSectionNav(navSections);

  return (
    <InPageNavHeader
      back={{ href: dsmSearchHref, label: "DSM-5" }}
      title={title}
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      actions={actions}
      actionsNoun="diagnosis"
      actionsDescription="Choose how to use this diagnosis record."
      testIdPrefix="dsm-diagnosis"
    />
  );
}
