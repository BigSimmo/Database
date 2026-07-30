import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    const resultCard = screen.getByTestId("document-result-card");
    expect(within(resultCard).getByTestId("document-result-rank")).toHaveTextContent("1");
    expect(within(resultCard).queryByText("PDF", { exact: true })).toBeNull();
    expect(
      within(resultCard).getByRole("link", { name: `Preview page 3 of ${lithiumMatch.title}` }),
    ).toBeInTheDocument();
    expect(within(resultCard).getByRole("link", { name: `Open ${lithiumMatch.title}` })).toHaveTextContent("Open");

    const askButton = within(resultCard).getByRole("button", { name: `Ask about ${lithiumMatch.title}` });
    fireEvent.click(askButton);
    expect(baseProps.onAnswerFromDocument).toHaveBeenCalledWith(lithiumMatch.document_id);

    expect(within(resultCard).queryByRole("button", { name: /Scope search to/i })).toBeNull();
    const moreButton = within(resultCard).getByRole("button", { name: `More actions for ${lithiumMatch.title}` });
    fireEvent.click(moreButton);
    const menu = within(resultCard).getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Copy citation" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Copy link" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "View images (2)" })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Search only this source" }));
    expect(baseProps.onScopeDocument).toHaveBeenCalledWith(lithiumMatch.document_id);
  });
});
