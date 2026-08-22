"use client";

import { FlaskConical, ListChecks, Server, Stethoscope, BookOpen } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

/**
 * All four groups are declared in Phase 1, including panels that do not exist
 * yet. `useResolvedPageSections` drops any section whose anchor is not
 * rendered, so phases 2–4 need no navigation change — and an unbuilt group
 * produces no dead jump.
 */
export const developerHubNavSections: readonly PageSection[] = [
  { id: "developer-hub-environment", label: "Environment", icon: Server },
  { id: "developer-hub-work", label: "Work and decisions", icon: ListChecks },
  { id: "developer-hub-clinical", label: "Clinical trust", icon: Stethoscope },
  { id: "developer-hub-system", label: "System truth", icon: FlaskConical },
  { id: "developer-hub-reference", label: "Reference", icon: BookOpen },
];

/** The client half of the hub page, which is a Server Component. */
export function DeveloperHubNavHeader({ actions }: { actions?: ReactNode }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(developerHubNavSections);

  return (
    <InPageNavHeader
      back={{ href: "/", label: "Home" }}
      title="Developer"
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      actions={actions}
      actionsNoun="developer hub"
      actionsDescription="Choose how to use this hub."
      testIdPrefix="developer-hub"
    />
  );
}
