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

// #1M22X5 (owner decision, Josh, 2026-09-25): the relevance chip says what the
// verdict says in words — "Strong match", "Partial match", "Nearby only" — and
// never a percentage. The percentages were hard-coded per verdict (96/84/78), so
// they measured nothing, and a nearby-only result always read "Relevant, 78%".
describe("DocumentSearchResultsPanel relevance chip (#1M22X5)", () => {
  function withVerdict(id: string, title: string, verdict: string | null, score: number) {
    return match({
      document_id: id,
      title,
      score,
      ...(verdict
        ? { relevance: { verdict, score, matchedTerms: [], missingTerms: [], isSourceBacked: false } as never }
        : {}),
    });
  }

  // Deliberately ordered AGAINST both the verdict and the raw score, so any
  // re-sort by either would show up as a changed order.
  const nearby = withVerdict("33333333-3333-4333-8333-333333333333", "Nearby Document", "nearby", 0.99);
  const partial = withVerdict("44444444-4444-4444-8444-444444444444", "Partial Document", "partial", 0.2);
  const direct = withVerdict("55555555-5555-4555-8555-555555555555", "Direct Document", "direct", 0.1);
  const none = withVerdict("66666666-6666-4666-8666-666666666666", "Unmatched Document", "none", 0.95);
  const unknown = withVerdict("77777777-7777-4777-8777-777777777777", "Unassessed Document", null, 0.97);

  function renderCards() {
    window.history.replaceState(null, "", "/documents/search");
    render(<DocumentSearchResultsPanel {...baseProps} matches={[nearby, partial, direct, none, unknown]} />);
    return screen.getAllByTestId("document-result-card");
  }

  it("labels each verdict in words, for sighted and screen-reader users alike", () => {
    const cards = renderCards();
    const chipText = (card: HTMLElement) => card.textContent ?? "";
    expect(chipText(cards[0]!)).toContain("Nearby only");
    expect(chipText(cards[1]!)).toContain("Partial match");
    expect(chipText(cards[2]!)).toContain("Strong match");
    // Below "nearby" the product's existing honest label is used, never a
    // stronger word than the verdict earns.
    expect(chipText(cards[3]!)).toContain("No direct support");
    expect(chipText(cards[4]!)).toContain("No direct support");
    for (const card of cards) {
      expect(chipText(card)).not.toMatch(/\d+\s*%/);
      expect(chipText(card)).not.toMatch(/High relevance|\bRelevant\b|\bRelated\b/);
    }
  });

  it("keeps the server's result order: the chip never re-sorts results", () => {
    const cards = renderCards();
    expect(cards.map((card) => card.querySelector("h3 .line-clamp-2")?.textContent ?? "")).toEqual([
      "Nearby Document",
      "Partial Document",
      "Direct Document",
      "Unmatched Document",
      "Unassessed Document",
    ]);
  });
});
