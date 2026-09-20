import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CmeRoutinesPage, type CmeRoutinesPageProps } from "@/components/cme/cme-routines-page";
import type { CmeRoutine } from "@/lib/cme/routines";

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
  it("puts a due routine at the top with a one-tap log button as the visual focus", () => {
    renderPage();
    const due = screen.getByTestId("cme-routines-due");
    expect(within(due).getByText("Supervision")).toBeInTheDocument();
    expect(within(due).getByRole("button", { name: "Log 1.0 h" })).toBeInTheDocument();
  });

  it("never logs on its own — tapping Log only hands the owner a pre-filled draft to confirm", async () => {
    const user = userEvent.setup();
    const { onLogRoutine } = renderPage();
    await user.click(screen.getByRole("button", { name: "Log 1.0 h" }));
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
