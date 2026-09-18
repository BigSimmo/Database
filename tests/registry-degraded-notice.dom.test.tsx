import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";
import { catalogueDegradedNotice } from "@/lib/site-content/catalogue-seed-fallback";
import { serviceRecords } from "@/lib/services";

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

const recordMatches = [{ service: serviceRecords[0], score: 12, reasons: ["Title match"] }];

const baseProps = {
  matches: [],
  recordMatches,
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

describe("registry search results say when the catalogue may be stale", () => {
  it("carries the shared notice on the results heading and the count band", () => {
    render(<DocumentSearchResultsPanel {...baseProps} recordDegraded />);

    // Both places a reader looks at while scanning results: the count line that pins at the
    // top of the page, and the heading of the section holding the records themselves.
    const notices = screen.getAllByText(new RegExp(catalogueDegradedNotice, "i"));
    expect(notices.length).toBeGreaterThanOrEqual(2);
  });

  it("says nothing when the published catalogue was read normally", () => {
    render(<DocumentSearchResultsPanel {...baseProps} />);

    expect(screen.queryByText(new RegExp(catalogueDegradedNotice, "i"))).toBeNull();
  });

  it("pins the wording so a second phrasing cannot appear on this surface", () => {
    expect(catalogueDegradedNotice).toBe("may be out of date");
  });
});
