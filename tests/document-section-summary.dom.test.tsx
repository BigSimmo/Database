import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileText } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { DocumentSectionSummary, IndexedTextPanel } from "@/components/document-viewer/source-panels";

const baseChunk = {
  id: "chunk-1",
  page_number: 1,
  chunk_index: 0,
  section_heading: "Monitoring",
  content: "Escalate review when there is vomiting",
  image_ids: [] as string[],
};

const basePage = { id: "page-1", page_number: 1, text: "Page body", ocr_used: false };

describe("DocumentSectionSummary", () => {
  it("keeps full-view headings non-interactive while condensed summaries toggle", () => {
    const { rerender } = render(
      <details open>
        <DocumentSectionSummary
          icon={FileText}
          title="Indexed source text"
          description="Extracted text"
          interactive={false}
        />
        <p>Body</p>
      </details>,
    );

    const inertSummary = screen.getByText("Indexed source text").closest("summary");
    expect(inertSummary).toHaveAttribute("aria-disabled", "true");
    expect(inertSummary).toHaveAttribute("tabindex", "-1");
    expect(inertSummary?.querySelector("svg.lucide-chevron-down")).toBeNull();
    fireEvent.click(inertSummary!);
    expect(inertSummary?.closest("details")).toHaveProperty("open", true);

    rerender(
      <details>
        <DocumentSectionSummary icon={FileText} title="Indexed source text" description="Extracted text" interactive />
        <p>Body</p>
      </details>,
    );

    const interactiveSummary = screen.getByText("Indexed source text").closest("summary");
    expect(interactiveSummary).not.toHaveAttribute("aria-disabled");
    expect(interactiveSummary?.querySelector("svg.lucide-chevron-down")).not.toBeNull();
  });
});

describe("IndexedTextPanel condensed reveal", () => {
  it("keeps deep-linked chunks revealed after exclusive-accordion close events", async () => {
    render(
      <IndexedTextPanel
        loading={false}
        selectedPage={basePage}
        chunks={[baseChunk]}
        search=""
        documentSearchResults={[]}
        searchingDocument={false}
        documentSearchError={null}
        idPrefix="source-chunk"
        sectionId="source-text"
        selectedChunkId="chunk-1"
        onSearchChange={vi.fn()}
        compact
      />,
    );

    const panel = screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(true);
    expect(screen.getByTestId("highlighted-indexed-source-chunk")).toBeVisible();
    expect(panel.querySelector("summary")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(panel.querySelector("summary")!);
    expect(panel.open).toBe(true);

    act(() => {
      panel.open = false;
      panel.dispatchEvent(new Event("toggle", { bubbles: true }));
    });
    await waitFor(() => expect(panel.open).toBe(true));
    expect(screen.getByTestId("highlighted-indexed-source-chunk")).toBeVisible();
  });

  it("keeps in-document search results revealed without a selected chunk", async () => {
    render(
      <IndexedTextPanel
        loading={false}
        selectedPage={basePage}
        chunks={[baseChunk]}
        search="vomiting"
        documentSearchResults={[
          {
            id: "chunk-1",
            page_number: 1,
            chunk_index: 0,
            section_heading: "Monitoring",
            snippet: "Escalate review when there is vomiting",
            matched_terms: ["vomiting"],
            image_ids: [],
            score: 1,
          },
        ]}
        searchingDocument={false}
        documentSearchError={null}
        idPrefix="source-chunk"
        sectionId="source-text"
        onSearchChange={vi.fn()}
        compact
      />,
    );

    const panel = screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(true);
    expect(panel.querySelector("summary")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Hit 1 of 1")).toBeVisible();

    fireEvent.click(panel.querySelector("summary")!);
    expect(panel.open).toBe(true);

    act(() => {
      panel.open = false;
      panel.dispatchEvent(new Event("toggle", { bubbles: true }));
    });
    await waitFor(() => expect(panel.open).toBe(true));
    expect(screen.getByText("Hit 1 of 1")).toBeVisible();
  });

  it("allows plain condensed panels to collapse and stay collapsed", async () => {
    render(
      <IndexedTextPanel
        loading={false}
        selectedPage={basePage}
        chunks={[baseChunk]}
        search=""
        documentSearchResults={[]}
        searchingDocument={false}
        documentSearchError={null}
        idPrefix="source-chunk"
        sectionId="source-text"
        onSearchChange={vi.fn()}
        compact
      />,
    );

    const panel = screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement;
    // No deep-link/search: starts closed in condensed mode unless manually opened.
    expect(panel.open).toBe(false);
    expect(panel.querySelector("summary")).not.toHaveAttribute("aria-disabled");

    fireEvent.click(panel.querySelector("summary")!);
    expect(panel.open).toBe(true);

    fireEvent.click(panel.querySelector("summary")!);
    await waitFor(() => expect(panel.open).toBe(false));
  });
});
