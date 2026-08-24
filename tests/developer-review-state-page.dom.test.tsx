import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeveloperReviewStatePage from "@/app/mockups/development/review-state/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

// PanelPageShell's back control is a ContextualBackLink, which calls
// next/navigation's useRouter for its history-aware click handler. Outside an
// app-router tree that throws "invariant expected app router to be mounted",
// so every render here needs the router mocked, same as the hub page test.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/development/review-state",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return { ...actual, loadRepoAwarenessSnapshot: vi.fn(actual.loadRepoAwarenessSnapshot) };  it("renders a clear empty state instead of an empty review list", () => {
    vi.mocked(loadRepoAwarenessSnapshot).mockReturnValue({
      ...snapshot,
      review_state: { ...snapshot.review_state, records: [], counts: { records: 0, refs: 0 } },
    });

    render(<DeveloperReviewStatePage />);

    expect(screen.getByTestId("developer-review-state-empty")).toHaveTextContent(
      "No immutable review records are committed.",
    );
    expect(screen.queryByTestId("developer-review-state-records")).not.toBeInTheDocument();
  });
});

const snapshot = loadRepoAwarenessSnapshot();

describe("developer review state page", () => {
  it("renders inside the shared shell with the repository freshness label", () => {
    render(<DeveloperReviewStatePage />);
    expect(screen.getByTestId("developer-review-state")).toBeInTheDocument();
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows records and distinct recorded refs as separate readable values", () => {
    render(<DeveloperReviewStatePage />);
    expect(screen.getByTestId("developer-review-state-count-records-value")).toHaveTextContent(
      String(snapshot.review_state.counts.records),
    );
    expect(screen.getByTestId("developer-review-state-count-refs-value")).toHaveTextContent(
      String(snapshot.review_state.counts.refs),
    );
    expect(screen.getByText("distinct recorded refs")).toBeInTheDocument();
  });

  it("states what the page does not show, so a reader cannot infer live pull-request state", () => {
    render(<DeveloperReviewStatePage />);
    expect(screen.getByTestId("developer-review-state-scope")).toHaveTextContent(/does not show/i);
    expect(screen.getByTestId("developer-review-state-scope")).toHaveTextContent(/pull request/i);
  });

  it("renders every record, dropping none", () => {
    render(<DeveloperReviewStatePage />);
    expect(within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem")).toHaveLength(
      snapshot.review_state.counts.records,
    );
  });

  it("shows the newest record first and never a raw escaped pipe", () => {
    render(<DeveloperReviewStatePage />);
    const rows = within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(snapshot.review_state.records[0].head);
    expect(screen.getByTestId("developer-review-state-records").textContent).not.toMatch(/\\\|/);
  });

  it("renders a record's outcome verbatim, in full, never classified or truncated (ruling R7)", () => {
    // Nothing branches on `outcome` today, so this ruling holds by
    // construction — but that also means a future edit adding, say,
    // colour-coded badges or a `slice(0, 80)` truncation would pass every
    // other assertion in this file. Picking the record with the longest
    // outcome, rather than any record, is what makes a truncation regression
    // fail here: a short outcome could stay a false substring match of itself
    // even after truncation.
    render(<DeveloperReviewStatePage />);
    const rows = within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem");
    let longestIndex = 0;
    for (const [index, record] of snapshot.review_state.records.entries()) {
      if (record.outcome.length > snapshot.review_state.records[longestIndex].outcome.length) longestIndex = index;
    }
    const longestRecord = snapshot.review_state.records[longestIndex];
    expect(longestRecord.outcome.length).toBeGreaterThan(40);
    expect(rows[longestIndex]).toHaveTextContent(longestRecord.outcome);
  });
});
