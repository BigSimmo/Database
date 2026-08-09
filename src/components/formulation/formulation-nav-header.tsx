"use client";

import { Info, Layers, ListChecks, Network, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { appModeHomeHref } from "@/lib/app-modes";

/** Ids and labels carried over verbatim from `formulationSections` in the pill rail this replaces. */
export const formulationNavSections: readonly PageSection[] = [
  { id: "formulation-overview", label: "Overview", icon: Network },
  { id: "formulation-what-matters-now", label: "What matters now", icon: Sparkles },
  { id: "formulation-fit", label: "Fit", icon: ListChecks },
  { id: "formulation-five-ps", label: "5 Ps", icon: Layers },
  { id: "formulation-treatment", label: "Treatment leverage", icon: Target },
  { id: "formulation-evidence", label: "Evidence / source", icon: Info },
];

/** The client half of `FormulationMechanismPage`, which is a Server Component. */
export function FormulationNavHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(formulationNavSections);

  return (
    <InPageNavHeader
      back={{ href: appModeHomeHref("formulation"), label: "Formulation" }}
      title={title}
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      actions={actions}
      actionsNoun="mechanism"
      actionsDescription="Choose how to use this mechanism."
      testIdPrefix="formulation"
    />
  );
}
