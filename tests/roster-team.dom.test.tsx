/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RosterTeamPage } from "@/components/roster/team/roster-team-page";

// The calendar keeps its view and date in the URL, so the mock URL is live:
// router.replace updates it and useSearchParams reads it back.
const url = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = { params: new URLSearchParams() };
  return {
    state,
    set(search: string) {
      state.params = new URLSearchParams(search);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/roster/team",
  useRouter: () => ({
    push: vi.fn(),
    replace: (target: string) => act(() => url.set(target.split("?")[1] ?? "")),
  }),
  useSearchParams: () =>
    useSyncExternalStore(
      url.subscribe,
      () => url.state.params,
      () => url.state.params,
    ),
}));
vi.mock("@/components/roster/ask/roster-ask-box", () => ({ RosterAskButton: () => null }));
beforeEach(() => url.set("view=day"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const team = { serviceId: "example", name: "Example team", enabled: true, role: "member", grade: "registrar" };
function mockTeam(enabled = true, sample = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/roster/team")
        return Response.json({ actorId: "alex", teams: [{ ...team, enabled }], ...(sample ? { sample: true } : {}) });
      if (url.includes("what=overview"))
        return Response.json({
          service: { id: "example", name: "Example team" },
          me: { role: "member", grade: "registrar", rotationEndsOn: null },
          latestPublication: null,
          seenLatest: true,
          settings: { rules: {} },
          sites: [],
        });
      return Response.json({
        assignments: [
          {
            id: "night",
            userId: "sam",
            name: "Dr Sam Example",
            grade: "registrar",
            siteId: "site",
            siteName: "Example Hospital",
            startsAt: "2026-10-15T21:30:00+08:00",
            endsAt: "2026-10-16T08:00:00+08:00",
            shiftCode: "N",
            kind: "night",
          },
        ],
      });
    }),
  );
}
describe("Roster team journey", () => {
  it("shows an overnight team shift and links to the team's phone numbers", async () => {
    mockTeam();
    render(<RosterTeamPage now={new Date("2026-10-16T00:00:00Z")} />);
    expect(await screen.findByRole("heading", { name: "Registrars" })).toBeTruthy();
    expect(screen.getByText("to 08:00")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Phone numbers are in On call/ }).getAttribute("href")).toBe(
      "/on-call/service?service=example",
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(await screen.findByText("from 21:30")).toBeTruthy();
  });
  it("labels the sample team served while team rosters are held", async () => {
    mockTeam(true, true);
    render(<RosterTeamPage now={new Date("2026-10-16T00:00:00Z")} />);
    expect((await screen.findByTestId("roster-sample-notice")).textContent).toMatch(/Example team/);
  });
  it("shows no sample label for a real team", async () => {
    mockTeam();
    render(<RosterTeamPage now={new Date("2026-10-16T00:00:00Z")} />);
    expect(await screen.findByRole("heading", { name: "Registrars" })).toBeTruthy();
    expect(screen.queryByTestId("roster-sample-notice")).toBeNull();
  });
  it("makes no detail reads for an unconfirmed team", async () => {
    mockTeam(false);
    render(<RosterTeamPage now={new Date("2026-10-16T00:00:00Z")} />);
    expect(await screen.findByText("This team hasn't been confirmed yet.")).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.every(([url]) => url === "/api/roster/team")).toBe(true);
    expect(screen.queryByText("Dr Sam Example")).toBeNull();
  });
  it("shows a retry after a failed team read instead of an empty roster", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<RosterTeamPage />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No shifts on this day.")).toBeNull();
  });
});
