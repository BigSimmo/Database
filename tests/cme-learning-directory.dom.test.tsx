import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmeLearningPage } from "@/components/cme/cme-learning-page";
import type { LearningDirectoryItem } from "@/lib/cme/learning-directory";

// 2026-09-26 in Perth (UTC+8, no daylight saving).
const NOW_ISO = "2026-09-26T02:00:00.000Z";

function item(overrides: Partial<LearningDirectoryItem> = {}): LearningDirectoryItem {
  return {
    id: "synthetic-item",
    title: "Synthetic workshop",
    provider: "Synthetic provider",
    kind: "event",
    datesConfirmed: true,
    startsOn: "2026-10-10",
    endsOn: null,
    mode: "in-person",
    location: "Perth",
    costNote: "Free for members",
    url: "https://example.org/event?ref=list",
    sourceUrl: "https://example.org/confirmed",
    lastCheckedOn: "2026-09-26",
    ...overrides,
  };
}

describe("CME learning directory page", () => {
  it("lists upcoming items in date order and drops past ones", () => {
    render(
      <CmeLearningPage
        items={[
          item({ id: "later", title: "Later course", kind: "course", startsOn: "2026-11-02", endsOn: "2026-11-03" }),
          item({ id: "past", title: "Past event", startsOn: "2026-09-01" }),
          item({ id: "soon", title: "Soon event", startsOn: "2026-10-01", mode: "online", location: null }),
        ]}
        lastCheckedOn="2026-09-20"
        nowIso={NOW_ISO}
      />,
    );
    const main = screen.getByTestId("cme-learning");
    const cards = within(main).getAllByTestId("cme-learning-item");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(["Soon event", "Later course"]);
    expect(screen.queryByText("Past event")).toBeNull();
    expect(within(cards[1]).getByText("2 Nov to 3 November 2026")).toBeInTheDocument();
    expect(main).toHaveTextContent("List last checked on 20 September 2026");
    expect(main).toHaveTextContent(/not an endorsement/i);
    expect(main).toHaveTextContent(/confirm .* with the organiser/i);
    expect(screen.queryByTestId("cme-learning-stale")).toBeNull();
    expect(screen.queryByTestId("cme-learning-empty")).toBeNull();
    expect(screen.queryByTestId("cme-learning-unconfirmed")).toBeNull();
  });

  it("opens the organiser's page in a new tab and logs with only a title and source link", () => {
    render(<CmeLearningPage items={[item({ title: "A & B" })]} lastCheckedOn="2026-09-26" nowIso={NOW_ISO} />);
    const card = screen.getByTestId("cme-learning-item");
    const details = within(card).getByRole("link", { name: /details/i });
    expect(details).toHaveAttribute("href", "https://example.org/event?ref=list");
    expect(details).toHaveAttribute("target", "_blank");
    expect(details).toHaveAttribute("rel", "noopener noreferrer");

    const log = within(card).getByRole("link", { name: "Log as CPD" });
    const url = new URL(log.getAttribute("href") ?? "", "https://psychiatry.tools");
    expect(url.pathname).toBe("/cme/new");
    expect([...url.searchParams.keys()]).toEqual(["title", "sourceUrl"]);
    expect(url.searchParams.get("title")).toBe("A & B");
    expect(url.searchParams.get("sourceUrl")).toBe("https://example.org/event?ref=list");
  });

  it("shows the empty state when nothing is upcoming", () => {
    render(<CmeLearningPage items={[item({ startsOn: "2026-09-01" })]} lastCheckedOn="2026-09-26" nowIso={NOW_ISO} />);
    expect(screen.getByTestId("cme-learning-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-learning-item")).toBeNull();
  });

  it("warns that the list may be out of date after 45 days", () => {
    render(<CmeLearningPage items={[]} lastCheckedOn="2026-08-11" nowIso={NOW_ISO} />);
    expect(screen.getByTestId("cme-learning-stale")).toHaveTextContent(/may be out of date/i);
  });

  it("does not warn at exactly 45 days", () => {
    render(<CmeLearningPage items={[]} lastCheckedOn="2026-08-12" nowIso={NOW_ISO} />);
    expect(screen.queryByTestId("cme-learning-stale")).toBeNull();
  });

  it("puts items with unconfirmed dates in their own section, never dropping them", () => {
    render(
      <CmeLearningPage
        items={[
          item({ id: "dated", title: "Dated event" }),
          item({ id: "undated", title: "Undated event", datesConfirmed: false, startsOn: null }),
          item({ id: "old-guess", title: "Old guess", datesConfirmed: false, startsOn: "2026-01-01" }),
        ]}
        lastCheckedOn="2026-09-26"
        nowIso={NOW_ISO}
      />,
    );
    const section = screen.getByTestId("cme-learning-unconfirmed");
    expect(within(section).getByRole("heading", { name: "Dates to confirm" })).toBeInTheDocument();
    expect(section).toHaveTextContent(
      "We couldn't confirm the date for these. Check the organiser's page before planning around them.",
    );
    expect(
      within(section)
        .getAllByTestId("cme-learning-item")
        .map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["Old guess", "Undated event"]);
    expect(within(section).getByText("Date not confirmed")).toBeInTheDocument();
    expect(screen.getAllByTestId("cme-learning-item")).toHaveLength(3);
  });

  it("keeps the unconfirmed section even when nothing dated is upcoming", () => {
    render(
      <CmeLearningPage
        items={[item({ datesConfirmed: false, startsOn: null })]}
        lastCheckedOn="2026-09-26"
        nowIso={NOW_ISO}
      />,
    );
    expect(screen.getByTestId("cme-learning-empty")).toBeInTheDocument();
    expect(screen.getByTestId("cme-learning-unconfirmed")).toBeInTheDocument();
  });
});
