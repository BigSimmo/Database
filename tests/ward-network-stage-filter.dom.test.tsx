import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors the sibling network suites: the workspace renders next/link anchors and this file never
// checks routing, so a plain anchor avoids needing an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE STAGE STRIP DOES WHAT ITS NUMBERING PROMISES — AND THE FILTER CANNOT BE MISTAKEN FOR THE
 * WHOLE QUEUE.
 *
 * The strip's six waiting cells were `<span>`s: no handler, no tab stop, no role. The button-wiring
 * gate never fired precisely because they are not buttons, so nothing in the repository could
 * notice. What made them read as activatable was the NUMBERING — 1 to 6 is a pipeline you step
 * into — rather than any hover affordance.
 *
 * ⚠️ **THE SAFETY PROBLEM IS NOT THE WIRING, IT IS WHAT A FILTER DOES TO A DEMAND FIGURE.** A queue
 * showing 14 rows when 43 people are waiting is the most dangerous screen in this prototype if the
 * reader cannot instantly tell which of those two numbers they are looking at. So the count in the
 * panel header is pinned here to the TRUE OPEN TOTAL in every filtered state — it is the figure a
 * coordinator reads as "how much demand is there", and a filter must never be able to shrink it.
 * The filtered subset is stated separately, in words, with an always-present way out.
 *
 * These assertions are therefore mostly about what does NOT change when a filter is applied.
 */
describe("the stage strip filters the queue without disguising it", () => {
  const open = wardMovements.filter(isOpen);

  function renderNetwork() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
  }

  function queuePanel() {
    return screen.getByRole("region", { name: "Priority queue" });
  }

  /** The stage with the most people waiting — the filter with the most to prove, and never zero. */
  const busiest = (() => {
    const counts = new Map<string, number>();
    for (const movement of open) counts.set(movement.stage, (counts.get(movement.stage) ?? 0) + 1);
    const [stage, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { stage, count };
  })();

  it("has a stage holding SOME but not all of the queue, or filtering proves nothing", () => {
    // The canary. A filter is indistinguishable from no filter when the chosen stage happens to
    // hold everybody, and indistinguishable from a broken screen when it holds nobody.
    expect(busiest.count).toBeGreaterThan(0);
    expect(
      busiest.count,
      "the busiest stage must hold fewer than every waiting patient, or 'the filter narrowed the " +
        "list' is not something this file can observe",
    ).toBeLessThan(open.length);
  });

  it("makes each waiting cell a real control, not a span that looks like one", async () => {
    renderNetwork();
    const strip = screen.getByRole("region", { name: "Movement pipeline" });
    const controls = within(strip).getAllByRole("button");
    expect(controls.length, "the numbered cells must be reachable by keyboard").toBe(
      within(strip).getAllByTestId(/^ward-pipeline-waiting-/).length,
    );
    for (const control of controls) {
      expect(control, "an unpressed filter must say so, not merely look unstyled").toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("does NOT make the left-the-pathway cell a filter, because those people are not in the queue", () => {
    renderNetwork();
    const strip = screen.getByRole("region", { name: "Movement pipeline" });
    const departed = within(strip).getByTestId("ward-pipeline-left-pathway");
    expect(
      within(departed).queryByRole("button"),
      "filtering the queue to people who have left it would show an empty queue and invite the " +
        "reading that nobody is waiting",
    ).toBeNull();
  });

  it("narrows the queue to the chosen stage", async () => {
    const user = userEvent.setup();
    renderNetwork();
    await user.click(screen.getByTestId(`ward-pipeline-waiting-${busiest.stage}`));

    const rows = within(queuePanel()).getAllByTestId(/^ward-network-queue-/);
    expect(rows.length).toBe(busiest.count);
    for (const movement of open.filter((candidate) => candidate.stage !== busiest.stage)) {
      expect(
        within(queuePanel()).queryByTestId(`ward-network-queue-${movement.id}`),
        `${movement.id} is at another stage and must not survive the filter`,
      ).toBeNull();
    }
  });

  it("⚠️ KEEPS THE TRUE OPEN TOTAL IN THE HEADER WHILE FILTERED — the figure read as demand", async () => {
    const user = userEvent.setup();
    renderNetwork();
    await user.click(screen.getByTestId(`ward-pipeline-waiting-${busiest.stage}`));

    expect(
      within(queuePanel()).getByTestId("ward-network-open-total"),
      `the header count must still read ${open.length}. If a filter can change it to ` +
        `${busiest.count}, then a coordinator who does not notice the filter reads a fraction of ` +
        "the waiting list as the whole of it, and every screen that agrees with this one now " +
        "disagrees with reality rather than with another screen.",
    ).toHaveTextContent(String(open.length));
  });

  it("says in words that it is filtered, and offers the way out", async () => {
    const user = userEvent.setup();
    renderNetwork();
    const notice = "ward-network-filter-notice";
    expect(
      screen.queryByTestId(notice),
      "an unfiltered queue must not carry a filter notice, or the notice stops meaning anything",
    ).toBeNull();

    await user.click(screen.getByTestId(`ward-pipeline-waiting-${busiest.stage}`));
    const banner = screen.getByTestId(notice);
    expect(banner).toHaveTextContent(String(busiest.count));
    expect(banner).toHaveTextContent(String(open.length));
    expect(within(banner).getByRole("button")).toBeInTheDocument();
  });

  it("comes back to the whole queue, by the way out and by pressing the same cell again", async () => {
    const user = userEvent.setup();
    renderNetwork();
    const cell = screen.getByTestId(`ward-pipeline-waiting-${busiest.stage}`);

    await user.click(cell);
    expect(cell).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByTestId("ward-network-filter-notice")).getByRole("button"));
    expect(within(queuePanel()).getAllByTestId(/^ward-network-queue-/).length).toBe(open.length);
    expect(cell).toHaveAttribute("aria-pressed", "false");

    // And the cell itself toggles, so a coordinator who filtered by mistake undoes it where they
    // did it rather than having to find the notice.
    await user.click(cell);
    await user.click(cell);
    expect(within(queuePanel()).getAllByTestId(/^ward-network-queue-/).length).toBe(open.length);
  });

  it("keeps the strip's own figures unfiltered, so the way back is always legible", async () => {
    const user = userEvent.setup();
    renderNetwork();
    await user.click(screen.getByTestId(`ward-pipeline-waiting-${busiest.stage}`));

    const strip = screen.getByRole("region", { name: "Movement pipeline" });
    const shown = within(strip)
      .getAllByTestId(/^ward-pipeline-waiting-/)
      .reduce((total, cell) => total + Number(within(cell).getByTestId("ward-pipeline-count").textContent), 0);
    expect(
      shown,
      "a filter that also rewrote the strip would leave no visible route back to the full picture, " +
        "and the cells would stop summing to the header count they sit above",
    ).toBe(open.length);
  });
});
