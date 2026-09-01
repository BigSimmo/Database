import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReviewStatePageContent } from "@/components/developer-area/hub/review-state-page-content";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

// PanelPageShell's back control is a ContextualBackLink, which calls
// next/navigation's useRouter for its history-aware click handler. Outside an
// app-router tree that throws "invariant expected app router to be mounted",
// so every render here needs the router mocked, same as the hub page test.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/development/review-state",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

// Pagination is now real ?page=N navigation (ReviewStateTable renders next/link,
// not client state) — mirrors tests/ward-capacity-view.dom.test.tsx: a plain <a>
// avoids requiring an App Router context jsdom cannot provide, and lets these
// tests assert the href a click would follow instead of simulating the
// navigation itself.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return { ...actual, loadRepoAwarenessSnapshot: vi.fn(actual.loadRepoAwarenessSnapshot) };
});

const snapshot = loadRepoAwarenessSnapshot();

describe("developer review state page", () => {
  it("renders inside the shared shell with the repository freshness label", () => {
    render(<ReviewStatePageContent />);
    expect(screen.getByTestId("developer-review-state")).toBeInTheDocument();
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows records and distinct recorded refs as separate readable values", () => {
    render(<ReviewStatePageContent />);
    expect(screen.getByTestId("developer-review-state-count-records-value")).toHaveTextContent(
      String(snapshot.review_state.counts.records),
    );
    expect(screen.getByTestId("developer-review-state-count-refs-value")).toHaveTextContent(
      String(snapshot.review_state.counts.refs),
    );
    expect(screen.getByText("distinct recorded refs")).toBeInTheDocument();
  });

  it("states what the page does not show, so a reader cannot infer live pull-request state", () => {
    render(<ReviewStatePageContent />);
    expect(screen.getByTestId("developer-review-state-scope")).toHaveTextContent(/does not show/i);
    expect(screen.getByTestId("developer-review-state-scope")).toHaveTextContent(/pull request/i);
  });

  it("renders only the current page's records (up to 50 on page 1) — never the full committed set", () => {
    render(<ReviewStatePageContent />);
    const expectedFirstPageCount = Math.min(50, snapshot.review_state.counts.records);
    expect(within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem")).toHaveLength(
      expectedFirstPageCount,
    );
    expect(screen.getByText(/Showing 1–50 of/)).toBeInTheDocument();
  });

  it("links Next to ?page=2 and renders page 2's distinct slice when navigated there", () => {
    const { unmount } = render(<ReviewStatePageContent />);
    const nextLinks = screen.getAllByRole("link", { name: "Next page" });
    expect(nextLinks[0]).toHaveAttribute("href", "?page=2");
    expect(screen.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    unmount();

    render(<ReviewStatePageContent requestedPage={2} />);
    expect(screen.getByText(/Showing 51–100 of/)).toBeInTheDocument();
    const previousLinks = screen.getAllByRole("link", { name: "Previous page" });
    expect(previousLinks[0]).toHaveAttribute("href", "?page=1");
    const secondPageRows = within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem");
    expect(secondPageRows[0]).toHaveTextContent(snapshot.review_state.records[50].head);
  });

  it("clamps an out-of-range requested page to the last real page", () => {
    render(<ReviewStatePageContent requestedPage={999999} />);
    const totalPages = Math.max(1, Math.ceil(snapshot.review_state.counts.records / 50));
    expect(screen.getByText(new RegExp(`Page ${totalPages} of ${totalPages}`))).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("shows the newest record first and never a raw escaped pipe", () => {
    render(<ReviewStatePageContent />);
    const rows = within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(snapshot.review_state.records[0].head);
    expect(screen.getByTestId("developer-review-state-records").textContent).not.toMatch(/\\\|/);
  });

  it("renders a record's outcome verbatim, in full, never classified or truncated (ruling R7)", () => {
    render(<ReviewStatePageContent />);
    const rows = within(screen.getByTestId("developer-review-state-records")).getAllByRole("listitem");
    const pageRecords = snapshot.review_state.records.slice(0, 50);
    let longestIndex = 0;
    for (const [index, record] of pageRecords.entries()) {
      if (record.outcome.length > pageRecords[longestIndex].outcome.length) longestIndex = index;
    }
    const longestRecord = pageRecords[longestIndex];
    expect(longestRecord.outcome.length).toBeGreaterThan(40);
    expect(rows[longestIndex]).toHaveTextContent(longestRecord.outcome);
  });
  it("renders a clear empty state instead of an empty review list", () => {
    vi.mocked(loadRepoAwarenessSnapshot).mockReturnValue({
      ...snapshot,
      review_state: { ...snapshot.review_state, records: [], counts: { records: 0, refs: 0 } },
    });

    render(<ReviewStatePageContent />);

    expect(screen.getByTestId("developer-review-state-empty")).toHaveTextContent(
      "No immutable review records are committed.",
    );
    expect(screen.queryByTestId("developer-review-state-records")).not.toBeInTheDocument();
  });
});
