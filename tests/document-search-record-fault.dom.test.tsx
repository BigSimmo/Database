import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";

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
});
