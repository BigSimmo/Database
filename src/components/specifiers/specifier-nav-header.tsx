"use client";

import { FileCheck2, Info, ListChecks, Tags } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";

/**
 * Both specifier detail shapes — the full record and the catalogue reference —
 * render the same four anchors, so they share one declaration. The reference
 * page renders `specifier-fit` only when it has enrichment data; a section whose
 * anchor is absent is dropped by `useInPageSectionNav`, so nothing here needs to
 * know that.
 *
 * Ids and labels carried over verbatim from `specifierSections` in the pill rail
 * this replaces.
 */
export const specifierNavSections: readonly PageSection[] = [
  { id: "specifier-overview", label: "Overview", icon: Tags },
  { id: "specifier-fit", label: "Fit & exclusions", icon: ListChecks },
  { id: "specifier-wording", label: "Wording / coding", icon: FileCheck2 },
  { id: "specifier-evidence", label: "Evidence / source", icon: Info },
];

/**
 * The client half of the specifier pages, which are Server Components: sections
 * carry `LucideIcon` values and the header needs hooks, neither of which crosses
 * the RSC boundary. `actions` does, as server-rendered JSX passed to a slot.
 */
export function SpecifierNavHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(specifierNavSections);

  return (
    <InPageNavHeader
      back={{ href: consolidatedModeSearchPath("specifiers"), label: "Specifiers" }}
      title={title}
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      actions={actions}
      actionsNoun="specifier"
      actionsDescription="Choose how to use this specifier."
      testIdPrefix="specifier"
    />
  );
}
