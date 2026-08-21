import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeveloperLedgerPage from "@/app/mockups/development/ledger/page";
import { loadLedgerSnapshot, openItemsByPriority } from "@/lib/developer-area/ledger-snapshot";

/**
 * Overrides ride on top of the *real* committed snapshot, following
 * `tests/developer-hub-page.dom.test.tsx`: a state the live ledger does not
 * currently exercise gets pinned against the shape the route actually loads,
 * rather than against a hand-built fixture that could drift from it. `null`
 * means "do not override".
 */
const acuityOverride = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("@/lib/developer-area/ledger-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/ledger-snapshot")>();
  return {
    ...actual,
    loadLedgerSnapshot: () => {
      const snapshot = actual.loadLedgerSnapshot();
      if (acuityOverride.value === null) return snapshot;
      const acuity = acuityOverride.value;
      return { ...snapshot, queue: snapshot.queue.map((entry) => ({ ...entry, acuity })) };
    },
  };
});

afterEach(cleanup);

afterEach(() => {
  acuityOverride.value = null;
});

describe("developer ledger page", () => {
  it("renders priority and acuity as visibly distinct labels", () => {
    render(<DeveloperLedgerPage />);
    const queue = screen.getByTestId("developer-ledger-queue");
    // Acuity lives only in the queue; priority only in the open list. A shared
    // badge would report the P1 rows and the A1 queue entry as one urgent set.
    expect(within(queue).queryByText(/^P1$/)).toBeNull();
    expect(within(screen.getByTestId("developer-ledger-open")).queryByText(/^A1$/)).toBeNull();
  });

  it("shows counts that match the snapshot", () => {
    const snapshot = loadLedgerSnapshot();
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-ledger-count-open")).toHaveTextContent(String(snapshot.counts.open));
    expect(screen.getByTestId("developer-ledger-count-pending")).toHaveTextContent(String(snapshot.counts.pending));
  });

  it("wires all four counts to the snapshot rather than hardcoding any of them", () => {
    // The two the brief pins are not enough on their own: `-p1` and `-queued`
    // could each carry a literal and still pass above. Every tile must read
    // from the same snapshot the list below it renders.
    const { counts } = loadLedgerSnapshot();
    render(<DeveloperLedgerPage />);

    expect(screen.getByTestId("developer-ledger-count-p1").textContent).toContain(String(counts.p1));
    expect(screen.getByTestId("developer-ledger-count-queued").textContent).toContain(String(counts.queued));
    // The queued tile must agree with the list it describes, not merely with
    // the counts block — that is what makes it unfakeable.
    expect(within(screen.getByTestId("developer-ledger-queue")).getAllByRole("listitem")).toHaveLength(counts.queued);
  });

  it("always shows the freshness stamp", () => {
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-hub-freshness")).toBeInTheDocument();
  });

  it("keeps full detail in the DOM behind a native disclosure, not a click handler", () => {
    render(<DeveloperLedgerPage />);
    const item = screen.getAllByTestId(/^developer-ledger-item-/)[0];
    expect(item.querySelector("details")).not.toBeNull();
    expect(item.querySelector("button")).toBeNull();
  });

  it("carries no button anywhere on the page, so nothing needs a client handler", () => {
    // Task 7 shipped a `<button onClick>` inside a Server Component and the
    // route threw on every render; neither tsc nor jsdom can see that class of
    // bug, because jsdom renders this as an ordinary client tree. Asserting the
    // absence of buttons outright is what keeps the page free of handlers.
    const { container } = render(<DeveloperLedgerPage />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps the collapsed detail text in the DOM rather than withholding it", () => {
    // Progressive disclosure is a readability device, not a data-hiding one.
    // The longest detail cell is ~7,800 characters, which is why it is not
    // inline — but it must still be findable and screen-reader reachable.
    const snapshot = loadLedgerSnapshot();
    const first = snapshot.open[0];
    render(<DeveloperLedgerPage />);

    const item = screen.getByTestId(`developer-ledger-item-${first.id.replace("#", "")}`);
    expect(item.querySelector("details")?.textContent).toContain(first.detail);
  });

  it("labels the running order as urgency, not priority", () => {
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-ledger-queue-caption")).toHaveTextContent(/urgency, not priority/i);
  });

  it("renders every open item, grouped P1 then P2 then P3", () => {
    const snapshot = loadLedgerSnapshot();
    const grouped = openItemsByPriority(snapshot);
    render(<DeveloperLedgerPage />);

    const open = screen.getByTestId("developer-ledger-open");
    const rendered = within(open)
      .getAllByTestId(/^developer-ledger-item-/)
      .map((node) => node.getAttribute("data-testid"));

    // `openItemsByPriority` recognises only P1-P3, so any other priority must
    // still be rendered somewhere rather than silently dropped: the list has to
    // add up to `counts.open`, which is the number the tile above it reports.
    const inGroups = [...grouped.P1, ...grouped.P2, ...grouped.P3];
    const inGroupIds = new Set(inGroups.map((item) => item.id));
    const remainder = snapshot.open.filter((item) => !inGroupIds.has(item.id));

    expect(rendered).toEqual(
      [...inGroups, ...remainder].map((item) => `developer-ledger-item-${item.id.replace("#", "")}`),
    );
    expect(rendered).toHaveLength(snapshot.counts.open);
  });

  it("renders an acuity value it does not recognise instead of dropping the entry", () => {
    // The spec lists "Optional" as a possible acuity; the live ledger only ever
    // uses A1-A3, so without this override the unknown branch is never reached.
    acuityOverride.value = "Optional";
    const snapshot = loadLedgerSnapshot();
    render(<DeveloperLedgerPage />);

    const queue = screen.getByTestId("developer-ledger-queue");
    expect(within(queue).getAllByRole("listitem")).toHaveLength(snapshot.counts.queued);
    expect(within(queue).getAllByText("Optional").length).toBe(snapshot.counts.queued);
  });

  it("lists every pending inbox request", () => {
    const snapshot = loadLedgerSnapshot();
    render(<DeveloperLedgerPage />);
    const pending = screen.getByTestId("developer-ledger-pending");
    expect(within(pending).getAllByRole("listitem")).toHaveLength(snapshot.counts.pending);
    expect(pending).toHaveTextContent(snapshot.pending[0].summary);
  });

  it("links back to the developer hub", () => {
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-ledger-back")).toHaveAttribute("href", "/mockups/development");
  });

  it("shows no markdown pipe escape to the reader", () => {
    // `open.#SZGPAH.detail` carried a literal `\|` — a markdown-table artifact
    // that has no business in a JSON data contract, and that the page would
    // otherwise render verbatim. Fixed in the generator, pinned here end to end.
    const { container } = render(<DeveloperLedgerPage />);
    // `String.raw` on purpose: a plain "\|" is just "|" after JS escape
    // processing, which would assert the page contains no pipe character at all.
    expect(container.textContent).not.toContain(String.raw`\|`);
    expect(container.textContent).toContain("2 failed | 14 passed");
  });
});
