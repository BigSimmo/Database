import { Clipboard, Info, LayoutGrid, ListChecks, ShieldCheck } from "lucide-react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";

export type ServiceSectionVisibility = {
  showQuickFacts: boolean;
  showReferralSection: boolean;
  showCriteriaSection: boolean;
};

/**
 * Scroll sections for the service detail page. `id` is the DOM anchor so
 * `usePageSectionWeights`, `useDocumentSectionSpy`, and `jumpToDocumentSection`
 * resolve without document-specific aliases. Weights are omitted — the header
 * measures rendered heights.
 */
export function buildServiceSectionIndex(visibility: ServiceSectionVisibility): PageSection[] {
  const sections: PageSection[] = [{ id: "service-overview", label: "Overview", icon: Info }];

  if (visibility.showQuickFacts) {
    sections.push({ id: "service-quick-facts", label: "Quick facts", icon: LayoutGrid });
  }
  if (visibility.showReferralSection) {
    sections.push({ id: "service-referral", label: "Referral", icon: Clipboard });
  }
  if (visibility.showCriteriaSection) {
    sections.push({ id: "service-criteria", label: "Criteria", icon: ListChecks });
  }

  sections.push({ id: "service-verification", label: "Verification", icon: ShieldCheck });
  return sections;
}
