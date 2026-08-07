"use client";

import { useEffect, useState } from "react";

import { isDocumentViewerOwnedRoute } from "@/components/clinical-dashboard/mobile-composer-reserve";
import { RegistryModeNav } from "@/components/mode-nav/registry-mode-nav";
import { SecondaryNavigation, type SecondaryNavigationSectionItem } from "@/components/secondary-navigation";
import { type AppModeId } from "@/lib/app-modes";
import { isInformationPage } from "@/lib/information-pages";
import {
  activeModeSecondaryNavigationId,
  isModeSecondaryNavigationRoute,
  modeUsesHeaderModeNav,
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
    // The presentation workflow owns navigation at every width: `MobileTabs`
    // (`xl:hidden`) below xl, and an always-visible "Differential review
    // sidebar" aside at xl that shows every panel at once. It used to declare a
    // `differentialPresentationSections` set instead, whose six targetIds no
    // component rendered — so the route was claimed and nothing was drawn
    // (/issues #256). Declaring local ownership is what was true all along.
    pathname.startsWith("/differentials/presentations/") ||
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
  /**
   * Bridged query string from GlobalStandaloneSearchShellBody. Must not call
   * useSearchParams here — that reintroduces a nested Suspense boundary under
   * the standalone shell body (search-chrome invariant 17).
   */
  searchParamString = "",
  sticky = true,
}: {
  modeId: AppModeId;
  pathname: string;
  hasSubmittedSearch: boolean;
  searchParamString?: string;
  sticky?: boolean;
}) {
  const informationDefinitions = informationPageSectionDefinitions(pathname);
  const locallyOwnedInformationNavigation = hasLocalInformationPageNavigation(pathname);
  const activeId = activeModeSecondaryNavigationId(modeId, pathname);

  // Therapy Compass owns both its workflow bindings and its dynamic detail
  // sections inside TcProvider; rendering the shell registry as well would
  // duplicate the bar and discard its URL/state-aware action bindings.
  if (pathname === "/therapy-compass" || pathname.startsWith("/therapy-compass/")) return null;
  if (locallyOwnedInformationNavigation) return null;
  // ORDER IS LOAD-BEARING: this must stay above the mode branch. `services`,
  // `forms`, `documents` and `prescribing` register no destinations at all yet
  // still own real "On this page" section navs. Hoisting the mode guard below
  // up to here would silently delete navigation from every `/services/*`,
  // `/forms/*`, `/medications/*` and `/documents/<id>` record.
  if (informationDefinitions.length) {
    return <AvailableInformationPageNavigation definitions={informationDefinitions} sticky={sticky} />;
  }
  // A mode with no registered destinations gets no bar and no landmark. The
  // seven that used to register a lone `action` entry each rendered one
  // <button> that focused a composer already on screen; it was deleted rather
  // than ported, so there is nothing left to draw for them.
  if (!modeUsesHeaderModeNav(modeId)) return null;
  if (!isModeSecondaryNavigationRoute({ modeId, pathname, hasSubmittedSearch })) return null;
  // An adopted mode's bar portals into the header's single addon slot, which
  // holds ONE page-owned header. What keeps it to one is the
  // `locallyOwnedInformationNavigation` return above: every route that portals
  // its own header (`DocumentViewer`, `differential-detail-page`) is also
  // locally-owned information navigation, so it never reaches here. That is a
  // coincidence of two separate lists, not a stated rule —
  // `isHeaderAddonSlotOwnedRoute` names the claimants and
  // `tests/mode-nav-addon-slot.dom.test.tsx` fails if a future one falls
  // outside that cover, which is when this needs its own guard.
  return <RegistryModeNav modeId={modeId} activeId={activeId} searchParamString={searchParamString} />;
}
