/** @vitest-environment jsdom */

// My Day: the page (loading, signed-out, ready sections, notices, empty) and the
// home card (renders nothing unless there is something to show).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyDayItem, MyDaySourceResult, MyDayState } from "@/lib/my-day/model";

const hookState: { current: MyDayState } = vi.hoisted(() => ({ current: undefined as unknown as MyDayState }));
vi.mock("@/components/my-day/use-my-day-items", () => ({
  useMyDayItems: () => hookState.current,
}));

let isAuthenticated = true;
vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({ isAuthenticated }),
}));

vi.mock("@/components/clinical-dashboard/account-setup-dialog", () => ({
  AccountSetupDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="account-dialog" /> : null),
}));

import { MyDayHomeCard } from "@/components/my-day/my-day-home-card";
import { MyDayPage } from "@/components/my-day/my-day-page";

// 09:00 on Sat 26 Sep 2026 in Perth.
const NOW = new Date("2026-09-26T01:00:00Z");

function item(id: string, severity: MyDayItem["severity"], overrides: Partial<MyDayItem> = {}): MyDayItem {
  return {
    id,
    mode: "my-work",
    title: `Title ${id}`,
    due: severity === "info" ? "2026-12-01" : "2026-09-27",
    severity,
    href: `/admin/${id}`,
    ...overrides,
  };
}

const retry = vi.fn();
const readySources: MyDaySourceResult[] = [
  { mode: "on-call", status: "ready", items: [] },
  { mode: "roster", status: "ready", items: [] },
  { mode: "cme", status: "ready", items: [] },
  { mode: "teaching", status: "ready", items: [] },
  { mode: "my-work", status: "ready", items: [] },
];

function setState(overrides: Partial<MyDayState>) {
  hookState.current = {
    status: "ready",
    items: [],
    sources: readySources,
    demoMode: false,
    retry,
    ...overrides,
  };
}

beforeEach(() => {
  isAuthenticated = true;
  retry.mockClear();
  setState({});
});
afterEach(cleanup);

describe("MyDayPage", () => {
  it("shows a static skeleton while loading", () => {
    setState({ status: "loading" });
    render(<MyDayPage now={NOW} />);
    expect(screen.getByRole("heading", { name: "My Day" })).toBeTruthy();
    expect(screen.getByTestId("my-day-loading")).toBeTruthy();
    expect(screen.queryByTestId("my-day-ready")).toBeNull();
  });

  it("asks a signed-out reader to sign in", () => {
    isAuthenticated = false;
    setState({ status: "signed-out" });
    render(<MyDayPage now={NOW} />);
    const panel = screen.getByTestId("my-day-signed-out");
    expect(within(panel).getByText("Sign in to see your day")).toBeTruthy();
    expect(screen.queryByTestId("account-dialog")).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: "Sign in" }));
    expect(screen.getByTestId("account-dialog")).toBeTruthy();
  });

  it("groups items as Overdue, Due soon, Later in that order and omits empty groups", () => {
    setState({
      items: [item("a", "overdue"), item("b", "soon"), item("c", "info", { mode: "cme", detail: "Extra line" })],
    });
    render(<MyDayPage now={NOW} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Overdue", "Due soon", "Later"]);
    const later = screen.getByTestId("my-day-item-c");
    expect(later.textContent).toContain("CPD");
    expect(later.textContent).toContain("Extra line");
    expect(screen.getByTestId("my-day-item-a").getAttribute("href")).toBe("/admin/a");

    setState({ items: [item("b", "soon")] });
    cleanup();
    render(<MyDayPage now={NOW} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Due soon"]);
  });

  it("marks only overdue rows with a warning label and a plain Due soon label otherwise", () => {
    setState({ items: [item("a", "overdue"), item("b", "soon"), item("c", "info")] });
    render(<MyDayPage now={NOW} />);
    const overdue = within(screen.getByTestId("my-day-item-a").parentElement as HTMLElement).getByText("Overdue");
    expect(overdue.closest("[data-testid], span")).toBeTruthy();
    expect(document.querySelectorAll(".bg-\\[color\\:var\\(--warning\\)\\]").length).toBe(1);
    expect(screen.getByText("Due soon", { selector: "span" })).toBeTruthy();
    expect(within(screen.getByTestId("my-day-item-c").parentElement as HTMLElement).queryByText("Due soon")).toBeNull();
  });

  it("names failed sources, keeps the rest, and retries on click", () => {
    setState({
      items: [item("a", "soon")],
      sources: readySources.map((source) =>
        source.mode === "roster" || source.mode === "cme" ? { ...source, status: "failed" as const } : source,
      ),
    });
    render(<MyDayPage now={NOW} />);
    expect(screen.getByTestId("my-day-failed-notice").textContent).toContain(
      "Couldn't load: Roster, CPD. Showing the rest.",
    );
    expect(screen.getByTestId("my-day-item-a")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("explains an unavailable Roster source", () => {
    setState({
      sources: readySources.map((source) =>
        source.mode === "roster" ? { ...source, status: "unavailable" as const } : source,
      ),
    });
    render(<MyDayPage now={NOW} />);
    expect(screen.getByTestId("my-day-unavailable-notice").textContent).toContain(
      "Roster team data isn't available yet, so swaps aren't shown.",
    );
  });

  it("says when the data is demo data", () => {
    setState({ demoMode: true, items: [item("a", "soon")] });
    render(<MyDayPage now={NOW} />);
    expect(screen.getByTestId("my-day-demo-notice").textContent).toContain(
      "Demo data: these items are invented examples.",
    );
  });

  it("shows a calm empty state naming only the modes that were checked", () => {
    setState({
      sources: readySources.map((source) =>
        source.mode === "roster" ? { ...source, status: "failed" as const } : source,
      ),
    });
    render(<MyDayPage now={NOW} />);
    const empty = screen.getByTestId("my-day-empty");
    expect(empty.textContent).toContain("Nothing needs you right now");
    expect(empty.textContent).toContain("On Call");
    expect(empty.textContent).toContain("Teaching");
    expect(empty.textContent).not.toContain("Roster");
    expect(screen.getByTestId("my-day-footer").textContent).toContain("Read-only.");
  });
});

describe("MyDayHomeCard", () => {
  it("renders nothing when signed out", () => {
    isAuthenticated = false;
    setState({ status: "signed-out", items: [] });
    const { container } = render(<MyDayHomeCard now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing while loading", () => {
    setState({ status: "loading", items: [item("a", "overdue")] });
    const { container } = render(<MyDayHomeCard now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing in demo mode", () => {
    setState({ demoMode: true, items: [item("a", "overdue")] });
    const { container } = render(<MyDayHomeCard now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing with zero items", () => {
    setState({ items: [] });
    const { container } = render(<MyDayHomeCard now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the top three items and a See all link to /my-day", () => {
    setState({
      items: [item("a", "overdue"), item("b", "overdue"), item("c", "soon"), item("d", "info"), item("e", "info")],
    });
    render(<MyDayHomeCard now={NOW} />);
    const card = screen.getByTestId("my-day-home-card");
    expect(within(card).getByRole("heading", { name: "My Day" })).toBeTruthy();
    expect(screen.getByTestId("my-day-item-a")).toBeTruthy();
    expect(screen.getByTestId("my-day-item-c")).toBeTruthy();
    expect(screen.queryByTestId("my-day-item-d")).toBeNull();
    const seeAll = screen.getByTestId("my-day-home-card-see-all");
    expect(seeAll.getAttribute("href")).toBe("/my-day");
    expect(seeAll.textContent).toContain("See all 5");
    expect(seeAll.textContent).toContain("2 overdue · 1 due soon");
  });
});
