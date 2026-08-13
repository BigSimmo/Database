"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { jumpToDocumentSection } from "@/components/document-viewer/section-nav";
import { useDocumentSectionSpy } from "@/components/document-viewer/use-section-spy";
import { toDocumentSections, type PageSection } from "@/components/in-page-nav/page-section-index";
import { useResolvedPageSections } from "@/components/in-page-nav/use-resolved-page-sections";

const scrollIntentKeys = new Set(["ArrowDown", "ArrowUp", "End", "Home", "PageDown", "PageUp", " "]);

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

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
  const { activeId: observedActiveId, selectSection: markActive } = useDocumentSectionSpy(
    spySections,
    sections.length > 0,
  );
  const [explicitFragmentId, setExplicitFragmentId] = useState<string | null>(null);
  const explicitSectionId = explicitFragmentId
    ? (sections.find((section) => (section.fragmentId ?? section.id) === explicitFragmentId)?.id ?? null)
    : null;
  const activeId = explicitSectionId ?? observedActiveId;

  // The hash this hook has already scrolled to, so a re-resolve (the observer
  // fires on any `#main-content` mutation) does not yank the reader back.
  const alignedHash = useRef<string | null>(null);

  // A click or history jump is deliberate navigation, so keep that section
  // selected while its programmatic scroll and the phone chrome settle. The raw
  // geometry spy takes ownership again only when the reader actually starts
  // scrolling, rather than on incidental scroll/resize frames from the jump.
  useEffect(() => {
    if (explicitFragmentId === null) return;

    const releaseExplicitSelection = () => setExplicitFragmentId(null);
    const releaseOnScrollKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }
      if (scrollIntentKeys.has(event.key)) releaseExplicitSelection();
    };

    window.addEventListener("wheel", releaseExplicitSelection, { passive: true });
    window.addEventListener("touchmove", releaseExplicitSelection, { passive: true });
    window.addEventListener("keydown", releaseOnScrollKey);
    return () => {
      window.removeEventListener("wheel", releaseExplicitSelection);
      window.removeEventListener("touchmove", releaseExplicitSelection);
      window.removeEventListener("keydown", releaseOnScrollKey);
    };
  }, [explicitFragmentId]);

  const selectSection = useCallback(
    (id: string) => {
      const fragmentId = sections.find((section) => section.id === id)?.fragmentId ?? id;
      // Preserve Next's app-router history metadata so fragment back/forward
      // does not detach the entry from its route tree. The fragment is the
      // declared one, so a link copied on a phone still resolves on a desktop
      // where the displayed target id differs.
      window.history.pushState(window.history.state, "", `#${fragmentId}`);
      alignedHash.current = fragmentId;
      setExplicitFragmentId(fragmentId);
      markActive(id);
      jumpToDocumentSection(id);
    },
    [markActive, sections],
  );

  // A section's stable `fragmentId` is deliberately not an element id when the
  // section renders once per breakpoint, so the browser cannot resolve a deep
  // link to one on its own — `#form-source-verification` would simply do
  // nothing. Resolve it here instead, against whichever copy is displayed.
  useEffect(() => {
    if (sections.length === 0) return;

    const align = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        alignedHash.current = null;
        setExplicitFragmentId(null);
        return;
      }
      if (alignedHash.current === hash) return;
      const section = sections.find((entry) => (entry.fragmentId ?? entry.id) === hash);
      if (!section) return;
      alignedHash.current = hash;
      setExplicitFragmentId(hash);
      markActive(section.id);
      jumpToDocumentSection(section.id);
    };

    align();
    window.addEventListener("hashchange", align);
    window.addEventListener("popstate", align);
    return () => {
      window.removeEventListener("hashchange", align);
      window.removeEventListener("popstate", align);
    };
  }, [markActive, sections]);

  return { sections, activeId, selectSection };
}
