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
    expect(mark).toHaveAccessibleName("on pace today");
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
