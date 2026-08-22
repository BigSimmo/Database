import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreBandBar } from "@/components/calculators/calculator-ui";
import { calculators } from "@/components/calculators/calculator-fixtures";
import { statusDotMuted, statusDotReady, statusDotReview } from "@/components/ui-primitives";

const phq9 = calculators.find((calculator) => calculator.id === "phq9");

if (!phq9) throw new Error("PHQ-9 fixture is required for status-semantics DOM coverage");

describe("rendered clinical status semantics", () => {
  it("exposes the calculator scale name and renders every severity edge pattern", () => {
    render(<ScoreBandBar calc={phq9} score={0} started={false} />);

    const scale = screen.getByRole("img", { name: "Score severity scale from 0 to 27" });
    const renderedBands = Array.from(scale.children);
    const tonePatterns = {
      success: ["border-b-2", "border-[color:var(--text-heading)]"],
      info: ["border-t-2", "border-[color:var(--text-heading)]"],
      warning: ["border-y-2", "border-[color:var(--text-heading)]"],
      danger: ["border-2", "border-[color:var(--text-heading)]"],
    } as const;

    expect(renderedBands).toHaveLength(phq9.bands.length);
    phq9.bands.forEach((band, index) => {
      expect(renderedBands[index]).toHaveClass(...tonePatterns[band.tone]);
    });
  });

  it("renders ready, review, and muted markers with visible text and distinct geometry", () => {
    const markers = [
      {
        label: "Ready",
        className: statusDotReady,
        expected: ["rounded-full", "border-2", "bg-transparent"],
        absent: ["rotate-45", "rounded-sm"],
      },
      {
        label: "Review",
        className: statusDotReview,
        expected: ["rotate-45", "rounded-sm", "bg-[color:var(--warning)]"],
        absent: ["border-2", "bg-transparent"],
      },
      {
        label: "Muted",
        className: statusDotMuted,
        expected: ["rounded-full", "bg-[color:var(--decoration-soft)]"],
        absent: ["rotate-45", "border-2"],
      },
    ] as const;

    render(
      <ul>
        {markers.map(({ label, className }) => (
          <li key={label}>
            <span data-testid={`${label.toLowerCase()}-marker`} className={className} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>,
    );

    for (const { label, expected, absent } of markers) {
      expect(screen.getByText(label)).toBeVisible();
      const marker = screen.getByTestId(`${label.toLowerCase()}-marker`);
      expect(marker).toHaveAttribute("aria-hidden", "true");
      expect(marker).toHaveClass("inline-block", "h-2", "w-2", ...expected);
      for (const className of absent) expect(marker).not.toHaveClass(className);
    }
  });
});
