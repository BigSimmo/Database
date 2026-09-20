import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "@/components/ui/progress";

describe("Progress with a target mark", () => {
  it("draws no mark when none is given", () => {
    render(<Progress value={65} label="CPD hours" />);
    expect(screen.queryByTestId("progress-mark")).toBeNull();
  });

  it("places the mark at its own percentage, independent of the fill", () => {
    render(<Progress value={65} label="CPD hours" mark={{ value: 71.8, label: "on pace today" }} />);
    const mark = screen.getByTestId("progress-mark");
    expect(mark).toHaveStyle({ left: "71.8%" });
  });

  it("describes the mark from outside the bar, where a screen reader can still reach it", () => {
    render(<Progress value={65} label="CPD hours" mark={{ value: 71.8, label: "on pace today" }} />);
    // `progressbar` has presentational children in WAI-ARIA, so a name on the
    // notch itself can be stripped by the browser before it is ever announced.
    // The description has to hang off the bar and live outside it.
    expect(screen.getByTestId("progress-mark")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("progressbar")).toHaveAccessibleDescription("on pace today");
    expect(screen.getByTestId("progress-mark-description")).not.toContainElement(screen.getByRole("progressbar"));
    expect(screen.getByRole("progressbar")).not.toContainElement(screen.getByTestId("progress-mark-description"));
  });

  it("adds no description node when there is no mark", () => {
    render(<Progress value={65} label="CPD hours" />);
    expect(screen.queryByTestId("progress-mark-description")).toBeNull();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-describedby");
  });

  it("clamps a mark outside the track rather than drawing off the end", () => {
    render(<Progress value={10} label="CPD hours" mark={{ value: 140, label: "on pace today" }} />);
    expect(screen.getByTestId("progress-mark")).toHaveStyle({ left: "100%" });
  });

  it("keeps the mark out of the accessible value, which is still the fill", () => {
    render(<Progress value={65} label="CPD hours" mark={{ value: 71.8, label: "on pace today" }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "65");
  });
});
