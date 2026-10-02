// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchRead: vi.fn() }));
vi.mock("@/components/roster/use-roster-team", () => ({ fetchRosterRead: mocks.fetchRead }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { RosterWhoCanCover } from "@/components/roster/roster-who-can-cover";
import type { RosterAssignment } from "@/lib/roster/team/model";

/*
 * "Who can cover?" for one of my team shifts: advice from a fresh read, then
 * links to Requests. Every person and time is invented; dates are far ahead so
 * the shifts are always still to come.
 */

const SERVICE = "5e000000-0000-4000-8000-000000000003";
const ME = "5e000000-0000-4000-8000-000000000001";
const SAM = "5e000000-0000-4000-8000-000000000002";
const NOOR = "5e000000-0000-4000-8000-000000000004";
const ARI = "5e000000-0000-4000-8000-000000000006";

let counter = 0x200;
function shift(
  userId: string,
  name: string | null,
  grade: RosterAssignment["grade"],
  date: string,
  start: string,
  endDate: string,
  end: string,
  kind: RosterAssignment["kind"] = "day",
): RosterAssignment {
  return {
    id: `5e000000-0000-4000-8000-${(counter++).toString(16).padStart(12, "0")}`,
    userId,
    name,
    grade,
    siteId: null,
    siteName: null,
    startsAt: `${date}T${start}:00+08:00`,
    endsAt: `${endDate}T${end}:00+08:00`,
    shiftCode: kind === "night" ? "N" : "D",
    kind,
  };
}

const give = shift(ME, "Alex Example", "registrar", "2030-03-12", "21:30", "2030-03-13", "08:00", "night");
const samDay = shift(SAM, "Dr Sam Example", "registrar", "2030-03-11", "08:00", "2030-03-11", "16:30");
const noorDay = shift(NOOR, "Dr Noor Example", "resident", "2030-03-11", "08:00", "2030-03-11", "16:30");
const ariSameNight = shift(ARI, "Dr Ari Example", "registrar", "2030-03-12", "21:00", "2030-03-13", "07:00", "night");

const overview = {
  service: { id: SERVICE, name: "Example team" },
  me: { role: "member", grade: "registrar", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: true,
  settings: { swapApproval: "auto_same_grade", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};

let assignments: RosterAssignment[] = [];

function ok(what: string) {
  return {
    ok: true,
    data: what === "overview" ? overview : { assignments },
    readAt: new Date("2026-10-20T10:21:00Z"),
  };
}

function openSheet(assignmentId = give.id) {
  render(
    <ul>
      <RosterWhoCanCover serviceId={SERVICE} assignmentId={assignmentId} startsAt={give.startsAt} />
    </ul>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Who can cover\?/ }));
  return screen.getByRole("dialog", { name: "Who can cover?" });
}

beforeEach(() => {
  vi.clearAllMocks();
  assignments = [give, samDay, noorDay, ariSameNight];
  mocks.fetchRead.mockImplementation(async (_serviceId: string, what: string) => ok(what));
});

afterEach(() => cleanup());

describe("RosterWhoCanCover", () => {
  it("lists who can take it first, then who can't with the reason", async () => {
    const dialog = openSheet();
    const can = await within(dialog).findByTestId("roster-who-can-cover-can");
    const cannot = within(dialog).getByTestId("roster-who-can-cover-cannot");

    expect(within(can).getByText("Dr Sam Example")).toBeTruthy();
    expect(within(can).getByText("Registrar · same grade")).toBeTruthy();
    expect(within(can).queryByText("Dr Noor Example")).toBeNull();

    const blocked = within(cannot).getAllByRole("listitem");
    expect(blocked.map((row) => row.textContent)).toEqual([
      "Dr Ari ExampleAlready working then",
      "Dr Noor ExampleLower grade than this shift needs",
    ]);
    expect(can.compareDocumentPosition(cannot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getByText("Advice only. Everything is checked again when you send a request.")).toBeTruthy();

    // The read is the swap flow's: the shift's weeks, then the overview.
    expect(mocks.fetchRead).toHaveBeenCalledWith(SERVICE, "assignments", { from: "2030-03-04", to: "2030-04-28" });
    expect(mocks.fetchRead).toHaveBeenCalledWith(SERVICE, "overview");
  });

  it("says plainly when nobody can take it", async () => {
    assignments = [give, noorDay];
    const dialog = openSheet();
    expect(await within(dialog).findByText("Nobody on the roster is free for this shift.")).toBeTruthy();
    expect(within(dialog).queryByTestId("roster-who-can-cover-can")).toBeNull();
    expect(within(dialog).getByText("Lower grade than this shift needs")).toBeTruthy();
  });

  it("shows an error with Try again, and reads again when tapped", async () => {
    mocks.fetchRead.mockResolvedValueOnce({
      ok: false,
      code: "roster_unavailable",
      message: "Roster couldn't be reached. Try again shortly.",
    });
    const dialog = openSheet();
    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain("Roster couldn't be reached. Try again shortly.");

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(within(dialog).getByRole("status").textContent).toContain("Checking the team roster");
    expect(await within(dialog).findByText("Dr Sam Example")).toBeTruthy();
    expect(mocks.fetchRead).toHaveBeenCalledTimes(4);
  });

  it("asks a signed-out reader to sign in, with no retry", async () => {
    mocks.fetchRead.mockResolvedValue({ ok: false, code: "roster_auth_required", message: "Sign in to open Roster." });
    const dialog = openSheet();
    expect(await within(dialog).findByText("Sign in to open Roster.")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("says so when the shift is not on the roster", async () => {
    const dialog = openSheet("5e000000-0000-4000-8000-0000000fffff");
    expect(await within(dialog).findByText("This shift wasn't found on the team roster.")).toBeTruthy();
    expect(within(dialog).queryByRole("link")).toBeNull();
  });

  it("links to Requests with this shift and team", async () => {
    const dialog = openSheet();
    const swap = await within(dialog).findByRole("link", { name: "Ask to swap" });
    const away = within(dialog).getByRole("link", { name: "Give it away" });
    const swapUrl = new URL(swap.getAttribute("href")!, "https://example.test");
    const awayUrl = new URL(away.getAttribute("href")!, "https://example.test");

    expect(swapUrl.pathname).toBe("/roster/requests");
    expect(Object.fromEntries(swapUrl.searchParams)).toEqual({ start: "swap", assignment: give.id, team: SERVICE });
    expect(awayUrl.pathname).toBe("/roster/requests");
    expect(Object.fromEntries(awayUrl.searchParams)).toEqual({
      start: "give_away",
      assignment: give.id,
      team: SERVICE,
    });
  });
});
