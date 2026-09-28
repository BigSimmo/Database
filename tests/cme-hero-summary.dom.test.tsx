import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CmeHeroSummary, type CmeHeroSummaryProps } from "@/components/cme/cme-hero-summary";
import { DEMO_CME_ENTRIES } from "@/lib/cme/demo-year";

/** The demo doctor on Sat 26 Sep 2026: 32.5 of 50 h logged. */
function renderHero(overrides: Partial<CmeHeroSummaryProps> = {}) {
  return render(
    <CmeHeroSummary
      year={2026}
      today="2026-09-26"
      loggedHours={32.5}
      targetHours={50}
      entries={DEMO_CME_ENTRIES}
      {...overrides}
    />,
  );
}

describe("the CPD hero summary", () => {
  it("says the season, the hours against the target and the weekly pace, in words", () => {
    renderHero();
    const hero = screen.getByTestId("cme-hero-summary");
    expect(within(hero).getByTestId("cme-hero-season")).toHaveTextContent("Year ends 31 Dec 2026, in 14 weeks");
    expect(within(hero).getByTestId("cme-total-hours")).toHaveTextContent("32.5 of 50 h");
    expect(within(hero).getByTestId("cme-pace-sentence")).toHaveTextContent(
      "About 1.3 h a week reaches 50 h by 31 Dec",
    );
  });

  it("keeps a non-breaking space between every number and its unit", () => {
    renderHero();
    expect(screen.getByTestId("cme-total-hours").textContent).toBe("32.5 of 50 h");
    expect(screen.getByTestId("cme-pace-sentence").textContent).toBe("About 1.3 h a week reaches 50 h by 31 Dec");
  });

  it("draws the weeks without a grade or status colour", () => {
    const { container } = renderHero();
    expect(screen.getByTestId("cme-hero-bar")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByTestId("cme-week-bar")).toHaveLength(53);
    expect(screen.getByText(/Hours logged in each week of 2026/)).toBeInTheDocument();
    expect(screen.getAllByTestId("cme-week-bar").some((bar) => bar.className.includes("--cme-hero-fill"))).toBe(true);
    expect(screen.queryByTestId("progress-mark")).toBeNull();
    expect(container.textContent).not.toContain("%");
    expect(container.innerHTML).not.toMatch(/--tone-|--success|--danger|--warning/);
  });

  it("sits on the summary surface with the one light display figure", () => {
    renderHero();
    const hero = screen.getByTestId("cme-hero-summary");
    expect(hero.className).toContain("bg-[color:var(--surface-summary)]");
    expect(hero.className).toContain("border-[color:var(--surface-summary-line)]");
    expect(hero.className).toMatch(/\brounded-xl\b/);
    expect(hero.className).not.toMatch(/\brounded-lg\b/);
    const figure = within(hero).getByText("32.5");
    expect(figure.className).toMatch(/\btext-display\b/);
    expect(figure.className).toMatch(/\bfont-light\b/);
  });

  it("hides the pace line in the first four weeks of the year", () => {
    renderHero({ today: "2026-01-27", loggedHours: 1, entries: [] });
    expect(screen.getByTestId("cme-hero-season")).toHaveTextContent("Early in the year · write your plan");
    expect(screen.queryByTestId("cme-pace-sentence")).toBeNull();
  });

  it("gives the day the target was reached once it is reached", () => {
    // The demo log's running total passes 30 h on 15 Sep.
    renderHero({ targetHours: 30 });
    expect(screen.getByTestId("cme-pace-sentence")).toHaveTextContent("30 h reached on 15 Sep");
    expect(screen.getAllByTestId("cme-week-bar")).toHaveLength(53);
  });

  it("says the hours still to go, not a weekly figure, in the last days of the year", () => {
    // 26 Dec: 5 days left. A weekly figure would read "About 17.5 h a week".
    renderHero({ today: "2026-12-26" });
    expect(screen.getByTestId("cme-pace-sentence").textContent).toBe("17.5 h to go by 31 Dec");
  });

  it("shows no pace line once the year is closed, unless the target was reached", () => {
    const { unmount } = renderHero({ closed: true, today: "2026-12-20" });
    expect(screen.queryByTestId("cme-pace-sentence")).toBeNull();
    unmount();
    renderHero({ closed: true, today: "2026-12-20", targetHours: 30 });
    expect(screen.getByTestId("cme-pace-sentence")).toHaveTextContent("30 h reached on 15 Sep");
  });

  it("keeps the logged weeks and hides pace for a zero target", () => {
    renderHero({ targetHours: 0 });
    expect(screen.getAllByTestId("cme-week-bar").some((bar) => Number(bar.dataset.hours) > 0)).toBe(true);
    expect(screen.queryByTestId("cme-pace-sentence")).toBeNull();
  });

  it("is one 48 px button only when it has a detail to open", async () => {
    const user = userEvent.setup();
    const { unmount } = renderHero();
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    const onOpenDetail = vi.fn();
    renderHero({ onOpenDetail });
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/\bmin-h-12\b/);
    await user.click(button);
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });
});
