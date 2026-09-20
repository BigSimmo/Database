import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { DEMO_CME_ENTRIES, DEMO_CME_YEAR } from "@/lib/cme/demo-year";

function renderAt(iso: string) {
  return render(<CmeDashboard set={DEMO_CME_YEAR} entries={DEMO_CME_ENTRIES} now={new Date(iso)} />);
}

describe("the dashboard", () => {
  it("leads with the figure, the pace mark and one action", () => {
    renderAt("2026-09-19T02:00:00Z");
    expect(screen.getByTestId("cme-total-hours")).toHaveTextContent("32.5");
    expect(screen.getByTestId("progress-mark")).toBeInTheDocument();
    expect(screen.getByTestId("cme-pace-sentence")).toHaveTextContent(/45 hours by 31 December/);
    expect(screen.getByTestId("cme-next-action")).toBeInTheDocument();
  });

  it("says nothing about pace in January and points at the plan instead", () => {
    renderAt("2026-01-06T02:00:00Z");
    expect(screen.queryByTestId("cme-pace-sentence")).toBeNull();
    expect(screen.queryByTestId("progress-mark")).toBeNull();
    expect(screen.getByTestId("cme-next-action")).toHaveTextContent(/development plan/i);
  });

  it("turns into the year-end checklist in the last fortnight", () => {
    renderAt("2026-12-28T02:00:00Z");
    expect(screen.getByTestId("cme-next-action")).toHaveTextContent(/close the year/i);
  });

  it("shows a legitimate zero as a zero", () => {
    render(<CmeDashboard set={DEMO_CME_YEAR} entries={[]} now={new Date("2026-09-19T02:00:00Z")} />);
    expect(screen.getByTestId("cme-total-hours")).toHaveTextContent("0");
  });
});
