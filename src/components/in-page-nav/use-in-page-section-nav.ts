"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { jumpToDocumentSection } from "@/components/document-viewer/section-nav";
import { useDocumentSectionSpy } from "@/components/document-viewer/use-section-spy";
import { toDocumentSections, type PageSection } from "@/components/in-page-nav/page-section-index";
import { useResolvedPageSections } from "@/components/in-page-nav/use-resolved-page-sections";

/**
 * Everything an information page needs to drive `InPageNavHeader`: which
 * declared sections are actually on screen, which one the reader is in, and what
 * happens when one is chosen.
 *
 * Composition rather than new behaviour — `useResolvedPageSections` narrows the
 * declaration, `useDocumentSectionSpy` tracks position, `jumpToDocumentSection`
 * moves. The spy takes `DocumentSection[]` but reads only `id` and
 * `collapsible`, so the projection here can skip weights; `InPageNavHeader`
 * re-derives those from the rendered heights.
 */
export function useInPageSectionNav(declared: readonly PageSection[]): {
  sections: PageSection[];
  activeId: string | null;
  selectSection: (id: string) => void;
} {
  const sections = useResolvedPageSections(declared);
  const spySections = useMemo(() => toDocumentSections(sections), [sections]);
  const { activeId, selectSection: markActive } = useDocumentSectionSpy(spySections, sections.length > 0);

  // The hash this hook has already scrolled to, so a re-resolve (the observer
  // fires on any `#main-content` mutation) does not yank the reader back.
  const alignedHash = useRef<string | null>(null);

  const selectSection = useCallback(
    (id: string) => {
      const fragmentId = sections.find((section) => section.id === id)?.fragmentId ?? id;
      // Preserve Next's app-router history metadata so fragment back/forward
      // does not detach the entry from its route tree. The fragment is the
      // declared one, so a link copied on a phone still resolves on a desktop
      // where the displayed target id differs.
      window.history.pushState(window.history.state, "", `#${fragmentId}`);
      alignedHash.current = fragmentId;
      markActive(id);
      jumpToDocumentSection(id);
      // The observer may resolve once between this immediate selection and the
      // target's next-frame scroll, briefly restoring the old section. Reassert
      // the explicit selection after the jump callback; the following scroll
      // observation then owns any later manual movement.
      window.requestAnimationFrame(() => {
        if (window.location.hash === `#${fragmentId}`) markActive(id);
      });
    },
    [markActive, sections],
  );

  // A section's stable `fragmentId` is deliberately not an element id when the
  // section renders once per breakpoint, so the browser cannot resolve a deep
  // link to one on its own — `#form-source-verification` would simply do
  // nothing. Resolve it here instead, against whichever copy is displayed.
  // Only jumping, never setting active state: the scroll spy reports where the
  // reader ends up.
  useEffect(() => {
    if (sections.length === 0) return;

    const align = () => {
      const hash = window.location.hash.slice(1);
      if (!hash || alignedHash.current === hash) return;
      const section = sections.find((entry) => (entry.fragmentId ?? entry.id) === hash);
      if (!section) return;
      alignedHash.current = hash;
      jumpToDocumentSection(section.id);
    };

    align();
    window.addEventListener("hashchange", align);
    window.addEventListener("popstate", align);
    return () => {
      window.removeEventListener("hashchange", align);
      window.removeEventListener("popstate", align);
    };
  }, [sections]);

  return { sections, activeId, selectSection };
}
