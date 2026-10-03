/** @vitest-environment jsdom */

// My Day dashboard cards: each card hides when its source has nothing, Edit
// hides and restores cards (kept on this device, cleared at an account
// transition), "Needs you" is capped at three with "All N", and "Later"
// moves a row to tomorrow on this device with an undo.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyDayDashboard, type MyDayDashboardProps } from "@/components/my-day/my-day-dashboard";
import { resetMyDayDeviceStateForTesting } from "@/components/my-day/my-day-device-state";
import type { MyDayDashboardSources } from "@/components/my-day/use-my-day-dashboard-sources";
import {
  clearAccountScopedBrowserStorage,
  MY_DAY_HIDDEN_CARDS_STORAGE_KEY,
  MY_DAY_SNOOZED_ITEMS_STORAGE_KEY,
} from "@/lib/account-scoped-browser-state";
import type { MyDayItem } from "@/lib/my-day/model";
import type { RosterDisplayShift } from "@/lib/roster/team/team-view";
import type { SessionSummary } from "@/lib/teaching/model";

// 12:40 on Sat 3 Oct 2026 in Perth (UTC+8).
const NOW = new Date("2026-10-03T04:40:00Z");
const TODAY = "2026-10-03";

const EMPTY_SOURCES: MyDayDashboardSources = {
  roster: { status: "unavailable", shifts: [], sample: false },
  teaching: { status: "unavailable", sessions: [], sample: false },
  cpd: { status: "unavailable", year: null, loggedHours: 0, targetHours: 0, sample: false },
};

function item(id: string, severity: MyDayItem["severity"], overrides: Partial<MyDayItem> = {}): MyDayItem {
  return {
    id,
    mode: "my-work",
    title: `Title ${id}`,
    due: severity === "overdue" ? "2026-09-20" : severity === "soon" ? "2026-10-05" : null,
    severity,
    href: `/admin/${id}`,
    ...overrides,
  };
}

function shift(overrides: Partial<RosterDisplayShift> & { id: string }): RosterDisplayShift {
  return {
    startsAt: "2026-10-03T09:00:00Z", // 17:00 Perth
    endsAt: "2026-10-04T00:30:00Z", // 08:30 Sun
    title: "On call",
    location: "Demo hospital",
    sourceUid: null,
    kind: "on_call",
    source: "manual",
    seriesId: null,
    workplace: null,
    ...overrides,
  };
}

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    occurrenceId: "occ-1",
    serviceId: "svc-1",
    title: "Registrar teaching: agitation",
    startsAt: "2026-10-03T06:00:00Z", // 14:00 Perth
    endsAt: "2026-10-03T07:00:00Z",
    venue: "Seminar room 3",
    hasJoinLink: false,
    status: "scheduled",
    isPresenter: true,
    source: "teaching",
    ...overrides,
  };
}

function props(overrides: Partial<MyDayDashboardProps> = {}): MyDayDashboardProps {
  return {
    now: NOW,
    today: TODAY,
    items: [],
    nextRenewal: null,
    sources: EMPTY_SOURCES,
    checked: ["On Call", "Admin"],
    editing: false,
    onShowAll: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function shownCards(): string[] {
  return [...document.querySelectorAll('[data-testid^="my-day-card-"]')]
    .map((card) => card.getAttribute("data-testid")!.replace("my-day-card-", ""))
    .filter((id) => id !== "failed");
}

beforeEach(() => {
  window.localStorage.clear();
  resetMyDayDeviceStateForTesting();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetMyDayDeviceStateForTesting();
});

describe("MyDayDashboard cards", () => {
  it("hides every card whose source is empty or unavailable", () => {
    render(<MyDayDashboard {...props()} />);
    expect(shownCards()).toEqual(["quick-actions", "needs-you"]);
    expect(screen.getByTestId("my-day-empty").textContent).toContain("Nothing needs you right now");
  });

  // Design review 2026-10-03: "Handover" is hidden until there is a handover
  // page (item 3), and every link out carries the "from My Day" marker (item 2).
  it("links the quick actions to existing routes only, with the way back to My Day", () => {
    render(<MyDayDashboard {...props()} />);
    const card = screen.getByTestId("my-day-card-quick-actions");
    const links = within(card)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["Call", "/on-call/call?from=my-day"],
      ["Log CPD", "/cme/new?from=my-day"],
      ["Who's on", "/on-call/whos-on?from=my-day"],
    ]);
  });

  it("shows Up next from today's teaching with a countdown, place, role and one action", () => {
    render(
      <MyDayDashboard
        {...props({
          sources: { ...EMPTY_SOURCES, teaching: { status: "ready", sessions: [session()], sample: false } },
        })}
      />,
    );
    const card = screen.getByTestId("my-day-card-up-next");
    expect(card.textContent).toContain("in 1 h 20 min");
    expect(card.textContent).toContain("Starts in 1 hour 20 minutes, at 14:00.");
    expect(card.textContent).toContain("Registrar teaching: agitation");
    expect(card.textContent).toContain("You're presenting · Seminar room 3");
    expect(screen.getByTestId("my-day-up-next-open").getAttribute("href")).toBe("/teaching/session/occ-1?from=my-day");
    // No shift ahead: the hero shows only Up next, with no ring.
    expect(screen.queryByTestId("my-day-shift")).toBeNull();
    // Teaching alone gives today's agenda, so This week shows even without a roster.
    expect(screen.getByTestId("my-day-agenda").textContent).toContain("14:00");
    expect(screen.getByTestId("my-day-week").querySelector("[data-kind]")).toBeNull();
  });

  // Design review 2026-10-03, items 6, 7, 9 and 11: the Shift ring lives in the
  // Up next hero (so the same shift is never shown twice), and the week reads
  // as filled day tiles with "OC" for on call and a faded "off" for rest days.
  it("builds the hero's shift ring and This week from the roster, showing the shift once", () => {
    render(
      <MyDayDashboard
        {...props({
          sources: { ...EMPTY_SOURCES, roster: { status: "ready", shifts: [shift({ id: "s1" })], sample: false } },
        })}
      />,
    );
    expect(screen.queryByTestId("my-day-card-shift")).toBeNull();
    const hero = screen.getByTestId("my-day-card-up-next");
    expect(hero.className).toContain("my-day-hero");
    expect(within(hero).getByTestId("my-day-shift-ring")).toBeTruthy();
    expect(hero.textContent).toContain("4:20");
    expect(hero.textContent).toContain("4 hours 20 minutes until your on call starts");
    expect(hero.textContent).toContain("Ends 08:30 Sun 4 Oct");
    expect(hero.textContent).toContain("Demo hospital");
    expect(within(hero).getByTestId("my-day-shift").getAttribute("href")).toBe("/roster?from=my-day");
    // The only thing today is that shift, so there is no separate Up next line repeating it.
    expect(screen.queryByTestId("my-day-up-next")).toBeNull();
    const week = screen.getByTestId("my-day-week");
    const today = week.querySelector('[aria-current="date"]')!;
    expect(today.getAttribute("aria-label")).toBe("Sat 3 Oct: On call");
    expect(today.querySelector('[data-kind="on_call"]')?.textContent).toBe("OC");
    expect(week.querySelectorAll('[data-kind="off"]')).toHaveLength(6);
    expect(week.textContent).not.toContain("–");
    expect(week.querySelector('[aria-label="Mon 28 Sep: Off"]')).toBeTruthy();
  });

  it("puts what is up next under the shift ring in the one hero", () => {
    render(
      <MyDayDashboard
        {...props({
          sources: {
            ...EMPTY_SOURCES,
            roster: { status: "ready", shifts: [shift({ id: "s1" })], sample: false },
            teaching: { status: "ready", sessions: [session()], sample: false },
          },
        })}
      />,
    );
    const hero = screen.getByTestId("my-day-card-up-next");
    expect(within(hero).getByTestId("my-day-shift")).toBeTruthy();
    expect(within(hero).getByTestId("my-day-up-next").textContent).toContain("Registrar teaching: agitation");
    expect(hero.textContent).toContain("in 1 h 20 min");
    expect(shownCards().filter((id) => id === "up-next")).toHaveLength(1);
  });

  it("counts a running shift down to its end", () => {
    const running = shift({ id: "s2", kind: "day", startsAt: "2026-10-03T00:30:00Z", endsAt: "2026-10-03T09:00:00Z" });
    render(
      <MyDayDashboard
        {...props({ sources: { ...EMPTY_SOURCES, roster: { status: "ready", shifts: [running], sample: false } } })}
      />,
    );
    const card = screen.getByTestId("my-day-card-up-next");
    expect(card.textContent).toContain("On now");
    expect(card.textContent).toContain("Day shift on now, 4 hours 20 minutes left.");
    // A shift already running is the ring's, not an Up next line's.
    expect(screen.queryByTestId("my-day-up-next")).toBeNull();
  });

  it("hides the hero when the roster has nothing ahead and nothing else is up next", () => {
    const past = shift({ id: "s3", startsAt: "2026-10-01T09:00:00Z", endsAt: "2026-10-02T00:30:00Z" });
    render(
      <MyDayDashboard
        {...props({ sources: { ...EMPTY_SOURCES, roster: { status: "ready", shifts: [past], sample: false } } })}
      />,
    );
    expect(screen.queryByTestId("my-day-card-up-next")).toBeNull();
    // A known roster still shows the week.
    expect(screen.getByTestId("my-day-card-this-week")).toBeTruthy();
  });

  it("shows CPD hours against target and days to the next renewal", () => {
    render(
      <MyDayDashboard
        {...props({
          sources: {
            ...EMPTY_SOURCES,
            cpd: { status: "ready", year: 2026, loggedHours: 32, targetHours: 50, sample: false },
          },
          nextRenewal: {
            entryId: "e1",
            title: "Medical registration",
            date: "2026-11-24",
            href: "/admin/renewals?item=e1",
            sample: false,
          },
        })}
      />,
    );
    const cpd = screen.getByTestId("my-day-cpd");
    expect(cpd.textContent).toContain("32 of 50 CPD hours logged this year.");
    expect(cpd.textContent).toContain("18 h to go by 31 Dec");
    const renewal = screen.getByTestId("my-day-renewal");
    expect(renewal.textContent).toContain("52 d");
    expect(renewal.textContent).toContain("Medical registration · Tue 24 Nov");
    expect(renewal.getAttribute("href")).toBe("/admin/renewals?item=e1");
  });

  it("says which card reads failed instead of silently showing nothing", () => {
    render(
      <MyDayDashboard
        {...props({
          sources: {
            ...EMPTY_SOURCES,
            roster: { status: "failed", shifts: [], sample: false },
            cpd: { status: "failed", year: null, loggedHours: 0, targetHours: 0, sample: false },
          },
        })}
      />,
    );
    expect(screen.getByTestId("my-day-card-failed").textContent).toBe(
      "Couldn't load Shifts and CPD hours, so those cards are not shown.",
    );
  });
});

describe("Needs you", () => {
  const five = [
    item("a", "overdue", { detail: "Routine due" }),
    item("b", "overdue"),
    item("c", "soon"),
    item("d", "soon"),
    item("e", "info"),
  ];

  it("shows at most three rows, overdue first, with All N opening the full list", () => {
    const onShowAll = vi.fn();
    render(<MyDayDashboard {...props({ items: five, onShowAll })} />);
    const card = screen.getByTestId("my-day-card-needs-you");
    const rows = within(card)
      .getAllByRole("link")
      .map((link) => link.getAttribute("data-testid"));
    expect(rows).toEqual(["my-day-item-a", "my-day-item-b", "my-day-item-c"]);
    // Two lines a row (design review item 8): the detail line only repeated the state.
    expect(within(card).queryByText("Routine due")).toBeNull();
    expect(screen.getByTestId("my-day-item-a").getAttribute("href")).toBe("/admin/a");
    fireEvent.click(within(card).getByRole("button", { name: "All 5" }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it("moves a row to tomorrow on this device with Later, and Undo brings it back", () => {
    render(<MyDayDashboard {...props({ items: five })} />);
    fireEvent.click(screen.getByRole("button", { name: "Later: Title a" }));
    expect(screen.queryByTestId("my-day-item-a")).toBeNull();
    // The next row moves up so the card still shows three.
    expect(screen.getByTestId("my-day-item-d")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Moved to tomorrow: Title a");
    expect(JSON.parse(window.localStorage.getItem(MY_DAY_SNOOZED_ITEMS_STORAGE_KEY)!)).toEqual({ a: "2026-10-04" });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("my-day-item-a")).toBeTruthy();
    expect(window.localStorage.getItem(MY_DAY_SNOOZED_ITEMS_STORAGE_KEY)).toBeNull();
  });

  it("shows a moved row again from the day it comes back", () => {
    window.localStorage.setItem(MY_DAY_SNOOZED_ITEMS_STORAGE_KEY, JSON.stringify({ a: "2026-10-04" }));
    render(<MyDayDashboard {...props({ items: [item("a", "overdue")] })} />);
    expect(screen.queryByTestId("my-day-item-a")).toBeNull();
    expect(screen.getByTestId("my-day-needs-you-snoozed").textContent).toContain("1 moved to tomorrow");
    cleanup();
    render(<MyDayDashboard {...props({ items: [item("a", "overdue")], today: "2026-10-04" })} />);
    expect(screen.getByTestId("my-day-item-a")).toBeTruthy();
  });

  it("changes nothing on the server: Later and Undo make no request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<MyDayDashboard {...props({ items: five })} />);
    fireEvent.click(screen.getByRole("button", { name: "Later: Title b" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("Edit mode", () => {
  it("hides a card, lists it as a chip while editing, and restores it", () => {
    const { rerender } = render(<MyDayDashboard {...props({ editing: true })} />);
    expect(screen.getByTestId("my-day-hidden-cards").textContent).toContain("Hidden cards wait here.");
    fireEvent.click(screen.getByRole("button", { name: "Hide Quick actions" }));
    expect(screen.queryByTestId("my-day-card-quick-actions")).toBeNull();
    expect(screen.getByRole("button", { name: "Show Quick actions" }).textContent).toContain("Quick actions");
    expect(JSON.parse(window.localStorage.getItem(MY_DAY_HIDDEN_CARDS_STORAGE_KEY)!)).toEqual(["quick-actions"]);

    // Outside edit mode the card stays hidden and no chip or Hide button shows.
    rerender(<MyDayDashboard {...props({ editing: false })} />);
    expect(screen.queryByTestId("my-day-card-quick-actions")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show Quick actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Hide / })).toBeNull();

    rerender(<MyDayDashboard {...props({ editing: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Quick actions" }));
    expect(screen.getByTestId("my-day-card-quick-actions")).toBeTruthy();
    expect(window.localStorage.getItem(MY_DAY_HIDDEN_CARDS_STORAGE_KEY)).toBeNull();
  });

  it("says how to bring cards back when every shown card is hidden", () => {
    window.localStorage.setItem(MY_DAY_HIDDEN_CARDS_STORAGE_KEY, JSON.stringify(["quick-actions", "needs-you"]));
    render(<MyDayDashboard {...props()} />);
    expect(shownCards()).toEqual([]);
    expect(screen.getByTestId("my-day-all-hidden").textContent).toContain("Choose Edit to bring them back.");
  });

  it("forgets hidden cards and moved rows at an account transition", () => {
    window.localStorage.setItem(MY_DAY_HIDDEN_CARDS_STORAGE_KEY, JSON.stringify(["quick-actions"]));
    window.localStorage.setItem(MY_DAY_SNOOZED_ITEMS_STORAGE_KEY, JSON.stringify({ a: "2026-10-04" }));
    render(<MyDayDashboard {...props({ items: [item("a", "overdue")] })} />);
    expect(screen.queryByTestId("my-day-card-quick-actions")).toBeNull();
    expect(screen.queryByTestId("my-day-item-a")).toBeNull();

    act(() => clearAccountScopedBrowserStorage());
    expect(window.localStorage.getItem(MY_DAY_HIDDEN_CARDS_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("my-day-card-quick-actions")).toBeTruthy();
    expect(screen.getByTestId("my-day-item-a")).toBeTruthy();
  });
});
