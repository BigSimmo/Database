import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeRoutinesPage, type CmeRoutinesPageProps } from "@/components/cme/cme-routines-page";
import { CmeRoutinesRoute } from "@/components/cme/cme-routines-route";
import type { CmeRoutine } from "@/lib/cme/routines";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

afterEach(() => {
  vi.restoreAllMocks();
  navigation.push.mockReset();
  navigation.refresh.mockReset();
});

/** 28 September 2026, 10:00 Perth. */
const NOW = new Date("2026-09-28T02:00:00Z");

const dueRoutine: CmeRoutine = {
  id: "r1",
  title: "Supervision",
  cadence: "monthly",
  usualHours: 1,
  usualAllocations: [{ category: "reviewing", hours: 1 }],
  nextDue: "2026-09-28",
  archivedAt: null,
};

const notYetDueRoutine: CmeRoutine = {
  id: "r2",
  title: "Journal club",
  cadence: "quarterly",
  usualHours: 1.5,
  usualAllocations: [],
  nextDue: "2026-12-01",
  archivedAt: null,
};

const archivedRoutine: CmeRoutine = {
  id: "r3",
  title: "Retired peer-review group",
  cadence: "weekly",
  usualHours: 0.5,
  usualAllocations: [],
  nextDue: "2026-09-01",
  archivedAt: "2026-06-01T00:00:00Z",
};

function renderPage(overrides: Partial<CmeRoutinesPageProps> = {}) {
  const onLogRoutine = vi.fn();
  const onNewRoutine = vi.fn();
  const utils = render(
    <CmeRoutinesPage
      routines={[dueRoutine, notYetDueRoutine, archivedRoutine]}
      now={NOW}
      onLogRoutine={onLogRoutine}
      onNewRoutine={onNewRoutine}
      {...overrides}
    />,
  );
  return { ...utils, onLogRoutine, onNewRoutine };
}

describe("Routines", () => {
  it("saves a routine, then routes its Log action to the pre-filled entry form", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ routine: dueRoutine }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<CmeRoutinesRoute nowIso={NOW.toISOString()} initialRoutines={[]} demoMode={false} />);
    await user.click(screen.getByRole("button", { name: /new routine/i }));
    await user.type(screen.getByLabelText(/routine name/i), "Supervision");
    await user.click(screen.getByRole("button", { name: /save routine/i }));
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/cme/routines", expect.objectContaining({ method: "POST" }));
    await user.click(screen.getByRole("button", { name: /log usual hours for supervision/i }));
    expect(navigation.push).toHaveBeenCalledWith("/cme/new?routine=r1");
  });

  // Regression, 2026-09-24: the form opened above the list, out of sight on a
  // phone, with a second h1. It now takes focus when it opens.
  it("moves focus to the routine form when it opens, under the page's one h1", async () => {
    const user = userEvent.setup();
    render(<CmeRoutinesRoute nowIso={NOW.toISOString()} initialRoutines={[]} demoMode={false} />);
    await user.click(screen.getByRole("button", { name: /new routine/i }));
    const heading = screen.getByRole("heading", { level: 2, name: "New routine" });
    expect(heading).toHaveFocus();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("puts a due routine at the top with a one-tap log button as the visual focus", () => {
    renderPage();
    const due = screen.getByTestId("cme-routines-due");
    expect(within(due).getByText("Supervision")).toBeInTheDocument();
    expect(within(due).getByRole("button", { name: "Log 1.0 h for Supervision" })).toBeInTheDocument();
  });

  it("never logs on its own — tapping Log only hands the owner a pre-filled draft to confirm", async () => {
    const user = userEvent.setup();
    const { onLogRoutine } = renderPage();
    await user.click(screen.getByRole("button", { name: "Log 1.0 h for Supervision" }));
    expect(onLogRoutine).toHaveBeenCalledTimes(1);
    expect(onLogRoutine).toHaveBeenCalledWith({
      routineId: "r1",
      date: "2026-09-28",
      title: "Supervision",
      hours: 1,
      allocations: [{ category: "reviewing", hours: 1 }],
    });
  });

  it("says in plain words that a routine never logs itself", () => {
    renderPage();
    expect(screen.getByTestId("cme-routines-confirmation-note")).toHaveTextContent(
      /never|nothing is recorded until you confirm/i,
    );
  });

  it("lists every active routine with its next-due date", () => {
    renderPage();
    const list = screen.getByTestId("cme-routines-list");
    expect(within(list).getByText("Journal club")).toBeInTheDocument();
    expect(within(list).getByText(/Next due 1 Dec 2026/)).toBeInTheDocument();
  });

  it("lets the owner log a routine that is not yet due, from the general list", async () => {
    const user = userEvent.setup();
    const { onLogRoutine } = renderPage();
    await user.click(screen.getByRole("button", { name: "Log usual hours for Journal club" }));
    expect(onLogRoutine).toHaveBeenCalledWith({
      routineId: "r2",
      date: "2026-09-28",
      title: "Journal club",
      hours: 1.5,
      allocations: [],
    });
  });

  it("gives two due routines with identical usual hours distinct accessible names", () => {
    const otherDueRoutine: CmeRoutine = {
      id: "r4",
      title: "Peer review group",
      cadence: "monthly",
      usualHours: 1,
      usualAllocations: [],
      nextDue: "2026-09-28",
      archivedAt: null,
    };
    renderPage({ routines: [dueRoutine, otherDueRoutine] });
    const due = screen.getByTestId("cme-routines-due");
    expect(within(due).getByRole("button", { name: "Log 1.0 h for Supervision" })).toBeInTheDocument();
    expect(within(due).getByRole("button", { name: "Log 1.0 h for Peer review group" })).toBeInTheDocument();
  });

  it("never shows an archived routine, due or not", () => {
    renderPage();
    expect(screen.queryByText("Retired peer-review group")).toBeNull();
  });

  it("offers a New routine control", async () => {
    const user = userEvent.setup();
    const { onNewRoutine } = renderPage();
    await user.click(screen.getByRole("button", { name: /new routine/i }));
    expect(onNewRoutine).toHaveBeenCalledTimes(1);
  });

  it("shows a plain empty state when there are no routines yet", () => {
    renderPage({ routines: [] });
    expect(screen.getByTestId("cme-routines-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-routines-due")).toBeNull();
    expect(screen.queryByTestId("cme-routines-list")).toBeNull();
    // Still offered — a routine with no data yet is still not a reason to hide the control.
    expect(screen.getByRole("button", { name: /new routine/i })).toBeInTheDocument();
  });

  it("says nothing is due, in words, when nothing is", () => {
    renderPage({ routines: [notYetDueRoutine] });
    expect(screen.queryByTestId("cme-routines-due")).toBeNull();
    expect(screen.getByTestId("cme-routines-due-empty")).toHaveTextContent(/nothing is due/i);
  });

  it("keeps every tappable control at the 48px tap-target floor", () => {
    const { container } = renderPage();
    const interactive = [...container.querySelectorAll("button, a[href]")];
    expect(interactive.length).toBeGreaterThan(0);
    for (const node of interactive) {
      expect(node.className).toMatch(/\bmin-h-(?:12|tap)\b/);
    }
  });

  it("paints no clinical status colour anywhere on the screen", () => {
    const { container } = renderPage();
    const offenders = [...container.querySelectorAll<HTMLElement>("[class]")].filter((node) =>
      /\b(?:bg|text|border|ring)-(?:red|amber|green|orange|rose|emerald|yellow)-/.test(node.className),
    );
    expect(offenders.map((node) => node.className)).toEqual([]);
  });
});
