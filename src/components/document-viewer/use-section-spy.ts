"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DocumentSection } from "@/components/document-viewer/section-index";

/**
 * Some sections render twice — pinned evidence has a phone copy and a desktop
 * rail copy — and only one is displayed at a time.
 */
const sectionAnchorAliases: Record<string, string[]> = {
  "source-evidence": ["source-evidence-rail"],
  // The rail's document-profile disclosure owns the canonical anchor (the spy
  // treats it as an exclusive-accordion member), while the in-flow clinical
  // summary card above the PDF is its phone/tablet copy.
  "source-summary": ["source-summary-card"],
};

/**
 * The first of `ids` that is currently rendered, or null when none of them is
 * displayed at this breakpoint.
 *
 * A `display: none` element still resolves by id and reports a zero rect, which
 * reads as "at the very top of the viewport" — enough to make a hidden phone
 * panel win the active-section race on desktop. Size is the only reliable test.
 *
 * Exported as the candidate-list primitive so a caller that already knows a
 * section's breakpoint copies supplies them directly. `usePageSectionWeights`
 * is that caller: page sections declare their copies as `PageSection.targetIds`
 * rather than through the viewer's alias map below, and the two had drifted into
 * separate copies of this same loop.
 */
export function resolveVisibleElement(ids: readonly string[]): HTMLElement | null {
  if (typeof window === "undefined") return null;

  for (const id of ids) {
    const element = window.document.getElementById(id);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return element;
  }

  return null;
}

/**
 * The document section's element as currently rendered, resolved through the
 * viewer's alias map: the viewer builds its sections from the indexed payload
 * (`buildDocumentSectionIndex`), so there is no declaration site on which to
 * hang per-section `targetIds` the way an information page has.
 */
export function resolveSectionElement(id: string): HTMLElement | null {
  return resolveVisibleElement([id, ...(sectionAnchorAliases[id] ?? [])]);
}

/**
 * Tracks which document section the reader is currently in.
 *
 * The viewer's collapsible sections are `<details name="document-viewer-section">`,
 * an exclusive accordion: at most one is open, and a closed one occupies a summary
 * bar rather than a position in the document. So a collapsed section can never be
 * "here" — the spy resolves to the nearest section that is actually expanded.
 *
 * Intersection callbacks only ever act as a trigger; the decision re-reads all
 * section rects (seven elements at most) inside one animation frame, which keeps
 * the answer stable while several sections cross the band together.
 */
export function useDocumentSectionSpy(sections: DocumentSection[], enabled: boolean) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const sectionKey = sections.map((section) => section.id).join(",");

  /** Explicit selection wins immediately; the spy refines it once scrolling settles. */
  const selectSection = useCallback((id: string) => setActiveId(id), []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const ids = sectionKey ? sectionKey.split(",") : [];
    if (ids.length === 0) return;

    const resolve = () => {
      frameRef.current = null;
      // The band sits just under the chrome, so "here" means the last section
      // whose top has passed it rather than whichever happens to be biggest.
      const band = Math.max(96, window.innerHeight * 0.25);
      let candidate: string | null = null;
      let candidateTop = Number.NEGATIVE_INFINITY;
      let first: string | null = null;

      for (const id of ids) {
        // Re-resolved every pass: which copy of a section is displayed changes
        // with the breakpoint, and sections mount and unmount as data arrives.
        const element = resolveSectionElement(id);
        if (!element) continue;
        first ??= id;

        const disclosure = element instanceof HTMLDetailsElement ? element : element.closest("details");
        if (disclosure instanceof HTMLDetailsElement && !disclosure.open) continue;

        // Geometrically nearest above the band, not last in reading order: at
        // `lg` the sections run down two columns, so document order and vertical
        // position disagree and "the last one past the band" picks the wrong one.
        const { top } = element.getBoundingClientRect();
        if (top <= band && top > candidateTop) {
          candidate = id;
          candidateTop = top;
        }
      }

      // Before the first section reaches the band the reader is still at the top.
      setActiveId(candidate ?? first);
    };

    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(resolve);
    };

    const observer = new IntersectionObserver(schedule, {
      threshold: [0, 0.01, 0.5, 1],
    });
    ids.forEach((id) => {
      const element = resolveSectionElement(id);
      if (element) observer.observe(element);
    });

    // Opening or closing a section changes which one can be active without any
    // scrolling, so the accordion has to re-trigger the decision itself.
    const disclosures = Array.from(
      window.document.querySelectorAll<HTMLDetailsElement>('details[name="document-viewer-section"]'),
    );
    disclosures.forEach((disclosure) => disclosure.addEventListener("toggle", schedule));
    // Either owner can be the one that scrolls: the document in browser tabs so
    // Safari can collapse its chrome, `#main-content` in an installed PWA. A
    // window-only listener leaves the label frozen in standalone mode.
    const innerScroller = window.document.getElementById("main-content");
    window.addEventListener("scroll", schedule, { passive: true });
    innerScroller?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      observer.disconnect();
      disclosures.forEach((disclosure) => disclosure.removeEventListener("toggle", schedule));
      window.removeEventListener("scroll", schedule);
      innerScroller?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [enabled, sectionKey]);

  const active = sections.find((section) => section.id === activeId) ?? sections[0] ?? null;
  return { activeId: active?.id ?? null, activeSection: active, selectSection };
}
