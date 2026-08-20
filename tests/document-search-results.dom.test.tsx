import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/documents/search",
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

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
  tableCount: 0,
});

const suicideDoc = match({
  document_id: "22222222-2222-4222-8222-222222222222",
  title: "Suicide Risk Assessment",
  labels: [label("22222222-2222-4222-8222-222222222222", "suicide", "risk")],
  tableCount: 0,
});

const baseProps = {
  matches: [clozapineDoc, suicideDoc],
  query: "assessment",
  loading: false,
  documentCount: 2561,
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

describe("DocumentSearchResultsPanel (#GBBYTA)", () => {
  it("hoists SearchResultsEmptyState directly under workspace when filtered to zero", () => {
    // When facets across different groups filter matches to 0 (AND combination across groups):
    window.history.replaceState(null, "", "/documents/search?facet=medication:clozapine,risk:suicide");

    render(<DocumentSearchResultsPanel {...baseProps} />);

    // Empty state is rendered
    const emptyState = screen.getByTestId("document-filter-empty-results");
    expect(emptyState).toBeInTheDocument();

    // Verify it is a direct child of document-search-workspace (sits flush under results band)
    const workspace = screen.getByTestId("document-search-workspace");
    expect(emptyState.parentElement).toBe(workspace);

    // Verify no grid wrapper is rendered around or beside it
    expect(screen.queryByTestId("document-result-card")).not.toBeInTheDocument();
    expect(workspace.querySelector(".grid.gap-3")).toBeNull();
  });

  it("renders the results grid when sorted matches exist", () => {
    window.history.replaceState(null, "", "/documents/search?facet=medication:clozapine");

    render(<DocumentSearchResultsPanel {...baseProps} />);

    const workspace = screen.getByTestId("document-search-workspace");
    expect(screen.getByTestId("document-result-card")).toBeInTheDocument();
    expect(screen.queryByTestId("document-filter-empty-results")).not.toBeInTheDocument();

    // Grid container is present
    expect(workspace.querySelector(".grid.gap-3")).not.toBeNull();
  });

  it("restores the results grid when clearing all filters from the hoisted empty state", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/documents/search?facet=medication:clozapine,risk:suicide");

    const { rerender } = render(<DocumentSearchResultsPanel {...baseProps} />);

    expect(screen.getByTestId("document-filter-empty-results")).toBeInTheDocument();

    // Click "Clear all filters" in the empty state
    await user.click(screen.getByRole("button", { name: /clear all filters/i }));

    // Rerender with a fresh matches reference to bust memo and read the new URL
    rerender(<DocumentSearchResultsPanel {...baseProps} matches={[...baseProps.matches]} />);

    // Results grid and cards should now be rendered
    expect(screen.getAllByTestId("document-result-card")).toHaveLength(2);
    expect(screen.queryByTestId("document-filter-empty-results")).not.toBeInTheDocument();
  });
});
