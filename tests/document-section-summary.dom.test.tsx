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

describe("IndexedTextPanel citation landing", () => {
  it("keeps citation deep-links collapsed so the PDF stays the first reading surface", () => {
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
    expect(panel.open).toBe(false);
    expect(panel.querySelector("summary")).not.toHaveAttribute("aria-disabled");
  });

  it("opens on an explicit inspect request and keeps the cited chunk revealed", async () => {
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
        revealRequest
      />,
    );

    const panel = screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(true);
    const highlighted = screen.getByTestId("highlighted-indexed-source-chunk") as HTMLDetailsElement;
    await waitFor(() => expect(highlighted.open).toBe(true));
    expect(panel.querySelector("summary")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(panel.querySelector("summary")!);
    expect(panel.open).toBe(true);

    act(() => {
      panel.open = false;
      panel.dispatchEvent(new Event("toggle", { bubbles: true }));
    });
    await waitFor(() => expect(panel.open).toBe(true));
    expect(screen.getByTestId("highlighted-indexed-source-chunk")).toBeVisible();
    expect(highlighted.open).toBe(true);
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

  it("resets the active hit index when the search query changes", async () => {
    const props = {
      loading: false,
      selectedPage: basePage,
      chunks: [
        baseChunk,
        {
          ...baseChunk,
          id: "chunk-2",
          chunk_index: 1,
          content: "Lithium levels are checked 5 to 7 days after initiation",
        },
      ],
      search: "vom",
      documentSearchResults: [
        {
          id: "chunk-1",
          page_number: 1,
          chunk_index: 0,
          section_heading: "Monitoring",
          snippet: "Escalate review when there is vomiting",
          matched_terms: ["vom"],
          image_ids: [],
          score: 1,
        },
        {
          id: "chunk-2",
          page_number: 1,
          chunk_index: 1,
          section_heading: "Monitoring",
          snippet: "Lithium levels are checked 5 to 7 days after initiation",
          matched_terms: ["vom"],
          image_ids: [],
          score: 1,
        },
      ],
      searchingDocument: false,
      documentSearchError: null,
      idPrefix: "source-chunk",
      sectionId: "source-text" as const,
      onSearchChange: vi.fn(),
      compact: true,
    };
    const { rerender } = render(<IndexedTextPanel {...props} />);

    expect(screen.getByText("Hit 1 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next document search hit" }));
    expect(screen.getByText("Hit 2 of 2")).toBeVisible();

    rerender(<IndexedTextPanel {...props} search="head" documentSearchResults={props.documentSearchResults} />);
    expect(screen.getByText("Hit 1 of 2")).toBeVisible();
  });

  it("keeps the deep-linked nested chunk disclosure open under an inspect reveal", async () => {
    const props = {
      loading: false,
      selectedPage: basePage,
      chunks: [
        baseChunk,
        {
          ...baseChunk,
          id: "chunk-2",
          chunk_index: 1,
          content: "Lithium levels are checked 5 to 7 days after initiation",
        },
      ],
      search: "",
      documentSearchResults: [] as [],
      searchingDocument: false,
      documentSearchError: null,
      idPrefix: "source-chunk",
      sectionId: "source-text" as const,
      selectedChunkId: "chunk-1",
      onSearchChange: vi.fn(),
      compact: true,
      revealRequest: true,
    };
    const { rerender } = render(<IndexedTextPanel {...props} />);

    const highlighted = screen.getByTestId("highlighted-indexed-source-chunk") as HTMLDetailsElement;
    await waitFor(() => expect(highlighted.open).toBe(true));

    // A re-render must not collapse the React-controlled deep-link disclosure.
    rerender(<IndexedTextPanel {...props} chunks={[...props.chunks]} />);
    expect(highlighted.open).toBe(true);
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

  it("closes after inspect reveal clears on the same citation", () => {
    const props = {
      loading: false,
      selectedPage: basePage,
      chunks: [baseChunk],
      search: "",
      documentSearchResults: [] as [],
      searchingDocument: false,
      documentSearchError: null,
      idPrefix: "source-chunk",
      sectionId: "source-text" as const,
      selectedChunkId: "chunk-1",
      onSearchChange: vi.fn(),
      compact: true,
      revealRequest: true,
    };
    const { rerender } = render(<IndexedTextPanel {...props} />);
    const panel = screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(true);

    rerender(<IndexedTextPanel {...props} revealRequest={false} />);
    expect(panel.open).toBe(false);
  });

  it("resets compact open when the citation changes without a reveal request", () => {
    const props = {
      loading: false,
      selectedPage: basePage,
      chunks: [
        baseChunk,
        {
          ...baseChunk,
          id: "chunk-2",
          chunk_index: 1,
          content: "Lithium levels are checked 5 to 7 days after initiation",
        },
      ],
      search: "",
      documentSearchResults: [] as [],
      searchingDocument: false,
      documentSearchError: null,
      idPrefix: "source-chunk",
      sectionId: "source-text" as const,
      selectedChunkId: "chunk-1",
      onSearchChange: vi.fn(),
      compact: true,
      revealRequest: true,
    };
    const { rerender } = render(<IndexedTextPanel {...props} />);
    expect((screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement).open).toBe(true);

    rerender(<IndexedTextPanel {...props} selectedChunkId="chunk-2" revealRequest={false} />);
    expect((screen.getByTestId("source-chunk-indexed-text-panel") as HTMLDetailsElement).open).toBe(false);
  });
});
