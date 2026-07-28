"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DocumentSection } from "@/components/document-viewer/section-index";

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
    const elements = ids
      .map((id) => window.document.getElementById(id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (elements.length === 0) return;

    const resolve = () => {
      frameRef.current = null;
      // The band sits just under the chrome, so "here" means the last section
      // whose top has passed it rather than whichever happens to be biggest.
      const band = Math.max(96, window.innerHeight * 0.25);
      let candidate: string | null = null;

      for (const element of elements) {
        const disclosure = element instanceof HTMLDetailsElement ? element : element.closest("details");
        if (disclosure instanceof HTMLDetailsElement && !disclosure.open) continue;
        if (element.getBoundingClientRect().top <= band) candidate = element.id;
      }

      // Before the first section reaches the band the reader is still at the top.
      setActiveId(candidate ?? elements[0].id);
    };

    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(resolve);
    };

    const observer = new IntersectionObserver(schedule, {
      threshold: [0, 0.01, 0.5, 1],
    });
    elements.forEach((element) => observer.observe(element));

    // Opening or closing a section changes which one can be active without any
    // scrolling, so the accordion has to re-trigger the decision itself.
    const disclosures = Array.from(
      window.document.querySelectorAll<HTMLDetailsElement>('details[name="document-viewer-section"]'),
    );
    disclosures.forEach((disclosure) => disclosure.addEventListener("toggle", schedule));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      observer.disconnect();
      disclosures.forEach((disclosure) => disclosure.removeEventListener("toggle", schedule));
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [enabled, sectionKey]);

  const active = sections.find((section) => section.id === activeId) ?? sections[0] ?? null;
  return { activeId: active?.id ?? null, activeSection: active, selectSection };
}
