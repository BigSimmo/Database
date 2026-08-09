import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSectionElement, resolveVisibleElement } from "@/components/document-viewer/use-section-spy";

/**
 * Keeps the document viewer and the shared in-page navigation template from
 * forking into two implementations of one contract (`/issues #288`).
 *
 * `DocumentViewer` deliberately does **not** mount `InPageNavHeader` — that was
 * evaluated and declined, with the four blocking reasons recorded in
 * `docs/search-chrome-behaviour.md` ("DocumentViewer keeps its own header").
 * What makes the split affordable is that only the header row is duplicated:
 * the scroll spy, the segment track, the section list, the jump and the anchor
 * measurement are single implementations that both paths import. This file
 * pins that arrangement, so the divergence cannot quietly widen from "two header
 * rows" to "two of everything" — and covers the one primitive the convergence
 * pass actually merged.
 */

/**
 * Repo-root relative, not `import.meta.url`: the node suite's usual idiom, but
 * `import.meta.url` is not populated for this file's jsdom project, and vitest
 * runs every project from the repository root.
 */
const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const inPageNavHeaderSource = read("src/components/in-page-nav/in-page-nav-header.tsx");
const inPageSectionNavSource = read("src/components/in-page-nav/use-in-page-section-nav.ts");
const pageSectionWeightsSource = read("src/components/in-page-nav/use-page-section-weights.ts");
const inPageChromeMetricsSource = read("src/components/in-page-nav/use-in-page-chrome-metrics.ts");
const documentChromeMetricsSource = read("src/components/document-viewer/use-document-chrome-metrics.ts");
const behaviourDocSource = read("docs/search-chrome-behaviour.md");

/**
 * jsdom gives every element a zero rect, which is exactly the "present but not
 * displayed" state the predicate has to reject — so a visible element has to be
 * stubbed explicitly.
 */
function mountAnchor(id: string, { visible }: { visible: boolean }) {
  const element = document.createElement("div");
  element.id = id;
  document.body.append(element);

  if (visible) {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 40,
      width: 320,
      height: 40,
      toJSON: () => ({}),
    });
  }

  return element;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveVisibleElement", () => {
  it("returns the first candidate that is actually displayed", () => {
    const first = mountAnchor("section-phone", { visible: true });
    mountAnchor("section-desktop", { visible: true });

    expect(resolveVisibleElement(["section-phone", "section-desktop"])).toBe(first);
  });

  it("skips a candidate that resolves by id but reports a zero rect", () => {
    // The whole reason size is the test: a `display: none` copy still resolves
    // by id and reports top 0, which reads as "at the very top of the viewport"
    // and would win the active-section race against the copy on screen.
    mountAnchor("section-phone", { visible: false });
    const displayed = mountAnchor("section-desktop", { visible: true });

    expect(resolveVisibleElement(["section-phone", "section-desktop"])).toBe(displayed);
  });

  it("returns null when no candidate is rendered at all", () => {
    expect(resolveVisibleElement(["absent-a", "absent-b"])).toBeNull();
  });
});

describe("resolveSectionElement", () => {
  it("resolves a document section through its own anchor when that copy is displayed", () => {
    const primary = mountAnchor("source-evidence", { visible: true });
    mountAnchor("source-evidence-rail", { visible: true });

    expect(resolveSectionElement("source-evidence")).toBe(primary);
  });

  it("falls back to the viewer's aliased copy when the primary one is hidden", () => {
    // Pinned evidence renders twice — a phone copy and a desktop rail copy —
    // and only one is displayed at a time. The alias map is what lets the spy
    // follow it across the breakpoint.
    mountAnchor("source-evidence", { visible: false });
    const rail = mountAnchor("source-evidence-rail", { visible: true });

    expect(resolveSectionElement("source-evidence")).toBe(rail);
  });

  it("reports nothing for a section with no rendered copy", () => {
    mountAnchor("source-evidence", { visible: false });
    mountAnchor("source-evidence-rail", { visible: false });

    expect(resolveSectionElement("source-evidence")).toBeNull();
  });
});

describe("in-page navigation reuses the document-viewer substrate", () => {
  it("renders the document viewer's own track and list rather than copies", () => {
    expect(inPageNavHeaderSource).toContain('from "@/components/document-viewer/section-nav"');
    expect(inPageNavHeaderSource).toContain("DocumentSectionList");
    expect(inPageNavHeaderSource).toContain("DocumentSectionTrack");
  });

  it("drives position and jumps from the document viewer's own spy", () => {
    expect(inPageSectionNavSource).toContain(
      'import { jumpToDocumentSection } from "@/components/document-viewer/section-nav"',
    );
    expect(inPageSectionNavSource).toContain(
      'import { useDocumentSectionSpy } from "@/components/document-viewer/use-section-spy"',
    );
  });

  it("resolves breakpoint copies through the one shared predicate", () => {
    // This loop existed twice, character for character, until #288 merged it.
    // Its signature is the rect test — the file has no other reason to measure
    // one, so a `getBoundingClientRect` reappearing here is the fork growing
    // back. (`getElementById` is not the tell: the hook legitimately resolves
    // `#main-content` as its MutationObserver root.)
    expect(pageSectionWeightsSource).toContain(
      'import { resolveVisibleElement } from "@/components/document-viewer/use-section-spy"',
    );
    expect(pageSectionWeightsSource).not.toContain("getBoundingClientRect");
  });

  it("keeps both chrome-metric hooks as bindings of one measurement", () => {
    for (const source of [inPageChromeMetricsSource, documentChromeMetricsSource]) {
      expect(source).toContain('from "@/components/sticky-chrome-metrics"');
      expect(source).toContain("useStickyChromeMetrics({");
    }
  });
});

describe("the DocumentViewer non-adoption decision", () => {
  it("stays recorded as decided rather than pending", () => {
    // An "adopt it later" note is what turns a closed decision back into a
    // migration someone re-opens without the reasons in front of them.
    // Prose is hard-wrapped, so assert on fragments that sit within one line.
    expect(behaviourDocSource).toContain("### DocumentViewer keeps its own header — decided, not pending");
    expect(behaviourDocSource).toContain("do not re-open it without new facts");
    expect(behaviourDocSource).toContain('Do not "unify" these by moving the alias map into the page model.');
  });
});
