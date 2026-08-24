import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeveloperDocumentationPage from "@/app/mockups/development/documentation/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

/**
 * Overrides ride on top of the *real* committed snapshot, following
 * `tests/developer-routes-page.dom.test.tsx`'s `areaOverride` pattern: 0 of
 * 279 live documents reference a `section` outside `documentation.sections`,
 * so an orphan section can only be exercised against a fixture, never against
 * live data. `null` means "do not override".
 */
const sectionOverride = vi.hoisted(() => ({ value: null as string | null }));

/**
 * Forces every document catalogued on top of the real snapshot, whose 180
 * uncatalogued documents mean the existing count-driven assertion never takes
 * the "None." branch. `false` means "do not override".
 */
const allCataloguedOverride = vi.hoisted(() => ({ value: false }));

/**
 * Adds a section with zero documents. `documentsBySection` pre-seeds one
 * bucket per name in `documentation.sections`, so naming one here that no
 * document's `section` field points at produces an empty bucket without
 * touching the document list — exercising the zero-document section render
 * the live snapshot never reaches (every section it lists has at least one
 * document). `null` means "do not override".
 */
const emptySectionOverride = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return {
    ...actual,
    loadRepoAwarenessSnapshot: () => {
      let snapshot = actual.loadRepoAwarenessSnapshot();
      if (sectionOverride.value !== null) {
        const section = sectionOverride.value;
        snapshot = {
          ...snapshot,
          documentation: {
            ...snapshot.documentation,
            documents: snapshot.documentation.documents.map((document, index) =>
              index === 0 ? { ...document, section } : document,
            ),
          },
        };
      }
      if (allCataloguedOverride.value) {
        snapshot = {
          ...snapshot,
          documentation: {
            ...snapshot.documentation,
            documents: snapshot.documentation.documents.map((document) => ({ ...document, catalogued: true })),
            counts: {
              ...snapshot.documentation.counts,
              catalogued: snapshot.documentation.counts.documents,
              uncatalogued: 0,
            },
          },
        };
      }
      if (emptySectionOverride.value !== null) {
        const name = emptySectionOverride.value;
        snapshot = {
          ...snapshot,
          documentation: {
            ...snapshot.documentation,
            sections: [...snapshot.documentation.sections, { name, documents: 0, uncatalogued: 0 }],
          },
        };
      }
      return snapshot;
    },
  };
});

afterEach(() => {
  sectionOverride.value = null;
  allCataloguedOverride.value = false;
  emptySectionOverride.value = null;
});

const snapshot = loadRepoAwarenessSnapshot();

describe("developer documentation page", () => {
  it("renders inside the shared shell with the repository freshness label", () => {
    render(<DeveloperDocumentationPage />);
    expect(screen.getByTestId("developer-documentation")).toBeInTheDocument();
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows each count as its own readable value", () => {
    render(<DeveloperDocumentationPage />);
    const { counts } = snapshot.documentation;
    expect(screen.getByTestId("developer-documentation-count-documents-value")).toHaveTextContent(
      String(counts.documents),
    );
    expect(screen.getByTestId("developer-documentation-count-uncatalogued-value")).toHaveTextContent(
      String(counts.uncatalogued),
    );
  });

  it("leads with the documents missing from the index, because that is the actionable list", () => {
    render(<DeveloperDocumentationPage />);
    const region = screen.getByTestId("developer-documentation-uncatalogued");
    const { uncatalogued } = snapshot.documentation.counts;
    if (uncatalogued === 0) expect(region).toHaveTextContent(/Every document.*index/i);
    else expect(within(region).getAllByRole("listitem")).toHaveLength(uncatalogued);
  });

  it("lists every document under its section, so the sections add up to the total", () => {
    render(<DeveloperDocumentationPage />);
    const rendered = within(screen.getByTestId("developer-documentation-sections")).getAllByRole("listitem");
    expect(rendered).toHaveLength(snapshot.documentation.counts.documents);
  });

  it("marks each document as indexed or not, rather than leaving the reader to guess", () => {
    render(<DeveloperDocumentationPage />);
    const sample = snapshot.documentation.documents[0];
    const row = screen.getByTestId(`developer-documentation-document-${sample.path}`);
    expect(row).toHaveTextContent(sample.catalogued ? /in the index/i : /not in the index/i);
  });

  it("renders a document whose section the summary does not recognise under its own heading, instead of dropping it", () => {
    // The live snapshot's generator only ever emits sections that
    // `documentation.sections` already lists, so this state is reached only
    // through the fixture override above — 0 of 279 live documents exercise it.
    sectionOverride.value = "an-unrecognised-section";
    const overridden = loadRepoAwarenessSnapshot();
    const target = overridden.documentation.documents[0];
    render(<DeveloperDocumentationPage />);

    const region = screen.getByTestId("developer-documentation-sections");
    // Still present, not discarded: the orphan document is findable by its own
    // row test id inside the sections region.
    expect(within(region).getByTestId(`developer-documentation-document-${target.path}`)).toBeInTheDocument();
    // Still counted: the sections still add up to the full document total even
    // though one document sits under a heading the summary never listed.
    expect(within(region).getAllByRole("listitem")).toHaveLength(overridden.documentation.counts.documents);
    // Rendered under its own heading, named as it stands.
    expect(screen.getByRole("heading", { name: new RegExp("an-unrecognised-section") })).toBeInTheDocument();
  });

  it("says every document is indexed, in words, when none are missing — the branch the live snapshot's 180 uncatalogued documents never take", () => {
    allCataloguedOverride.value = true;
    render(<DeveloperDocumentationPage />);
    const region = screen.getByTestId("developer-documentation-uncatalogued");
    expect(region.tagName).toBe("P");
    expect(region).toHaveTextContent("Every document on disk is named in the index.");
  });

  it("says in words when a known section has no documents, instead of rendering a blank list", () => {
    // Unreachable against the live snapshot: a section only exists there
    // because a document names it. The fixture adds a section entry with no
    // matching document to exercise the render anyway.
    emptySectionOverride.value = "an-empty-section";
    render(<DeveloperDocumentationPage />);
    const heading = screen.getByRole("heading", { name: /an-empty-section · 0/ });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).queryByRole("list")).toBeNull();
    expect(section).toHaveTextContent("No documents are recorded under this section.");
  });
});
