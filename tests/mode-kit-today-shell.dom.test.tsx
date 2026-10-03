/** @vitest-environment jsdom */

// The shared Today shell: one slot order, one featured module, honest states.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { todaySlotOrder, todayStateCopy } from "@/components/mode-kit/today/today-copy";
import { TodayShell, type TodayNeedsYouSlot, type TodaySharedState } from "@/components/mode-kit/today/today-shell";
import type { TodayItem } from "@/lib/today/today-item";

afterEach(cleanup);

function item(id: string, severity: TodayItem["severity"], overrides: Partial<TodayItem> = {}): TodayItem {
  return { id, mode: "my-work", title: `Item ${id}`, due: null, severity, href: `/x/${id}`, ...overrides };
}

interface ShellProps {
  needsYou?: TodayNeedsYouSlot | null;
  state?: TodaySharedState | null;
  safety?: ReactNode;
  comingUp?: ReactNode;
  atAGlance?: ReactNode;
  shortcuts?: ReactNode;
  now?: ReactNode;
  nowSurface?: "featured" | "own";
  needsYouNode?: ReactNode;
  stateExtra?: ReactNode;
  loadingFallback?: ReactNode;
  blocking?: ReactNode;
  columns?: "one" | "two";
}

function shell(props: ShellProps = {}) {
  return (
    <TodayShell
      mode="my-work"
      modeName="Admin"
      status={<p>Good morning</p>}
      now={<p>Now body</p>}
      testId="shell"
      {...props}
    />
  );
}

function slots(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-today-slot]")).map(
    (node) => node.getAttribute("data-today-slot") ?? "",
  );
}

describe("TodayShell slots", () => {
  it("renders every slot in exactly the shared order", () => {
    const { container } = render(
      shell({
        safety: <p>Safety</p>,
        needsYou: { items: [item("a", "info")], seeAllHref: "/all" },
        comingUp: <p>Coming</p>,
        atAGlance: <p>Glance</p>,
        shortcuts: <p>Shortcuts</p>,
      }),
    );
    expect(slots(container)).toEqual([...todaySlotOrder]);
  });

  it("has exactly one featured Now module", () => {
    render(shell({ comingUp: <p>Coming</p> }));
    expect(screen.getAllByTestId("today-now")).toHaveLength(1);
    expect(within(screen.getByTestId("today-now")).getByText("Now body")).toBeTruthy();
  });

  it("renders nothing for optional slots given null", () => {
    const { container } = render(
      shell({ safety: null, needsYou: null, comingUp: null, atAGlance: null, shortcuts: null }),
    );
    expect(slots(container)).toEqual(["status", "now"]);
  });
});

describe("TodayShell Needs you", () => {
  it("sorts overdue, then soon, then info", () => {
    render(
      shell({
        needsYou: { items: [item("i", "info"), item("s", "soon"), item("o", "overdue")], seeAllHref: "/all" },
      }),
    );
    const rows = within(screen.getByTestId("today-needs-you")).getAllByRole("link");
    expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/x/o", "/x/s", "/x/i"]);
  });

  it("shows three rows then See all (n) linking to seeAllHref", () => {
    render(
      shell({
        needsYou: { items: ["a", "b", "c", "d", "e"].map((id) => item(id, "overdue")), seeAllHref: "/admin/renewals" },
      }),
    );
    const list = screen.getByTestId("today-needs-you");
    const seeAll = within(list).getByRole("link", { name: /See all \(5\)/ });
    expect(seeAll.getAttribute("href")).toBe("/admin/renewals");
    expect(within(list).getAllByRole("link")).toHaveLength(4);
  });

  it("has no See all when there are three or fewer", () => {
    render(shell({ needsYou: { items: ["a", "b", "c"].map((id) => item(id, "soon")), seeAllHref: "/all" } }));
    expect(screen.queryByTestId("today-needs-you-see-all")).toBeNull();
  });

  it("renders nothing when empty, unless the state is empty", () => {
    const empty = { items: [], seeAllHref: "/all" };
    const { container, rerender } = render(shell({ needsYou: empty }));
    expect(slots(container)).not.toContain("needs-you");
    rerender(shell({ needsYou: empty, state: { kind: "empty" } }));
    expect(screen.getByTestId("today-needs-you-empty").textContent).toContain(todayStateCopy.empty("Admin").title);
    expect(screen.getByTestId("today-now")).toBeTruthy();
  });

  it("uses renderItem when supplied", () => {
    render(
      shell({
        needsYou: {
          items: [item("a", "overdue")],
          seeAllHref: "/all",
          renderItem: (it) => <li data-testid={`custom-${it.id}`}>{it.title}</li>,
        },
      }),
    );
    expect(screen.getByTestId("custom-a")).toBeTruthy();
  });
});

describe("TodayShell shared states", () => {
  const withBody: ShellProps = {
    safety: <p>Safety rail</p>,
    needsYou: { items: [item("a", "overdue")], seeAllHref: "/all" },
    comingUp: <p>Coming</p>,
    atAGlance: <p>Glance</p>,
    shortcuts: <p>Shortcuts</p>,
  };

  function expectReplaced(container: HTMLElement) {
    expect(screen.queryByTestId("today-now")).toBeNull();
    expect(slots(container)).toEqual(["status", "safety"]);
  }

  it("loading replaces Now to Shortcuts, keeps status and safety, and announces itself", () => {
    const { container } = render(shell({ ...withBody, state: { kind: "loading" } }));
    expectReplaced(container);
    const status = within(screen.getByTestId("today-state-loading")).getByRole("status");
    expect(status.className).toContain("sr-only");
    expect(status.textContent).toBe(todayStateCopy.loading("Admin").title);
  });

  it("signed-out calls onSignIn", () => {
    const onSignIn = vi.fn();
    const { container } = render(shell({ ...withBody, state: { kind: "signed-out", onSignIn } }));
    expectReplaced(container);
    fireEvent.click(screen.getByRole("button", { name: todayStateCopy["signed-out"]("Admin").action }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("failed calls onRetry", () => {
    const onRetry = vi.fn();
    const { container } = render(shell({ ...withBody, state: { kind: "failed", onRetry } }));
    expectReplaced(container);
    fireEvent.click(screen.getByRole("button", { name: todayStateCopy.failed("Admin").action }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offline shows its notice and still renders Now", () => {
    const onRetry = vi.fn();
    render(shell({ ...withBody, state: { kind: "offline", onRetry } }));
    expect(screen.getByTestId("today-state-offline").textContent).toContain(todayStateCopy.offline("Admin").title);
    expect(screen.getByTestId("today-now")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("demo shows its notice and still renders Now", () => {
    render(shell({ ...withBody, state: { kind: "demo" } }));
    expect(screen.getByTestId("today-state-demo").textContent).toContain(todayStateCopy.demo().title);
    expect(screen.getByTestId("today-now")).toBeTruthy();
  });
});

describe("TodayShell options", () => {
  const body: ShellProps = {
    safety: <p>Safety rail</p>,
    comingUp: <p>Coming</p>,
    atAGlance: <p>Glance</p>,
    shortcuts: <p>Shortcuts</p>,
  };

  it('nowSurface "own" draws no featured wrapper and renders the child as the Now slot', () => {
    const { container } = render(shell({ nowSurface: "own", now: <p data-testid="own-hero">Own hero</p> }));
    expect(screen.queryByTestId("today-now")).toBeNull();
    const nowSlot = container.querySelector('[data-today-slot="now"]');
    expect(nowSlot).not.toBeNull();
    expect(within(nowSlot as HTMLElement).getByTestId("own-hero")).toBeTruthy();
  });

  it("renders no Now slot when now is null", () => {
    for (const nowSurface of ["featured", "own"] as const) {
      const { container, unmount } = render(shell({ now: null, nowSurface, comingUp: <p>Coming</p> }));
      expect(slots(container)).toEqual(["status", "coming-up"]);
      unmount();
    }
  });

  it("renders needsYouNode in the Needs-you slot, ahead of the shared list", () => {
    const { container } = render(
      shell({
        needsYouNode: <p data-testid="own-needs-you">Own needs you</p>,
        needsYou: { items: [item("a", "overdue")], seeAllHref: "/all" },
      }),
    );
    const slot = container.querySelector('[data-today-slot="needs-you"]') as HTMLElement;
    expect(within(slot).getByTestId("own-needs-you")).toBeTruthy();
    expect(screen.queryByTestId("today-needs-you")).toBeNull();
    expect(slots(container)).toEqual(["status", "now", "needs-you"]);
  });

  it("shows stateExtra under signed-out and failed, and not under loading", () => {
    const extra = <a href="/help">Crisis lines</a>;
    const { rerender } = render(shell({ stateExtra: extra, state: { kind: "signed-out", onSignIn: vi.fn() } }));
    expect(screen.getByRole("link", { name: "Crisis lines" })).toBeTruthy();
    rerender(shell({ stateExtra: extra, state: { kind: "failed", onRetry: vi.fn() } }));
    expect(screen.getByRole("link", { name: "Crisis lines" })).toBeTruthy();
    rerender(shell({ stateExtra: extra, state: { kind: "loading" } }));
    expect(screen.queryByRole("link", { name: "Crisis lines" })).toBeNull();
  });

  it("loadingFallback replaces the generic skeleton but keeps the sr-only status", () => {
    const { container } = render(
      shell({
        ...body,
        loadingFallback: <div data-testid="own-skeleton" />,
        state: { kind: "loading" },
      }),
    );
    const loading = screen.getByTestId("today-state-loading");
    expect(within(loading).getByTestId("own-skeleton")).toBeTruthy();
    const status = within(loading).getByRole("status");
    expect(status.className).toContain("sr-only");
    expect(status.textContent).toBe(todayStateCopy.loading("Admin").title);
    expect(container.querySelectorAll("[data-testid='today-state-loading'] > *")).toHaveLength(2);
    expect(slots(container)).toEqual(["status", "safety"]);
  });

  it("blocking replaces Now to Shortcuts and keeps status and safety", () => {
    const { container } = render(shell({ ...body, blocking: <p data-testid="own-blocking">No team yet</p> }));
    expect(within(screen.getByTestId("today-state-mode")).getByTestId("own-blocking")).toBeTruthy();
    expect(screen.queryByTestId("today-now")).toBeNull();
    expect(slots(container)).toEqual(["status", "safety"]);
  });

  it("columns two puts Now and Needs you in the act column and the rest in the ahead column, in slot order", () => {
    const { container } = render(
      shell({
        ...body,
        columns: "two",
        needsYou: { items: [item("a", "info")], seeAllHref: "/all" },
      }),
    );
    const act = container.querySelector('[data-today-column="act"]') as HTMLElement;
    const ahead = container.querySelector('[data-today-column="ahead"]') as HTMLElement;
    expect(slots(act as unknown as HTMLElement)).toEqual(["now", "needs-you"]);
    expect(slots(ahead)).toEqual(["coming-up", "at-a-glance", "shortcuts"]);
    expect(slots(container)).toEqual([...todaySlotOrder]);
  });

  it("failed with reason offline uses the failedOffline copy", () => {
    render(shell({ state: { kind: "failed", onRetry: vi.fn(), reason: "offline" } }));
    const failed = screen.getByTestId("today-state-failed");
    expect(failed.textContent).toContain(todayStateCopy.failedOffline("Admin").title);
    expect(failed.textContent).not.toContain(todayStateCopy.failed("Admin").title);
  });
});
