"use client";

import { useEffect, useMemo, useState } from "react";

import { isDocumentViewerOwnedRoute } from "@/components/clinical-dashboard/mobile-composer-reserve";
import {
  SecondaryNavigation,
  type SecondaryNavigationItem,
  type SecondaryNavigationSectionItem,
} from "@/components/secondary-navigation";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import { isInformationPage } from "@/lib/information-pages";
import {
  activeModeSecondaryNavigationId,
  isModeSecondaryNavigationRoute,
  modeSecondaryNavigationEntries,
  modeSecondaryNavigationHref,
} from "@/lib/mode-secondary-navigation";

export type InformationPageSectionDefinition = {
  id: string;
  label: string;
  targetIds: readonly string[];
  fragmentId?: string;
};

const serviceSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["service-overview"] },
  { id: "quick-facts", label: "Quick facts", targetIds: ["service-quick-facts"] },
  { id: "referral", label: "Referral", targetIds: ["service-referral"] },
  { id: "criteria", label: "Criteria", targetIds: ["service-criteria"] },
  { id: "verification", label: "Verification", targetIds: ["service-verification"] },
];

const formSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["form-overview"] },
  {
    id: "decision-context",
    label: "Decision context",
    targetIds: ["form-decision-context-mobile", "form-decision-context-desktop"],
    fragmentId: "form-decision-context",
  },
  { id: "priority-facts", label: "Priority facts", targetIds: ["form-priority-facts"] },
  { id: "legal-boundary", label: "Legal boundary", targetIds: ["form-legal-boundary"] },
  { id: "information", label: "Form information", targetIds: ["form-information"] },
  {
    id: "verification",
    label: "Source / verification",
    targetIds: ["form-source-verification-mobile", "form-source-verification-desktop"],
    fragmentId: "form-source-verification",
  },
];

const specifierSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["specifier-overview"] },
  { id: "fit", label: "Fit & exclusions", targetIds: ["specifier-fit"] },
  { id: "wording", label: "Wording / coding", targetIds: ["specifier-wording"] },
  { id: "evidence", label: "Evidence / source", targetIds: ["specifier-evidence"] },
];

const formulationSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["formulation-overview"] },
  { id: "now", label: "What matters now", targetIds: ["formulation-what-matters-now"] },
  { id: "fit", label: "Fit", targetIds: ["formulation-fit"] },
  { id: "five-ps", label: "5 Ps", targetIds: ["formulation-five-ps"] },
  { id: "treatment", label: "Treatment leverage", targetIds: ["formulation-treatment"] },
  { id: "evidence", label: "Evidence / source", targetIds: ["formulation-evidence"] },
];

const differentialPresentationSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["differential-presentation-overview"] },
  {
    id: "comparison",
    label: "Comparison",
    targetIds: ["differential-presentation-comparison-mobile", "differential-presentation-comparison-desktop"],
    fragmentId: "differential-presentation-comparison",
  },
  {
    id: "safety",
    label: "Safety",
    targetIds: [
      "differential-presentation-safety-mobile",
      "differential-presentation-safety-tablet",
      "differential-presentation-safety-desktop",
    ],
    fragmentId: "differential-presentation-safety",
  },
  {
    id: "urgency",
    label: "Highest urgency",
    targetIds: [
      "differential-presentation-urgency-mobile",
      "differential-presentation-urgency-tablet",
      "differential-presentation-urgency-desktop",
    ],
    fragmentId: "differential-presentation-urgency",
  },
  {
    id: "handoff",
    label: "Handoff",
    targetIds: [
      "differential-presentation-handoff-mobile",
      "differential-presentation-handoff-tablet",
      "differential-presentation-handoff-desktop",
    ],
    fragmentId: "differential-presentation-handoff",
  },
  {
    id: "sources",
    label: "Source status",
    targetIds: [
      "differential-presentation-sources-mobile",
      "differential-presentation-sources-tablet",
      "differential-presentation-sources-desktop",
    ],
    fragmentId: "differential-presentation-sources",
  },
];

const dsmDiagnosisSections: readonly InformationPageSectionDefinition[] = [
  { id: "criteria", label: "Criteria", targetIds: ["criteria"] },
  { id: "features", label: "Key features", targetIds: ["key-features"] },
  { id: "specifiers", label: "Specifiers", targetIds: ["specifiers"] },
  { id: "documentation", label: "Documentation", targetIds: ["documentation"] },
  { id: "summary", label: "Record summary", targetIds: ["record-summary"] },
];

const dsmDifferentialSections: readonly InformationPageSectionDefinition[] = [
  { id: "overview", label: "Overview", targetIds: ["dsm-differential-overview"] },
  { id: "filters", label: "Filters", targetIds: ["dsm-differential-filters"] },
  { id: "considerations", label: "Considerations", targetIds: ["dsm-differential-considerations"] },
  { id: "clarify", label: "Clarify / review", targetIds: ["dsm-differential-clarify"] },
];

const documentSections: readonly InformationPageSectionDefinition[] = [
  { id: "pdf", label: "PDF", targetIds: ["pdf-preview-section"] },
  {
    id: "evidence",
    label: "Evidence",
    targetIds: ["source-evidence", "source-evidence-rail"],
    fragmentId: "document-evidence",
  },
  { id: "text", label: "Text", targetIds: ["source-text", "source-text-rail"] },
  { id: "summary", label: "Summary", targetIds: ["source-summary"] },
  { id: "images", label: "Images", targetIds: ["source-images"] },
];

export function informationPageSectionDefinitions(pathname: string): readonly InformationPageSectionDefinition[] {
  if (!isInformationPage(pathname)) return [];
  if (pathname.startsWith("/services/") && pathname !== "/services") return serviceSections;
  if (pathname.startsWith("/forms/") && pathname !== "/forms") return formSections;
  if (
    pathname.startsWith("/specifiers/") &&
    !["/specifiers/builder", "/specifiers/compare", "/specifiers/map"].includes(pathname)
  )
    return specifierSections;
  if (
    pathname.startsWith("/formulation/") &&
    !["/formulation/builder", "/formulation/compare", "/formulation/map"].includes(pathname)
  )
    return formulationSections;
  if (pathname.startsWith("/differentials/presentations/")) return differentialPresentationSections;
  if (pathname.endsWith("/differentials") && pathname.startsWith("/dsm/diagnoses/")) return dsmDifferentialSections;
  if (pathname.startsWith("/dsm/diagnoses/")) return dsmDiagnosisSections;
  if (pathname.startsWith("/documents/") && pathname !== "/documents/search") return documentSections;
  return [];
}

/** These detail families own controlled/dynamic navigation inside their page component. */
export function hasLocalInformationPageNavigation(pathname: string): boolean {
  if (!isInformationPage(pathname)) return false;
  return (
    pathname.startsWith("/medications/") ||
    pathname.startsWith("/differentials/diagnoses/") ||
    (pathname.startsWith("/factsheets/") && pathname !== "/factsheets/search") ||
    pathname.startsWith("/therapy-compass/") ||
    // DocumentViewer owns DocumentViewerAnchors (PDF/Evidence/Text/Summary/Images).
    isDocumentViewerOwnedRoute(pathname)
  );
}

function elementIsVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && window.getComputedStyle(element).display !== "none";
}

function AvailableInformationPageNavigation({
  definitions,
  sticky,
}: {
  definitions: readonly InformationPageSectionDefinition[];
  sticky: boolean;
}) {
  const [items, setItems] = useState<SecondaryNavigationSectionItem[]>([]);
  const definitionSignature = definitions
    .map((definition) => `${definition.id}:${definition.targetIds.join(",")}`)
    .join("|");

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      frame = 0;
      const next = definitions.flatMap((definition) => {
        const candidates = definition.targetIds
          .map((targetId) => document.getElementById(targetId))
          .filter((element): element is HTMLElement => Boolean(element));
        const target = candidates.find(elementIsVisible);
        return target
          ? [
              {
                kind: "section" as const,
                id: definition.id,
                label: definition.label,
                targetId: target.id,
                fragmentId: definition.fragmentId,
              },
            ]
          : [];
      });
      setItems((current) => {
        const currentSignature = current
          .map((item) => `${item.id}:${item.targetId}:${item.fragmentId ?? item.targetId}`)
          .join("|");
        const nextSignature = next
          .map((item) => `${item.id}:${item.targetId}:${item.fragmentId ?? item.targetId}`)
          .join("|");
        return currentSignature === nextSignature ? current : next;
      });
    };
    const scheduleRefresh = () => {
      if (!frame) frame = window.requestAnimationFrame(refresh);
    };
    const root = document.getElementById("main-content") ?? document.body;
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(scheduleRefresh);
    observer?.observe(root, { childList: true, subtree: true });
    scheduleRefresh();
    window.addEventListener("resize", scheduleRefresh, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [definitions, definitionSignature]);

  return <SecondaryNavigation ariaLabel="On this page" items={items} sticky={sticky} />;
}

export function PageSecondaryNavigation({
  modeId,
  pathname,
  hasSubmittedSearch,
  onSearch,
  /**
   * Bridged query string from GlobalStandaloneSearchShellBody. Must not call
   * useSearchParams here — that reintroduces a nested Suspense boundary under
   * the standalone shell body (search-chrome invariant 17).
   */
  searchParamString = "",
  sticky = true,
  stickyTop,
}: {
  modeId: AppModeId;
  pathname: string;
  hasSubmittedSearch: boolean;
  onSearch: () => void;
  searchParamString?: string;
  sticky?: boolean;
  stickyTop?: number | string;
}) {
  const informationDefinitions = informationPageSectionDefinitions(pathname);
  const locallyOwnedInformationNavigation = hasLocalInformationPageNavigation(pathname);
  const activeId = activeModeSecondaryNavigationId(modeId, pathname);
  const modeLabel = appModeDefinition(modeId).label;
  const modeAriaLabel = modeLabel.toLowerCase().endsWith("mode") ? modeLabel : `${modeLabel} mode`;
  const modeItems = useMemo<SecondaryNavigationItem[]>(
    () =>
      modeSecondaryNavigationEntries(modeId).map((entry) =>
        entry.href
          ? {
              kind: "route" as const,
              id: entry.id,
              label: entry.label,
              shortLabel: entry.shortLabel,
              href: modeSecondaryNavigationHref({
                modeId,
                itemId: entry.id,
                href: entry.href,
                currentSearchParams: new URLSearchParams(searchParamString),
              }),
              current: entry.id === activeId,
            }
          : {
              kind: "action" as const,
              id: entry.id,
              label: entry.label,
              shortLabel: entry.shortLabel,
              onSelect: onSearch,
              current: entry.id === activeId,
            },
      ),
    [activeId, modeId, onSearch, searchParamString],
  );

  // Therapy Compass owns both its workflow bindings and its dynamic detail
  // sections inside TcProvider; rendering the shell registry as well would
  // duplicate the bar and discard its URL/state-aware action bindings.
  if (pathname === "/therapy-compass" || pathname.startsWith("/therapy-compass/")) return null;
  if (locallyOwnedInformationNavigation) return null;
  if (informationDefinitions.length) {
    return <AvailableInformationPageNavigation definitions={informationDefinitions} sticky={sticky} />;
  }
  if (!isModeSecondaryNavigationRoute({ modeId, pathname, hasSubmittedSearch })) return null;
  return (
    <SecondaryNavigation
      ariaLabel={modeAriaLabel}
      items={modeItems}
      activeId={activeId}
      sticky={sticky}
      stickyTop={stickyTop}
    />
  );
}
