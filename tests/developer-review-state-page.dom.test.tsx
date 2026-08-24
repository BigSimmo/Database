import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DeveloperReviewStatePage from "@/app/mockups/development/review-state/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

const snapshot = loadRepoAwarenessSnapshot();

describe("developer review state page", () => {
  it("renders inside the shared shell with the repository freshness label", () => {
    render(<DeveloperReviewStatePage />);
    expect(screen.getByTestId("developer-review-state")).toBeInTheDocument();
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows records and distinct refs as separate readable values", () => {
    render(<DeveloperReviewStatePage />);
    expect(screen.getByTestId("developer-review-state-count-records-value")).toHaveTextContent(
      String(snapshot.review_state.counts.records),
    );
    expect(screen.getByTestId("developer-review-state-count-refs-value")).toHaveTextContent(
      String(snapshot.review_state.counts.refs),
    );
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
});
