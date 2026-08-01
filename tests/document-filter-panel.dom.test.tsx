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

  it("is a dialog, so it overlays the results rather than pushing them down", async () => {
    // The phone contract: the panel covers the list it describes instead of
    // displacing it, which is why the footer count is the thing that reports
    // what the current combination returns.
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);
    await user.click(screen.getByTestId("document-filter-trigger-phone"));

    const panel = screen.getByTestId("document-filter-panel");
    const dialog = panel.closest('[role="dialog"]') ?? panel;
    const trigger = screen.getByTestId("document-filter-trigger-phone");
    expect(dialog).toHaveAttribute("role", "dialog");
    // The trigger must name the dialog it opens. Asserting only `aria-haspopup`
    // would pass with a stale or wrong id, which is the whole point of wiring
    // `aria-controls` through Sheet's `id` prop.
    expect(dialog.id).not.toBe("");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);
    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    expect(screen.getByTestId("document-filter-panel")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("document-filter-panel")).toBeNull();
    const closedTrigger = screen.getByTestId("document-filter-trigger-phone");
    expect(closedTrigger).toHaveAttribute("aria-expanded", "false");
    expect(closedTrigger).not.toHaveAttribute("aria-controls");
  });

  it("releases the scroll lock when a refetch unmounts an open panel", async () => {
    // `showFilterControl` folds in `!loading`, so a refetch on the same query
    // unmounts the open Sheet. That skips Sheet's focus restore — but the
    // trigger is gated on the same flag and unmounts too, so there is no opener
    // left to restore to. What must not leak is the body scroll lock, and it
    // does not: `popSheet` runs in the same effect cleanup as the unmount.
    const user = userEvent.setup();
    const { rerender } = render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    expect(screen.getByTestId("document-filter-panel")).toBeInTheDocument();
    // Prove the lock was taken, or the release assertion below passes vacuously
    // the day the sheet stops locking at all.
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<DocumentSearchResultsPanel {...baseProps} loading />);

    expect(screen.queryByTestId("document-filter-panel")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
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

describe("applied-filter shelf", () => {
  async function selectClozapine(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    await user.click(within(screen.getByTestId("document-filter-panel")).getByRole("button", { name: /Clozapine/ }));
    await user.click(within(screen.getByTestId("document-filter-panel")).getByTestId("document-filter-done"));
  }

  it("shows an applied facet as a chip and removes it in one tap", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);
    expect(screen.queryByTestId("search-query-ribbon-shelf")).toBeNull();

    await selectClozapine(user);

    const shelf = screen.getByTestId("search-query-ribbon-shelf");
    expect(shelf).toHaveTextContent("Filtered by");
    expect(resultTitles()).toHaveLength(1);

    // One tap, and the count follows immediately.
    await user.click(within(shelf).getByRole("button", { name: /Remove Clozapine filter/ }));
    expect(resultTitles()).toHaveLength(2);
    expect(screen.queryByTestId("search-query-ribbon-shelf")).toBeNull();
  });

  it("carries the source type alongside facets, and Clear tears both down at once", async () => {
    const user = userEvent.setup();
    render(<DocumentSearchResultsPanel {...baseProps} />);

    await user.click(screen.getByTestId("document-filter-trigger-phone"));
    const panel = screen.getByTestId("document-filter-panel");
    await user.click(within(panel).getByRole("button", { name: /Clozapine/ }));
    await user.click(within(panel).getByRole("radio", { name: /Tables/ }));
    await user.click(within(panel).getByTestId("document-filter-done"));

    const shelf = screen.getByTestId("search-query-ribbon-shelf");
    expect(within(shelf).getByRole("button", { name: /Remove Clozapine filter/ })).toBeInTheDocument();
    expect(within(shelf).getByRole("button", { name: /Remove Tables filter/ })).toBeInTheDocument();

    // Clear appears only past one chip — teardown that used to be one tap each.
    await user.click(within(shelf).getByTestId("search-query-ribbon-shelf-clear"));
    expect(screen.queryByTestId("search-query-ribbon-shelf")).toBeNull();
    expect(resultTitles()).toHaveLength(2);
  });

  it("survives a pending search, because chips must not flicker on every keystroke", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DocumentSearchResultsPanel {...baseProps} />);
    await selectClozapine(user);
    expect(screen.getByTestId("search-query-ribbon-shelf")).toBeInTheDocument();

    rerender(<DocumentSearchResultsPanel {...baseProps} loading />);

    expect(screen.getByTestId("search-query-ribbon-shelf")).toBeInTheDocument();
  });

  it("drops only on a fault, where filtering a set that never loaded is meaningless", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DocumentSearchResultsPanel {...baseProps} />);
    await selectClozapine(user);

    rerender(<DocumentSearchResultsPanel {...baseProps} apiUnavailable realDataReady={false} />);

    expect(screen.queryByTestId("search-query-ribbon-shelf")).toBeNull();
  });
});
