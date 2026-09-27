/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));

import {
  attendanceCsv,
  changeRisks,
  draftFor,
  expectedMemberCount,
  logbookFigures,
  sessionRisks,
} from "@/components/teaching/organise-model";
import { NeedsYou } from "@/components/teaching/teaching-needs-you";
import { TeachingLogbook } from "@/components/teaching/teaching-logbook";
import { TeachingOrganise } from "@/components/teaching/teaching-organise";
import type { LogbookRow, SeriesRow } from "@/lib/teaching/model";

import {
  NB,
  OCC,
  TEAM_A,
  TEAM_B,
  TODAY,
  detail,
  fetchCalls,
  json,
  serveFetch,
  session,
  teamA,
  teamB,
  useTeachingTestClock,
  week,
} from "./helpers/teaching-fixtures";

// A shared fixture, not a component hook: it only registers Vitest's
// `beforeEach`/`afterEach` (see teaching-modules.dom.test.tsx).
// eslint-disable-next-line react-hooks/rules-of-hooks
useTeachingTestClock();

const ORGANISE_URL = `/api/teaching/services/${TEAM_A}?action=organise.read`;
const SESSION_URL = `/api/teaching?view=session&occurrenceId=${OCC}`;
// Numbers and units are joined by a non-breaking space, which an accessible name keeps, so name
// matchers use `\s` (which matches it) rather than a plain space.
const POST_TO_3 = /^Post to 3\smembers$/;
const SERIES = "55555555-5555-4555-8555-555555555555";
const organiser = { ...teamA, role: "organiser" as const };
const members = ["u1", "u2", "u3"].map((userId, i) => ({
  userId,
  name: `Demo Dr ${"ABC"[i]}`,
  role: "doctor" as const,
  joinedAt: "2026-01-01T00:00:00Z",
}));
const groups = [{ groupId: "g1", name: "PGY2", userIds: ["u1"] }];
const organise = { series: [] as SeriesRow[], groups, members };
const seriesRow = (overrides: Partial<SeriesRow> = {}): SeriesRow => ({
  seriesId: SERIES,
  title: "Registrar teaching",
  kind: "lecture",
  groupIds: ["g1"],
  repeat: "weekly",
  firstDate: "2026-09-02",
  startTime: "12:30",
  minutes: 60,
  venue: "Seminar room 1",
  joinUrl: null,
  skipDates: [],
  endDate: "2026-12-16",
  presenterId: null,
  materials: [],
  lastConfirmedAt: null,
  audience: "registrars",
  ...overrides,
});
const row = (overrides: Partial<LogbookRow> = {}): LogbookRow => ({
  occurrenceId: OCC,
  method: "self",
  recordedAt: "2026-09-16T05:00:00Z",
  title: "Registrar teaching",
  startsAt: "2026-09-16T04:30:00.000Z",
  endsAt: "2026-09-16T05:30:00.000Z",
  serviceName: "Hospital A psychiatry",
  cpdEntryId: null,
  ...overrides,
});

describe("the models", () => {
  it("names one risk per rule: a room not confirmed, and a clash within one service", () => {
    const roomless = session({ occurrenceId: "a", venue: null, hasJoinLink: false });
    const clash = session({
      occurrenceId: "b",
      title: "Journal club",
      startsAt: "2026-09-30T05:00:00.000Z",
      endsAt: "2026-09-30T06:00:00.000Z",
    });
    const elsewhere = session({ occurrenceId: "c", serviceId: TEAM_B, startsAt: "2026-09-30T05:00:00.000Z" });
    expect(sessionRisks([roomless, elsewhere]).map((r) => [r.occurrenceId, r.text])).toEqual([
      ["a", "Room not confirmed"],
    ]);
    expect(changeRisks(session(), { ...draftFor(session()), startTime: "13:00" }, [clash])[0].text).toBe(
      "Clashes with Journal club at 13:00",
    );
  });

  it("counts this term, hours and sessions not in CPD, with a non-breaking space before units", () => {
    expect(logbookFigures([row(), row({ occurrenceId: "x", cpdEntryId: "e" })], TODAY)).toEqual([
      { id: "term", label: "This term", value: "2", unit: "sessions" },
      { id: "hours", label: "Hours", value: "2", unit: "h" },
      { id: "unlogged", label: "Not in CPD", value: "1" },
    ]);
    expect(attendanceCsv([row()])).toBe(
      `Date,Start,End,Session,Service,How,In CPD\r\n2026-09-16,12:30,13:30,Registrar teaching,Hospital A psychiatry,Self-reported,No`,
    );
  });

  it("counts the members a change reaches: the series' groups, or the whole service (R9)", () => {
    const read = { series: [seriesRow()], groups, members };
    expect(expectedMemberCount(read, SERIES)).toBe(1);
    expect(expectedMemberCount({ ...read, series: [seriesRow({ groupIds: [] })] }, SERIES)).toBe(3);
    expect(expectedMemberCount(read, null)).toBe(3);
    // A group id that names someone no longer active is not counted.
    expect(
      expectedMemberCount({ ...read, groups: [{ groupId: "g1", name: "PGY2", userIds: ["u1", "gone"] }] }, SERIES),
    ).toBe(1);
  });
});

describe("Logbook", () => {
  it("shows the figures, the chart and the ledger, and opens Log to CPD from an unlogged row", async () => {
    serveFetch((url) =>
      url === "/api/teaching?view=logbook"
        ? json(200, { attendance: [row(), row({ occurrenceId: "x", cpdEntryId: "e" })] })
        : null,
    );
    render(<TeachingLogbook demoMode={false} />);
    expect(await screen.findByRole("group", { name: "Your attendance" })).toHaveTextContent(/Not in CPD\s*1/);
    expect(screen.getByTestId("teaching-attendance-chart")).toBeInTheDocument();
    // jest-dom folds a real non-breaking space to a plain one, so read the raw text (U1 report).
    expect(screen.getByRole("region", { name: "September 2026" }).textContent).toContain(`2${NB}h`);
    fireEvent.click(screen.getAllByRole("button", { name: /Registrar teaching/ })[0]);
    expect(await screen.findByRole("dialog", { name: "Log to CPD" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download CSV" }).getAttribute("href")).toMatch(/^blob:|^data:text\/csv/);
  });

  it("says so when there are no check-ins yet", async () => {
    serveFetch((url) => (url === "/api/teaching?view=logbook" ? json(200, { attendance: [] }) : null));
    render(<TeachingLogbook demoMode={false} />);
    expect(await screen.findByText("No check-ins yet. Sessions you check in to show here.")).toBeInTheDocument();
  });
});

describe("Organise", () => {
  function serveOrganise(
    teams = [organiser, teamB],
    options: { read?: typeof organise; seriesId?: string | null; sessions?: ReturnType<typeof session>[] } = {},
  ) {
    const posts: Array<{ body: Record<string, unknown> | null; init?: RequestInit }> = [];
    const fetchMock = serveFetch((url, body, init) => {
      if (url.startsWith("/api/teaching?view=week"))
        return json(200, week({ teams, sessions: options.sessions ?? [session({ venue: null })] }));
      if (url === SESSION_URL) return json(200, detail({ venue: null, seriesId: options.seriesId ?? null }));
      if (url === ORGANISE_URL) return json(200, options.read ?? organise);
      if (url === `/api/teaching/services/${TEAM_A}` && body) {
        posts.push({ body, init });
        if (body.action === "invitation.create")
          return json(200, { invitationId: "i", expiresAt: "2026-10-07T03:50:00Z", code: "JOIN-CODE-1" });
        if (body.action === "series.save") return json(200, { seriesId: SERIES, occurrences: 16 });
        return json(200, {});
      }
      return null;
    });
    return { posts, fetchMock };
  }

  it("offers only the services the reader organises, and says so when there are none (review focus 4)", async () => {
    serveOrganise([
      organiser,
      teamB,
      { ...teamB, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Hospital C", role: "admin" },
    ]);
    const { unmount } = render(<TeachingOrganise demoMode={false} />);
    const picker = await screen.findByRole("combobox", { name: "Service you organise" });
    expect(within(picker).queryByRole("option", { name: "Hospital B psychiatry" })).toBeNull();
    expect(within(picker).queryByRole("option", { name: "All services" })).toBeNull();
    expect(within(picker).getByRole("option", { name: "Hospital C" })).toBeInTheDocument();
    unmount();
    serveOrganise([teamA]);
    render(<TeachingOrganise demoMode={false} />);
    expect(await screen.findByText("Organise is for your service's organisers.")).toBeInTheDocument();
  });

  it("names the one risk in the next 48 hours, and shows the counts", async () => {
    serveOrganise([organiser]);
    render(<TeachingOrganise demoMode={false} />);
    expect(await screen.findByTestId(`teaching-row-${OCC}`)).toHaveTextContent("Room not confirmed");
    expect(screen.getByText("1 thing to fix")).toBeInTheDocument();
    expect(screen.getByText("Checked 11:50")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "This service" })).toHaveTextContent(/Members\s*3/);
  });

  it("posts a change only after 10 seconds, undoes inside them, and sends with keepalive", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-09-30T03:50:00Z"));
    const { posts } = serveOrganise([organiser]);
    render(<TeachingOrganise demoMode={false} />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    fireEvent.click(screen.getByTestId(`teaching-row-${OCC}`).querySelector("a,button")!);
    const sheet = screen.getByRole("dialog", { name: "Change this session" });
    await act(async () => vi.advanceTimersByTimeAsync(50));
    expect(within(sheet).getByText("Room not confirmed")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Fix" }));
    expect(within(sheet).getByLabelText("Room")).toHaveFocus();
    fireEvent.change(within(sheet).getByLabelText("Room"), { target: { value: "Seminar room 2" } });
    expect(within(sheet).getByText("No clashes")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: POST_TO_3 }));
    expect(screen.getByRole("status")).toHaveTextContent("Posting to 3 members");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => vi.advanceTimersByTimeAsync(11_000));
    expect(posts).toEqual([]);

    fireEvent.click(screen.getByTestId(`teaching-row-${OCC}`).querySelector("a,button")!);
    const again = screen.getByRole("dialog", { name: "Change this session" });
    fireEvent.click(within(again).getByRole("radio", { name: "Cancel" }));
    fireEvent.click(within(again).getByRole("button", { name: POST_TO_3 }));
    await act(async () => vi.advanceTimersByTimeAsync(9_000));
    expect(posts).toEqual([]);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(posts.map((p) => [p.body, p.init?.keepalive])).toEqual([
      [{ action: "occurrence.change", occurrenceId: OCC, status: "cancelled", reason: "presenter_unavailable" }, true],
    ]);
  });

  it("sends a held change at once when the page is left inside the undo window", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-09-30T03:50:00Z"));
    const { posts } = serveOrganise([organiser]);
    const { unmount } = render(<TeachingOrganise demoMode={false} />);
    await act(async () => vi.advanceTimersByTimeAsync(50));
    fireEvent.click(screen.getByTestId(`teaching-row-${OCC}`).querySelector("a,button")!);
    const sheet = screen.getByRole("dialog", { name: "Change this session" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "Cancel" }));
    fireEvent.click(within(sheet).getByRole("button", { name: /Post to/ }));
    expect(posts).toEqual([]);
    unmount();
    expect(posts.map((p) => [p.body?.status, p.init?.keepalive])).toEqual([["cancelled", true]]);
  });

  it("counts only the series' groups on the post button when the session belongs to one (R9)", async () => {
    serveOrganise([organiser], { read: { ...organise, series: [seriesRow()] }, seriesId: SERIES });
    render(<TeachingOrganise demoMode={false} />);
    fireEvent.click((await screen.findByTestId(`teaching-row-${OCC}`)).querySelector("a,button")!);
    const sheet = screen.getByRole("dialog", { name: "Change this session" });
    fireEvent.click(within(sheet).getByRole("radio", { name: "Cancel" }));
    expect(await within(sheet).findByRole("button", { name: /^Post to 1\smember$/ })).toBeInTheDocument();
  });

  it("does not offer to post a move that changes nothing", async () => {
    serveOrganise([organiser], { sessions: [session()] });
    render(<TeachingOrganise demoMode={false} />);
    fireEvent.click((await screen.findByTestId(`teaching-row-${OCC}`)).querySelector("a,button")!);
    const sheet = screen.getByRole("dialog", { name: "Change this session" });
    expect(within(sheet).getByText("No clashes")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Post to/ })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText("Room"), { target: { value: "Seminar room 2" } });
    expect(within(sheet).getByRole("button", { name: /Post to/ })).toBeEnabled();
  });

  it("saves a series with the audience chosen in its picker (R4)", async () => {
    const { posts } = serveOrganise([organiser], {
      read: { ...organise, series: [seriesRow({ title: "Demo grand round" })] },
    });
    render(<TeachingOrganise demoMode={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /Demo grand round/ }));
    const sheet = await screen.findByRole("dialog", { name: "Edit series" });
    const audience = within(sheet).getByLabelText("Audience");
    expect(
      within(audience)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Interns", "Residents", "Registrars", "Consultants", "All doctors"]);
    expect(audience).toHaveValue("registrars");
    fireEvent.change(audience, { target: { value: "all_doctors" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Save series" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body).toMatchObject({ action: "series.save", seriesId: SERIES, audience: "all_doctors" });
  });

  it("invites by email and shows the one-time code", async () => {
    serveOrganise([organiser]);
    render(<TeachingOrganise demoMode={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /Invite/ }));
    const sheet = await screen.findByRole("dialog", { name: "Invite a member" });
    fireEvent.change(within(sheet).getByLabelText("Work email"), { target: { value: "new@health.wa.gov.au" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Create invitation" }));
    expect(await within(sheet).findByText("JOIN-CODE-1")).toBeInTheDocument();
  });

  it("filters members on the device, never asking the server", async () => {
    const { fetchMock } = serveOrganise([organiser]);
    render(<TeachingOrganise demoMode={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Members/ }));
    const sheet = await screen.findByRole("dialog", { name: "Members" });
    const before = fetchMock.mock.calls.length;
    fireEvent.change(within(sheet).getByLabelText("Filter members"), { target: { value: "dr b" } });
    expect(within(sheet).getByText("Demo Dr B")).toBeInTheDocument();
    expect(within(sheet).queryByText("Demo Dr A")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});

describe("Needs you", () => {
  it("offers to log unlogged sessions to CPD, and hides itself when nothing needs the reader", async () => {
    serveFetch((url) => (url === "/api/teaching?view=unlogged-count" ? json(200, { count: 2 }) : null));
    render(<NeedsYou live />);
    expect(await screen.findByRole("link", { name: /^Log 2\ssessions to CPD/ })).toHaveAttribute(
      "href",
      "/teaching/logbook",
    );
  });

  it("renders nothing with nothing to log, and asks nothing in the demo", async () => {
    const fetchMock = serveFetch((url) =>
      url === "/api/teaching?view=unlogged-count" ? json(200, { count: 0 }) : null,
    );
    const { container, rerender } = render(<NeedsYou live />);
    await waitFor(() => expect(fetchCalls(fetchMock, "/api/teaching?view=unlogged-count")).toBe(1));
    expect(container).toBeEmptyDOMElement();
    rerender(<NeedsYou live={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
