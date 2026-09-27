/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));
vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({ AccountSetupDialog: () => null }));
// The header portals into the app header's slot, which these tests do not mount.
vi.mock("@/components/teaching/teaching-nav-header", () => ({ TeachingNavHeader: () => null }));

import { TeachingCheckinScreen } from "@/components/teaching/teaching-checkin";
import { TeachingDisplayScreen } from "@/components/teaching/teaching-display";
import { TeachingScanLanding } from "@/components/teaching/teaching-scan-landing";
import { TeachingSessionScreen } from "@/components/teaching/teaching-session";
import { TeachingWeekPanel } from "@/components/teaching/teaching-week-panel";

import { authState } from "./helpers/teaching-auth";
import {
  AFTER,
  DURING,
  NOW,
  OCC,
  TEAM_A,
  apiError,
  byId,
  detail,
  json,
  serveFetch,
  useTeachingTestClock,
} from "./helpers/teaching-fixtures";

// `useTeachingTestClock` only registers Vitest's beforeEach/afterEach; its name trips the hooks heuristic.
// eslint-disable-next-line react-hooks/rules-of-hooks
useTeachingTestClock(DURING);

const SESSION_URL = `/api/teaching?view=session&occurrenceId=${OCC}`;
const TEAM_URL = `/api/teaching/services/${TEAM_A}`;
const JOIN = "https://teams.microsoft.com/l/meetup-join/1";
// `isTeachingSecret`: 32 random bytes as lower-case hex.
const SECRET = "a".repeat(64);
const code = (window: number, typedCode = "482913") => ({
  token: `tok-${window}`,
  typedCode,
  window,
  validUntil: new Date((window + 1) * 30_000).toISOString(),
});

function serveSession(
  overrides = {},
  extra: (url: string, body: Record<string, unknown> | null) => Response | null = () => null,
) {
  return serveFetch(
    (url, body) =>
      extra(url, body) ??
      (url === SESSION_URL
        ? json(200, detail(overrides))
        : url.startsWith("/api/teaching/resources?")
          ? json(200, { items: [] })
          : null),
  );
}

describe("the session page", () => {
  it("while on: the live module with Scan to check in, Check in without code, Join, details and materials", async () => {
    serveSession({
      hasJoinLink: true,
      joinUrl: JOIN,
      presenterName: "Dr Example",
      materials: [{ label: "Slides", url: "https://example.org/s" }],
    });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    const phase = await screen.findByTestId("teaching-session-phase");
    expect(phase).toHaveTextContent("On now");
    expect(phase).toHaveTextContent("Check-in open until 13:45");
    expect(within(phase).getByRole("button", { name: "Scan to check in" })).toBeInTheDocument();
    expect(within(phase).getByRole("button", { name: "Check in without code" })).toBeInTheDocument();
    expect(within(phase).getByRole("link", { name: "Join on Teams" })).toHaveAttribute("href", JOIN);
    expect(screen.getByText("Wed 30 Sep · 12:30–13:30")).toBeInTheDocument();
    expect(byId("teaching-session-details")).toHaveTextContent("Microsoft Teams · Members only");
    expect(byId("teaching-session-materials")).toHaveTextContent("chosen by the presenter");
  });

  it("checks in with the typed code from the scan sheet, and opens it from ?check-in=scan", async () => {
    let sent: Record<string, unknown> | null = null;
    serveSession({}, (url, body) => {
      if (url !== TEAM_URL) return null;
      sent = body;
      return json(200, { occurrenceId: OCC, method: "code_room", recordedAt: DURING.toISOString(), serviceId: TEAM_A });
    });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} initialSheet="scan" />);
    const sheet = await screen.findByRole("dialog", { name: "Scan to check in" });
    fireEvent.change(within(sheet).getByLabelText("Or type the six digits"), { target: { value: "482 913" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Check in" }));
    await waitFor(() =>
      expect(screen.getByTestId("teaching-session-phase")).toHaveTextContent("Checked in by code · shown in room"),
    );
    expect(sent).toEqual({ action: "checkin.typed", occurrenceId: OCC, stream: "room", code: "482913" });
  });

  it("offers a visitor only I was there, and records it through What's on rather than the service (R15)", async () => {
    const posts: string[] = [];
    serveSession({ visitor: true, presenterName: null }, (url, body) => {
      if (body) posts.push(`${url} ${String(body.action)}`);
      return body ? json(200, { occurrenceId: OCC, method: "self", recordedAt: DURING.toISOString() }) : null;
    });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    const phase = await screen.findByTestId("teaching-session-phase");
    expect(within(phase).queryByRole("button", { name: "Scan to check in" })).toBeNull();
    expect(within(phase).queryByRole("button", { name: "Check in without code" })).toBeNull();
    fireEvent.click(within(phase).getByRole("button", { name: "I was there" }));
    await waitFor(() => expect(posts).toEqual(["/api/teaching/whats-on whats_on.attend"]));
    expect(await screen.findByText("Self-reported")).toBeInTheDocument();
  });

  it("after it ends: Log to CPD, quietly, for a reader who attended", async () => {
    vi.setSystemTime(AFTER);
    serveSession({ myAttendance: { method: "self", recordedAt: DURING.toISOString() } });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    const phase = await screen.findByTestId("teaching-session-phase");
    expect(phase).toHaveTextContent("Self-reported");
    fireEvent.click(within(phase).getByRole("button", { name: "Log to CPD" }));
    expect(await screen.findByRole("dialog", { name: "Log to CPD" })).toBeInTheDocument();
  });

  it("a cancelled or moved session says so in words and offers no Join and no check-in (review focus 5)", async () => {
    serveSession({ status: "cancelled", changeReason: "room_change", hasJoinLink: true, joinUrl: JOIN });
    const { unmount } = render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    expect(await screen.findByText("Cancelled · Room change")).toBeInTheDocument();
    expect(screen.queryByTestId("teaching-session-phase")).toBeNull();
    expect(screen.queryByRole("link", { name: /Join|Online/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /check in/i })).toBeNull();
    unmount();
    serveSession({
      status: "moved",
      previousStartsAt: "2026-09-30T03:30:00.000Z",
      changeReason: "presenter_unavailable",
    });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    expect(await screen.findByText("Moved from 11:30 · Presenter unavailable")).toBeInTheDocument();
  });

  it("a removed session, or a malformed id, says it is no longer in the programme (review focus 5)", async () => {
    serveFetch((url) => (url === SESSION_URL ? apiError(404, "teaching_not_found") : null));
    const { unmount } = render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    expect(await screen.findByText("This session is no longer in the programme.")).toBeInTheDocument();
    unmount();
    render(<TeachingSessionScreen occurrenceId="not-an-id" demoMode={false} />);
    expect(screen.getByText("This session is no longer in the programme.")).toBeInTheDocument();
  });

  it("organisers see the named register and can remove a self-reported mark; presenters see counts only", async () => {
    const removed: unknown[] = [];
    serveSession({ canShowCode: true, counts: { code: 18, self: 3, visitors: 0, expected: 26 } }, (url, body) => {
      if (url.includes("action=register.read")) {
        return json(200, {
          rows: [
            { userId: "u1", name: "Dr A", method: "self", recordedAt: DURING.toISOString() },
            { userId: "u2", name: "Dr B", method: "code_room", recordedAt: DURING.toISOString() },
          ],
          visitors: 0,
        });
      }
      if (url === TEAM_URL && body?.action === "attendance.remove") {
        removed.push(body);
        return json(200, {});
      }
      return null;
    });
    render(<TeachingSessionScreen occurrenceId={OCC} demoMode={false} />);
    expect(await screen.findByRole("group", { name: "Attendance" })).toHaveTextContent(/Expected\s*26/);
    fireEvent.click(await screen.findByRole("button", { name: "Register" }));
    const sheet = await screen.findByRole("dialog", { name: "Register" });
    expect(within(sheet).getAllByRole("button", { name: /Remove/ })).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole("button", { name: "Remove Dr A" }));
    await waitFor(() => expect(removed).toEqual([{ action: "attendance.remove", occurrenceId: OCC, userId: "u1" }]));
  });
});

describe("the presenter's code", () => {
  it("keeps a code up for 20 seconds past its window, then takes it down while polls fail (review focus 3)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date(1_000 * 30_000 + 1_000)); // one second into window 1000
    let fail = false;
    serveFetch((url) => {
      if (url === SESSION_URL)
        return json(
          200,
          detail({
            canShowCode: true,
            startsAt: new Date(1_000 * 30_000 - 600_000).toISOString(),
            endsAt: new Date(1_000 * 30_000 + 3_000_000).toISOString(),
          }),
        );
      if (url.includes("action=register.read")) return json(200, { counts: { code: 2, self: 1, visitors: 0 } });
      if (url.includes("action=checkin.code"))
        return fail ? apiError(503, "teaching_unavailable") : json(200, code(1_000));
      return null;
    });
    render(<TeachingCheckinScreen occurrenceId={OCC} demoMode={false} />);
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId("teaching-checkin-qr")).toBeInTheDocument();
    expect(screen.getByTestId("teaching-typed-code")).toHaveTextContent("482 913");
    fail = true;
    await act(async () => vi.advanceTimersByTimeAsync(45_000)); // 16 s past the window: still up
    expect(screen.getByTestId("teaching-checkin-qr")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(5_000)); // 21 s past: down
    expect(screen.queryByTestId("teaching-checkin-qr")).toBeNull();
    expect(screen.getByTestId("teaching-checkin-reconnecting")).toHaveTextContent("Reconnecting");
  });
});

describe("the scan landing", () => {
  it("finishes a scan, and never says checked in when the finish fails (review focus 3)", async () => {
    let completes = 0;
    serveFetch((url) => {
      if (url === "/api/teaching/checkin/open")
        return json(200, {
          occurrenceId: OCC,
          title: "Registrar teaching",
          startsAt: DURING.toISOString(),
          stream: "room",
        });
      if (url === "/api/teaching/checkin/complete")
        return completes++ === 0
          ? apiError(503, "teaching_unavailable")
          : json(200, { occurrenceId: OCC, method: "code_room", recordedAt: DURING.toISOString(), serviceId: TEAM_A });
      return null;
    });
    render(<TeachingScanLanding token="tok-1" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("You're checked in")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You're checked in")).toBeInTheDocument();
  });

  it("signed out: keeps the scan and emails a link back to /teaching/c/complete", async () => {
    serveFetch((url) =>
      url === "/api/teaching/checkin/open"
        ? json(200, { occurrenceId: OCC, title: "Registrar teaching", startsAt: DURING.toISOString(), stream: "room" })
        : url === "/api/teaching/checkin/complete"
          ? json(401, { error: "Sign in", message: "Sign in", code: "teaching_signed_out" })
          : null,
    );
    render(<TeachingScanLanding token="tok-1" />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "dr@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await waitFor(() =>
      expect(authState.signInWithEmail).toHaveBeenCalledWith("dr@example.org", "/teaching/c/complete"),
    );
  });
});

describe("the shared screen", () => {
  it("shows the session, the QR and the six digits to a signed-out screen, and nothing about anyone", async () => {
    vi.setSystemTime(new Date(1_000 * 30_000 + 1_000));
    authState.status = "signed_out";
    serveFetch((url) =>
      url === `/api/teaching/display/${SECRET}`
        ? json(200, {
            ...code(1_000, "107204"),
            title: "Registrar teaching",
            venue: "Seminar room 1",
            closesAt: "2026-09-30T05:45:00.000Z",
          })
        : null,
    );
    render(<TeachingDisplayScreen secret={SECRET} />);
    expect(await screen.findByTestId("teaching-checkin-qr")).toHaveAttribute(
      "data-qr-value",
      `${window.location.origin}/teaching/c/tok-1000`,
    );
    const shown = screen.getByTestId("teaching-display");
    expect(shown).toHaveTextContent("Registrar teaching");
    expect(shown).toHaveTextContent("Seminar room 1");
    expect(screen.getByTestId("teaching-typed-code")).toHaveTextContent("107 204");
    expect(shown).toHaveTextContent("open until 13:45");
  });

  it("says so when the link has ended", async () => {
    vi.setSystemTime(NOW);
    serveFetch((url) => (url === `/api/teaching/display/${SECRET}` ? apiError(410, "teaching_link_expired") : null));
    render(<TeachingDisplayScreen secret={SECRET} />);
    expect(await screen.findByTestId("teaching-display-ended")).toHaveTextContent("This display link has ended.");
  });
});

describe("Week's side panel", () => {
  it("opens a session beside the list with its place in the week, and steps to the next", async () => {
    const second = "22222222-2222-4222-8222-222222222222";
    serveFetch((url) =>
      url.startsWith("/api/teaching?view=session")
        ? json(
            200,
            detail({
              occurrenceId: new URL(url, "http://x").searchParams.get("occurrenceId")!,
              title: url.includes(second) ? "Journal club" : "Registrar teaching",
            }),
          )
        : null,
    );
    let current = OCC;
    const select = (id: string) => (current = id);
    const { rerender } = render(
      <TeachingWeekPanel
        occurrenceId={current}
        ids={[OCC, second]}
        select={select}
        close={() => undefined}
        demoMode={false}
      />,
    );
    expect(await screen.findByText("Session · 1 of 2 this week")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Registrar teaching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous session" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next session" }));
    rerender(
      <TeachingWeekPanel
        occurrenceId={current}
        ids={[OCC, second]}
        select={select}
        close={() => undefined}
        demoMode={false}
      />,
    );
    expect(await screen.findByText("Journal club")).toBeInTheDocument();
    expect(screen.getByText("Session · 2 of 2 this week")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next session" })).toBeDisabled();
  });
});
