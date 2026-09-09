import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreBandBar } from "@/components/calculators/calculator-ui";
import { calculators } from "@/components/calculators/calculator-fixtures";
import { sourceStatusDotTone, sourceStatusShortLabel } from "@/components/clinical-dashboard/answer-content";
import { StatusDotMarker } from "@/components/ui-primitives";
import { normalizeSourceMetadata } from "@/lib/source-metadata";

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

  it("renders the production status-marker composition for ready, review, and muted states", () => {
    const markers = [
      {
        status: "current",
        expected: ["rounded-full", "border-2", "bg-transparent"],
        absent: ["rotate-45", "rounded-sm"],
      },
      {
        status: "review_due",
        expected: ["rotate-45", "rounded-sm", "bg-[color:var(--warning)]"],
        absent: ["border-2", "bg-transparent"],
      },
      {
        status: "unknown",
        expected: ["rounded-full", "bg-[color:var(--decoration-soft)]"],
        absent: ["rotate-45", "border-2"],
      },
    ] as const;

    render(
      <ul>
        {markers.map(({ status }) => {
          const metadata = normalizeSourceMetadata({ document_status: status });
          return (
            <li key={status}>
              <StatusDotMarker tone={sourceStatusDotTone(metadata)} label={sourceStatusShortLabel(metadata)} />
            </li>
          );
        })}
      </ul>,
    );

    for (const { status, expected, absent } of markers) {
      const metadata = normalizeSourceMetadata({ document_status: status });
      const label = sourceStatusShortLabel(metadata);
      const labelNode = screen.getByText(label);
      expect(labelNode).toBeVisible();
      const marker = labelNode.previousElementSibling;
      expect(marker).toBeInstanceOf(HTMLElement);
      expect(marker).toHaveAttribute("aria-hidden", "true");
      expect(marker).toHaveClass("inline-block", "h-2", "w-2", ...expected);
      for (const className of absent) expect(marker).not.toHaveClass(className);
    }
  });
});
