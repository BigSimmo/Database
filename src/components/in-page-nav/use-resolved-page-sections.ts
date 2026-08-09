"use client";

import { useEffect, useState } from "react";

import { sectionTargetIds, type PageSection } from "@/components/in-page-nav/page-section-index";

const noSections: PageSection[] = [];

/**
 * A declared section may have no target on this render (the data behind it is
 * absent) or two (a phone copy and a desktop copy). A `display: none` element
 * still resolves by id, so presence alone is not the test — visibility is.
 */
function elementIsVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && window.getComputedStyle(element).display !== "none";
}

/** Cheap identity for "did the resolved set actually change". */
function signatureOf(sections: readonly PageSection[]): string {
  return sections.map((section) => `${section.label}:${section.id}`).join("|");
}

/**
 * Narrows declared sections to the ones a route is currently rendering, with
 * each `id` rewritten to the target that is actually displayed.
 *
 * Ported from `AvailableInformationPageNavigation` in the pill rail this
 * replaces: the same `MutationObserver` on `#main-content`, the same visibility
 * test, the same signature guard — without which the observer retriggers on its
 * own output and re-renders forever.
 *
 * Resolution happens *before* the scroll spy rather than inside it.
 * `resolveSectionElement` (`document-viewer/use-section-spy.ts`) carries a
 * hardcoded alias map for the viewer's one aliased section; page sections
 * declare their own copies via `PageSection.targetIds`, so resolving first keeps
 * `useDocumentSectionSpy` generic and unchanged.
 *
 * Starts empty and fills in on mount, matching the rail it replaces: a section
 * is claimed only once its anchor has been seen, never on the strength of the
 * declaration alone.
 *
 * `declared` is the effect's identity, so pass a module-level constant — every
 * route in this repo does. An array rebuilt on each render still produces the
 * right answer (the signature guard below stops the observer feeding itself),
 * but it re-subscribes the observer every render for nothing.
 */
export function useResolvedPageSections(declared: readonly PageSection[]): PageSection[] {
  const [resolved, setResolved] = useState<PageSection[]>(noSections);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame: number | null = null;

    const refresh = () => {
      frame = null;
      const next = declared.flatMap((section) => {
        const target = sectionTargetIds(section)
          .map((id) => window.document.getElementById(id))
          .filter((element): element is HTMLElement => element !== null)
          .find(elementIsVisible);
        return target ? [{ ...section, id: target.id }] : [];
      });

      setResolved((current) => (signatureOf(current) === signatureOf(next) ? current : next));
    };

    const scheduleRefresh = () => {
      if (frame === null) frame = window.requestAnimationFrame(refresh);
    };

    const root = window.document.getElementById("main-content") ?? window.document.body;
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(scheduleRefresh);
    observer?.observe(root, { childList: true, subtree: true });
    scheduleRefresh();
    window.addEventListener("resize", scheduleRefresh, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [declared]);

  return resolved;
}
