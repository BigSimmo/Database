import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildDifferentialSectionIndex } from "@/components/differentials/detail-section-index";
import { DocumentSectionTrack } from "@/components/document-viewer/section-nav";
import { DETAIL_TAB_IDS, type DifferentialDetailContext } from "@/lib/differential-detail";
import type { DifferentialRecord, DifferentialSection } from "@/lib/differentials";

function buildSection(overrides: Partial<DifferentialSection> = {}): DifferentialSection {
  return { id: "why-it-fits", title: "Why it fits", summary: "Summary line", items: [], tone: "fit", ...overrides };
}

function buildRecord(overrides: Partial<DifferentialRecord> = {}): DifferentialRecord {
  return {
    slug: "test-diagnosis",
    title: "Test diagnosis",
    status: "urgent",
    subtitle: "Subtitle line",
    clinicalHinge: "The clinical hinge.",
    safetySnapshot: { summary: "Safety summary.", tags: ["Sepsis"] },
    sections: [],
    related: [],
    currentPresentation: [],
    investigations: [],
    immediateActions: [],
    ...overrides,
  };
}

/**
 * `source` is deliberately typed one level deeper than `Partial<…>` gives us:
 * `Partial<DifferentialDetailContext>` makes the whole `source` object optional
 * but still demands every field once supplied, so `{ source: { sourceStatus } }`
 * would not compile. Callers here only ever care about one governance field.
 */
type DifferentialDetailContextOverrides = Partial<Omit<DifferentialDetailContext, "source">> & {
  source?: Partial<DifferentialDetailContext["source"]>;
};

function buildContext(overrides: DifferentialDetailContextOverrides = {}): DifferentialDetailContext {
  // Spread non-source overrides first, then rebuild `source` so a partial
  // `source` override cannot wipe version/exportedAt/review fields.
  const { source: sourceOverride, ...rest } = overrides;
  return {
    knownRelatedSlugs: [],
    relatedMapDetails: {},
    termLinks: {},
    overlapLinks: {},
    comparePresentation: null,
    ...rest,
    source: {
      version: "1.0.0",
      exportedAt: "2026-08-01T00:00:00.000Z",
      reviewStatus: "reviewed",
      sourceTitle: "Test source",
      sourceStatus: "current",
      validationStatus: "approved",
      ...sourceOverride,
    },
  };
}

/** A record with several expandable review sections and a few related diagnoses. */
function buildDenseRecord() {
  return buildRecord({
    sections: [
      buildSection({ id: "why-it-fits", items: ["Alpha", "Bravo"] }),
      buildSection({ id: "must-not-miss", tone: "warning", items: ["Charlie", "Delta"] }),
      buildSection({ id: "ask-next", tone: "question", items: ["Echo"] }),
      buildSection({ id: "do-now", tone: "action", items: ["Foxtrot"] }),
    ],
    related: [
      { id: "one", label: "One", likelihood: "possible", note: "" },
      { id: "two", label: "Two", likelihood: "must-not-miss", note: "" },
      { id: "three", label: "Three", likelihood: "less-likely", note: "" },
    ],
  });
}

describe("buildDifferentialSectionIndex", () => {
  it("returns every tab in DETAIL_TAB_IDS order", () => {
    const sections = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    expect(sections.map((section) => section.id)).toEqual([...DETAIL_TAB_IDS]);
  });

  it("keeps all five tabs even when the record has no related diagnoses", () => {
    // A track whose length changes between diagnoses reads as a rendering bug,
    // not as information — unlike the document index, nothing is omitted here.
    const sections = buildDifferentialSectionIndex(buildRecord(), buildContext());
    expect(sections).toHaveLength(DETAIL_TAB_IDS.length);
  });

  it("normalises weights to sum to one", () => {
    const sections = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    const total = sections.reduce((sum, section) => sum + section.weight, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(sections.every((section) => section.weight > 0)).toBe(true);
  });

  it("weights by real panel content rather than equal fifths", () => {
    const sections = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    expect(new Set(sections.map((section) => section.weight)).size).toBeGreaterThan(1);

    const byId = Object.fromEntries(sections.map((section) => [section.id, section]));
    // Overview holds the clinical review body; Source is a governance footer.
    expect(byId.overview!.weight).toBeGreaterThan(byId.source!.weight);
  });

  it("grows the overview segment as the record gains review sections", () => {
    const sparse = buildDifferentialSectionIndex(
      buildRecord({ sections: [buildSection({ items: ["Alpha"] })] }),
      buildContext(),
    );
    const dense = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    const overviewWeight = (list: ReturnType<typeof buildDifferentialSectionIndex>) =>
      list.find((section) => section.id === "overview")!.weight;
    expect(overviewWeight(dense)).toBeGreaterThan(overviewWeight(sparse));
  });

  it("counts only sections that actually render items", () => {
    // Matches `visibleSectionItems`, the predicate the Overview panel itself
    // uses — an empty section is not a segment of content.
    const withEmpties = buildDifferentialSectionIndex(
      buildRecord({ sections: [buildSection({ items: ["Alpha"] }), buildSection({ id: "empty", items: [] })] }),
      buildContext(),
    );
    expect(withEmpties.find((section) => section.id === "overview")!.detail).toBe("1 section");
  });

  it("reports the source governance status as the source row's detail", () => {
    const sections = buildDifferentialSectionIndex(
      buildRecord(),
      buildContext({ source: { sourceStatus: "review_due" } }),
    );
    expect(sections.find((section) => section.id === "source")!.detail).toBe("Review due");
  });

  it("prefers live governance source status over the bundled snapshot", () => {
    const sections = buildDifferentialSectionIndex(
      buildRecord(),
      buildContext({ source: { sourceStatus: "current" } }),
      "outdated",
    );
    expect(sections.find((section) => section.id === "source")!.detail).toBe("Outdated");
  });

  it("keeps complete source metadata when buildContext receives a partial source override", () => {
    const context = buildContext({ source: { sourceStatus: "outdated" } });
    expect(context.source).toMatchObject({
      version: "1.0.0",
      exportedAt: "2026-08-01T00:00:00.000Z",
      reviewStatus: "reviewed",
      sourceTitle: "Test source",
      sourceStatus: "outdated",
      validationStatus: "approved",
    });
  });

  it("never claims a tab opens an accordion", () => {
    // `collapsible` draws the trailing chevron in DocumentSectionList, which
    // means "this row opens first". Selecting a tab swaps a panel instead.
    const sections = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    expect(sections.every((section) => section.collapsible === false)).toBe(true);
  });
});

describe("DocumentSectionTrack with differential sections", () => {
  it("renders one weighted, decorative segment per tab", () => {
    const sections = buildDifferentialSectionIndex(buildDenseRecord(), buildContext());
    const { container } = render(<DocumentSectionTrack sections={sections} activeId="map" />);

    const track = container.querySelector('span[aria-hidden="true"]');
    expect(track).not.toBeNull();
    const segments = [...track!.children] as HTMLElement[];
    expect(segments).toHaveLength(DETAIL_TAB_IDS.length);

    // Weighted, not equal slices — the same guarantee the document track carries.
    const grows = segments.map((segment) => segment.style.flexGrow);
    expect(new Set(grows).size).toBeGreaterThan(1);

    // The track is decoration; the header subtitle carries the semantic label.
    expect(screen.queryByText("Map")).toBeNull();
  });
});
