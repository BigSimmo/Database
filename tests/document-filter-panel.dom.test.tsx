import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";
import type { DocumentLabel, DocumentMatch } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/documents/search",
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    session: null,
    isConfigured: true,
    authorizationHeader: () => null,
    registerAuthRequest: vi.fn(),
    isAuthEpochCurrent: () => true,
    markSessionExpired: vi.fn(),
  }),
}));

function label(documentId: string, text: string, type: DocumentLabel["label_type"]): DocumentLabel {
  return {
    id: `${documentId}-${text}`,
    document_id: documentId,
    label: text,
    label_type: type,
    source: "generated",
    confidence: 0.9,
  };
}

function match(overrides: Partial<DocumentMatch> & { document_id: string; title: string }): DocumentMatch {
  return {
    file_name: `${overrides.document_id}.pdf`,
    labels: [],
    summarySnippet: "Synthetic summary.",
    bestPages: [1],
    bestChunkIds: [`${overrides.document_id}-chunk`],
    imageCount: 0,
    tableCount: 0,
    matchReason: "Matched indexed passage",
    score: 0.9,
    ...overrides,
  };
}

const clozapineDoc = match({
  document_id: "11111111-1111-4111-8111-111111111111",
  title: "Clozapine Monitoring Protocol",
  labels: [label("11111111-1111-4111-8111-111111111111", "clozapine", "medication")],
  tableCount: 2,
});

const lithiumDoc = match({
  document_id: "22222222-2222-4222-8222-222222222222",
  title: "Lithium Monitoring Protocol",
  labels: [label("22222222-2222-4222-8222-222222222222", "lithium", "medication")],
});

const baseProps = {
  matches: [clozapineDoc, lithiumDoc],
  recordMatches: [],
  showRecordMatches: false,
  query: "monitoring",
  loading: false,
  documentCount: 2,
  realDataReady: true,
  authUnavailable: false,
  apiUnavailable: false,
  setupWarning: null,
  onScopeDocument: vi.fn(),
  onAnswerFromDocument: vi.fn(),
  onOpenRecentDocuments: vi.fn(),
  onOpenLibrary: vi.fn(),
  onOpenSourcePdf: vi.fn(),
  onTagSearch: vi.fn(),
};

function resultTitles() {
  return screen
    .getAllByTestId("document-result-card")
    .map((card) => within(card).getAllByRole("heading")[0]?.textContent ?? "");
}

describe("document filter panel", () => {
  it("is reachable from the ribbon trigger", async () => {
    // The regression this pins: the facet rail used to be mounted only when a
    // facet was already selected, and the only controls that could select one
    // lived inside that same gated subtree. So no sequence of clicks reached it.
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);

    expect(screen.queryByTestId("document-filter-panel")).toBeNull();

    const trigger = screen.getByTestId("document-filter-trigger-phone");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);

    expect(screen.getByTestId("document-filter-panel")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("carries source type and tag facets in one panel", async () => {
    // Source type used to be a separate chip row in the ribbon on desktop and a
    // native select on phones. One panel means one place to see and undo
    // everything narrowing the list.
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);
    await user.click(screen.getByTestId("document-filter-trigger-phone"));

    const panel = screen.getByTestId("document-filter-panel");
    expect(within(panel).getByRole("radiogroup", { name: "Source type" })).toBeInTheDocument();
    // Mutually exclusive, so radio semantics rather than four independent toggles.
    expect(within(panel).getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
    expect(within(panel).getByRole("button", { name: /Clozapine/ })).toBeInTheDocument();
  });

  it("filters the result list when a facet is selected", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);
    expect(resultTitles()).toHaveLength(2);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    await user.click(within(screen.getByTestId("document-filter-panel")).getByRole("button", { name: /Clozapine/ }));

    expect(resultTitles()).toEqual([expect.stringContaining("Clozapine Monitoring Protocol")]);
    expect(screen.getByTestId("document-filter-trigger-phone")).toHaveTextContent("1");
  });

  it("filters by source type from the same panel", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    await user.click(within(screen.getByTestId("document-filter-panel")).getByRole("radio", { name: /Tables/ }));

    // Only the clozapine document carries tables.
    expect(resultTitles()).toEqual([expect.stringContaining("Clozapine Monitoring Protocol")]);
  });

  it("clears both filter kinds at once", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    const panel = () => screen.getByTestId("document-filter-panel");
    await user.click(within(panel()).getByRole("radio", { name: /Tables/ }));
    await user.click(within(panel()).getByRole("button", { name: /Clozapine/ }));
    expect(resultTitles()).toHaveLength(1);

    await user.click(within(panel()).getByTestId("document-filter-clear"));

    expect(resultTitles()).toHaveLength(2);
    expect(within(panel()).getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
  });

  it("closes on Show N documents", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    const done = within(screen.getByTestId("document-filter-panel")).getByTestId("document-filter-done");
    expect(done).toHaveTextContent("Show 2 documents");

    await user.click(done);
    expect(screen.queryByTestId("document-filter-panel")).toBeNull();
  });

  it("closes when the search query changes", async () => {
    // Open state is query-scoped (same contract as facet keys). A new submit must
    // not leave the panel covering a different result set.
    const user = userEvent.setup();
    const { rerender } = render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    expect(screen.getByTestId("document-filter-panel")).toBeInTheDocument();

    rerender(<DocumentSearchResultsPanel {...baseProps} query="lithium" />);
    expect(screen.queryByTestId("document-filter-panel")).toBeNull();
    expect(screen.getByTestId("document-filter-trigger-phone")).toHaveAttribute("aria-expanded", "false");
  });
});
