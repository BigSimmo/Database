import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentSearchResultsPanel } from "@/components/clinical-dashboard/document-search-results";
import { removeScopeFilterValue, scopeFilterChips } from "@/lib/search-scope-filter-chips";
import type { SearchScopeSummary } from "@/lib/types";

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
  usePathname: () => "/",
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
  query: "Agitation",
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

/**
 * The shape `/api/search` returns when `resolveSearchScope` finds no document
 * for the requested filters: it short-circuits before retrieval, so the result
 * set is empty and `scope` carries the only explanation.
 */
const scopedToZero: SearchScopeSummary = {
  summary: "No matching documents",
  activeFilterCount: 1,
  matchedDocumentCount: 0,
  warnings: ["No indexed documents matched the selected label filters."],
  queryMode: "auto",
};

describe("documents zero-result state with an active scope filter", () => {
  it("names the filter instead of blaming the query", () => {
    render(
      <DocumentSearchResultsPanel
        {...baseProps}
        searchScope={scopedToZero}
        scopeFilters={{ topics: ["agitation"] }}
        onScopeFiltersChange={vi.fn()}
      />,
    );

    // The regression: a scoped-to-zero search told the reader to re-spell a
    // query that was never the problem, while the filter that emptied it was
    // neither named nor reachable (the Filter trigger is gated on matches > 0).
    expect(screen.queryByText(/check the spelling/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no documents match the selected filter/i)).toBeInTheDocument();
    expect(screen.getByText(/the filters above excluded everything/i)).toBeInTheDocument();
    // Named in the one-tap undo, which is the whole point: the reader can see
    // what is constraining the search and relax it without leaving the state.
    expect(screen.getByRole("button", { name: /remove .*topic: agitation/i })).toBeInTheDocument();
  });

  it("relaxes the single filter that emptied the search", async () => {
    const onScopeFiltersChange = vi.fn();
    render(
      <DocumentSearchResultsPanel
        {...baseProps}
        searchScope={{ ...scopedToZero, activeFilterCount: 2 }}
        scopeFilters={{ topics: ["agitation"], documentTypes: ["guideline"] }}
        onScopeFiltersChange={onScopeFiltersChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /remove .*type: guideline/i }));
    expect(onScopeFiltersChange).toHaveBeenCalledWith({ topics: ["agitation"] });
  });

  it("clears every scope filter at once", async () => {
    const onScopeFiltersChange = vi.fn();
    render(
      <DocumentSearchResultsPanel
        {...baseProps}
        searchScope={{ ...scopedToZero, activeFilterCount: 2 }}
        scopeFilters={{ topics: ["agitation"], sites: ["FSH"] }}
        onScopeFiltersChange={onScopeFiltersChange}
      />,
    );

    // Only offered beyond a single filter — with one, "Remove …" already is the
    // clear-all, and two buttons doing the same thing is the defect this shared
    // state was built to avoid.
    await userEvent.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onScopeFiltersChange).toHaveBeenCalledWith({});
  });

  it("keeps the query-based copy when nothing was scoped", () => {
    render(
      <DocumentSearchResultsPanel
        {...baseProps}
        searchScope={{
          summary: "All public documents",
          activeFilterCount: 0,
          matchedDocumentCount: null,
          warnings: [],
        }}
        scopeFilters={{}}
        onScopeFiltersChange={vi.fn()}
      />,
    );

    // An unscoped search really did fail to match, so the spelling hint is right
    // here — the fix must not relabel every empty result as filtered.
    expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
    expect(screen.getByText(/check the spelling/i)).toBeInTheDocument();
  });
});

describe("scope filter chips", () => {
  it("names the group so a bare value is not ambiguous", () => {
    expect(scopeFilterChips({ topics: ["agitation"], sites: ["FSH"], locality: "local" })).toEqual([
      { id: "scope:topics:agitation", label: "Topic: agitation" },
      { id: "scope:sites:FSH", label: "Site: FSH" },
      { id: "scope:locality:local", label: "Locality: local" },
    ]);
  });

  it("drops a key that empties out so the search stops reporting itself as scoped", () => {
    expect(removeScopeFilterValue({ topics: ["agitation"] }, "scope:topics:agitation")).toEqual({});
  });

  it("keeps sibling values in the same group", () => {
    expect(removeScopeFilterValue({ topics: ["agitation", "delirium"] }, "scope:topics:agitation")).toEqual({
      topics: ["delirium"],
    });
  });

  it("removes the locality enum", () => {
    expect(removeScopeFilterValue({ locality: "local" }, "scope:locality:local")).toEqual({});
  });

  it("ignores an unknown chip rather than mutating the scope", () => {
    expect(removeScopeFilterValue({ topics: ["agitation"] }, "scope:topics:nope")).toEqual({
      topics: ["agitation"],
    });
  });
});
