/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnCallNextShift } from "@/components/on-call/on-call-next-shift";
import type { OnCallShiftsState } from "@/components/on-call/use-on-call-shifts";
import type { OnCallShift, OnCallShiftImportSummary } from "@/lib/on-call/shifts/model";

/*
 * My shifts on screen: the next-shift card on the On Call home, and the page
 * where a roster is imported, checked and saved. Every roster here is invented.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/on-call/shifts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The header drags in the whole navigation chrome, covered by its own tests.
vi.mock("@/components/on-call/on-call-nav-header", () => ({ OnCallToolNavHeader: () => null }));

import { OnCallShiftsPage } from "@/components/on-call/on-call-shifts-page";

const now = new Date("2026-10-05T01:00:00.000Z"); // 09:00 Monday in Perth

const nightShift: OnCallShift = {
  id: "s1",
  startsAt: "2026-10-06T13:00:00.000Z",
  endsAt: "2026-10-07T00:00:00.000Z",
  title: "Night registrar",
  location: "Example Hospital",
  sourceUid: null,
};

const unseenImport: OnCallShiftImportSummary = {
  id: "33333333-3333-4333-8333-333333333333",
  importedAt: "2026-10-04T00:00:00.000Z",
  format: "csv",
  windowStart: "2026-10-05",
  windowEnd: "2026-10-11",
  added: 2,
  changed: 1,
  removed: 0,
  changes: [],
  seenAt: null,
};

function state(overrides: Partial<OnCallShiftsState> = {}): OnCallShiftsState {
  return {
    status: "ready",
    shifts: [],
    latestImport: null,
    demoMode: false,
    save: vi.fn(async () => null),
    deleteAll: vi.fn(async () => null),
    dismissChanges: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the next-shift card", () => {
  it("draws nothing while loading or signed out, so the home is unchanged", () => {
    const { container, rerender } = render(<OnCallNextShift state={state({ status: "loading" })} now={now} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<OnCallNextShift state={state({ status: "signed-out" })} now={now} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("invites a roster import when there are no shifts", () => {
    render(<OnCallNextShift state={state()} now={now} />);
    const link = screen.getByTestId("on-call-next-shift-empty");
    expect(link).toHaveAttribute("href", "/on-call/shifts");
    expect(link).toHaveTextContent("Add your roster");
  });

  it("shows the next shift and an unseen roster change", () => {
    render(<OnCallNextShift state={state({ shifts: [nightShift], latestImport: unseenImport })} now={now} />);
    expect(screen.getByTestId("on-call-next-shift-when")).toHaveTextContent("Tomorrow at 21:00");
    expect(screen.getByTestId("on-call-next-shift")).toHaveTextContent("21:00 to 08:00 (next day)");
    expect(screen.getByTestId("on-call-next-shift")).toHaveTextContent("Example Hospital");
    expect(screen.getByTestId("on-call-next-shift-changed")).toHaveTextContent("Roster changed: 2 added, 1 moved");
  });
});

describe("the My shifts page", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { shifts: Array<Omit<OnCallShift, "id">> };
        const shifts = body.shifts.map((item, index) => ({ ...item, id: `saved-${index}` }));
        return Response.json({ shifts, latestImport: { ...unseenImport, added: shifts.length, changed: 0 } });
      }
      return Response.json({ shifts: [], latestImport: null });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("reads a roster file on the device, previews it, and saves only the parsed shifts", async () => {
    render(<OnCallShiftsPage now={now} />);
    await screen.findByTestId("on-call-shifts-empty");

    const csv = [
      "date,start,end,role,site,notes",
      "2026-10-06,21:00,08:00,Night registrar,Example Hospital,handover from Dr Example",
    ].join("\n");
    const file = new File([csv], "roster.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("on-call-shifts-file"), { target: { files: [file] } });

    const preview = await screen.findByTestId("on-call-shifts-preview");
    expect(preview).toHaveTextContent("Found 1 shift");
    expect(preview).toHaveTextContent("Night registrar");

    fireEvent.click(screen.getByRole("button", { name: /Save 1 shift/ }));
    await screen.findByTestId("on-call-shifts-list");

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    const sent = String((post?.[1] as RequestInit).body);
    expect(JSON.parse(sent)).toMatchObject({ format: "csv", windowStart: "2026-10-06", windowEnd: "2026-10-06" });
    expect(sent).not.toContain("Dr Example");
    expect(screen.getByTestId("on-call-shifts-changes")).toHaveTextContent("What changed: 1 added");
  });

  it("refuses a file that is not a roster", async () => {
    render(<OnCallShiftsPage now={now} />);
    await screen.findByTestId("on-call-shifts-empty");
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId("on-call-shifts-file"), { target: { files: [file] } });
    await screen.findByText(/Choose a calendar file/);
    expect(screen.queryByTestId("on-call-shifts-preview")).toBeNull();
  });

  it("asks a signed-out reader to sign in and offers no import", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Sign in" }, { status: 401 }));
    render(<OnCallShiftsPage now={now} />);
    await screen.findByTestId("on-call-shifts-signed-out");
    await waitFor(() => expect(screen.queryByTestId("on-call-shifts-import")).toBeNull());
  });
});
