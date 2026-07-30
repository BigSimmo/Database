import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";
import type { DocumentMatch } from "@/lib/types";

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
  usePathname: () => "/services",
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

const baseProps = {
  matches: [],
  recordMatches: [],
  recordMode: "services" as const,
  showRecordMatches: true,
  query: "crisis",
  loading: false,
  documentCount: 0,
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

const lithiumMatch: DocumentMatch = {
  document_id: "11111111-1111-4111-8111-111111111111",
  title: "Lithium Clinical Guideline",
  file_name: "lithium-guideline.pdf",
  labels: [],
  summarySnippet: "Lithium monitoring guidance.",
  bestPages: [3],
  bestChunkIds: ["44444444-4444-4444-8444-444444444444"],
  imageCount: 2,
  tableCount: 0,
  matchReason: "Matched indexed passage",
  score: 0.96,
};

describe("document search record path fault reporting", () => {
  it("reports a failed registry once, not twice", () => {
    render(<DocumentSearchResultsPanel {...baseProps} recordStatus="error" />);

    // The band owns the failure. The legacy notice repeating "Couldn't load the
    // services registry" underneath it is the double-report this guards.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/Couldn't load the services registry/i)).toBeNull();
  });

  it("still reports an expired session once", () => {
    render(<DocumentSearchResultsPanel {...baseProps} recordStatus="unauthorized" />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/search your private services registry/i)).toBeNull();
  });

  it("keeps the loading notice, which the band does not duplicate", () => {
    // The band only says "Searching…" while loading, so this notice is the only
    // thing naming the registry — suppressing it here would lose information.
    render(<DocumentSearchResultsPanel {...baseProps} recordStatus="loading" />);

    expect(screen.getByText(/Loading your services registry/i)).toBeInTheDocument();
  });

  it("keeps document results free of the selected-evidence panel while governance warnings remain", () => {
    render(
      <DocumentSearchResultsPanel
        {...baseProps}
        matches={[lithiumMatch]}
        recordMatches={[]}
        showRecordMatches={false}
        query="lithium"
        sourceGovernanceWarnings={[
          {
            code: "outdated_source",
            severity: "danger",
            message: "One or more supporting sources are marked outdated.",
            title: lithiumMatch.title,
          },
          {
            code: "review_due_source",
            severity: "warning",
            message: "One or more supporting sources are due for review.",
            title: lithiumMatch.title,
          },
        ]}
      />,
    );

    expect(screen.getAllByText(lithiumMatch.title).length).toBeGreaterThan(0);
    expect(screen.queryByRole("complementary", { name: "Selected document evidence" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Preview evidence/i })).toBeNull();
    expect(screen.getByText("1 source marked outdated.")).toBeInTheDocument();
    expect(screen.getByText("1 source due for review.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Open ${lithiumMatch.title}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Scope search to ${lithiumMatch.title}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Answer from ${lithiumMatch.title}` })).toBeInTheDocument();
  });
});

describe("document search state matrix", () => {
  const documentProps = {
    ...baseProps,
    showRecordMatches: false,
    recordMatches: [],
  };

  it("announces loading and replaces it with the empty result after the request settles", () => {
    const { rerender } = render(<DocumentSearchResultsPanel {...documentProps} query="lithium" loading />);

    const loadingLabel = screen.getByText("Finding matching documents");
    expect(loadingLabel.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByText("No matching documents")).not.toBeInTheDocument();

    rerender(<DocumentSearchResultsPanel {...documentProps} query="lithium" loading={false} />);
    expect(screen.queryByText("Finding matching documents")).not.toBeInTheDocument();
    expect(screen.getByText("No matching documents")).toBeInTheDocument();
  });

  it("renders the document home for an empty query and wires every escape action", async () => {
    const user = userEvent.setup();
    const onOpenRecentDocuments = vi.fn();
    const onOpenLibrary = vi.fn();
    const onOpenSourcePdf = vi.fn();
    render(
      <DocumentSearchResultsPanel
        {...documentProps}
        query=""
        onOpenRecentDocuments={onOpenRecentDocuments}
        onOpenLibrary={onOpenLibrary}
        onOpenSourcePdf={onOpenSourcePdf}
      />,
    );

    expect(screen.getByTestId("document-search-empty-state")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Recent documents/i }));
    await user.click(screen.getByRole("button", { name: /Browse sources/i }));
    await user.click(screen.getByRole("button", { name: /Open a source PDF/i }));
    expect(onOpenRecentDocuments).toHaveBeenCalledTimes(1);
    expect(onOpenLibrary).toHaveBeenCalledTimes(1);
    expect(onOpenSourcePdf).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable document search alongside the empty-result guidance", () => {
    render(<DocumentSearchResultsPanel {...documentProps} query="lithium" realDataReady={false} apiUnavailable />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/No matching documents/)).toBeInTheDocument();
  });
});
