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

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return {
    ...actual,
    loadRepoAwarenessSnapshot: () => {
      const snapshot = actual.loadRepoAwarenessSnapshot();
      if (sectionOverride.value === null) return snapshot;
      const section = sectionOverride.value;
      return {
        ...snapshot,
        documentation: {
          ...snapshot.documentation,
          documents: snapshot.documentation.documents.map((document, index) =>
            index === 0 ? { ...document, section } : document,
          ),
        },
      };
    },
  };
});

afterEach(() => {
  sectionOverride.value = null;
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
    expect(
      screen.getByRole("heading", { name: new RegExp("an-unrecognised-section") }),
    ).toBeInTheDocument();
  });
});
