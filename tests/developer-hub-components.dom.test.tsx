import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FreshnessStamp } from "@/components/developer-area/hub/freshness-stamp";
import { PanelCard } from "@/components/developer-area/hub/panel-card";

afterEach(cleanup);

describe("FreshnessStamp", () => {
  it("always renders, and says so when the revision is unknown", () => {
    render(<FreshnessStamp freshness={{ contentAt: null, viewedAt: "2026-08-21T00:00:00Z", ageHours: null }} />);
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/revision unknown/i);
  });

  it("reports the gap between ledger content and build", () => {
    render(
      <FreshnessStamp
        freshness={{ contentAt: "2026-08-20T00:00:00Z", viewedAt: "2026-08-21T00:00:00Z", ageHours: 24 }}
      />,
    );
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/24 hours/i);
  });
});

describe("PanelCard", () => {
  it("links a built panel", () => {
    render(
      <PanelCard
        panel={{
          id: "task-ledger",
          name: "Task ledger",
          summary: "s",
          group: "work",
          phase: 1,
          href: "/mockups/development/ledger",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /task ledger/i })).toHaveAttribute("href", "/mockups/development/ledger");
  });

  it("marks a planned panel unavailable with a reachable reason, never native disabled", () => {
    render(
      <PanelCard panel={{ id: "work-in-flight", name: "Work in flight", summary: "s", group: "work", phase: 2 }} />,
    );
    const button = screen.getByRole("button", { name: /work in flight/i });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("title", expect.stringContaining("coming soon"));
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });
});
