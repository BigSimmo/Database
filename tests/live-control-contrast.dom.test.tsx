/** @vitest-environment jsdom */

// #7J47R1: two live controls failed axe colour contrast.
// (a) The document density toggle's subtitle ("Long sections collapsed") was
//     dimmed with `opacity-75`, computing 3.13:1 at 10px in both themes.
// (b) The shared Show-all chip painted its label in `--clinical-accent` on its
//     14% accent wash, 4.23:1 in light. It now uses `--clinical-accent-strong`.
//     That token is not remapped by the On Call / CME `data-mode-identity`
//     blocks, which is safe only because the chip never renders inside an
//     element carrying that attribute (the mode pill and the in-page section
//     rail are the only carriers).

import { cleanup, render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentViewDensityToggle } from "@/components/document-viewer/section-nav";
import { ShowAllChip } from "@/components/show-all-chip";

afterEach(cleanup);

function classes(element: Element) {
  return element.className.split(/\s+/);
}

describe("live-control contrast (#7J47R1)", () => {
  it.each([true, false])("never dims the density toggle subtitle (compact=%s)", (compact) => {
    render(<DocumentViewDensityToggle compact={compact} onCompactChange={() => undefined} />);

    const subtitle = screen.getByText(compact ? "Long sections collapsed" : "All indexed text shown");
    for (let node: Element | null = subtitle; node; node = node.parentElement) {
      expect(classes(node).some((name) => /^opacity-/.test(name))).toBe(false);
      if (node.getAttribute("data-testid") === "document-view-density-toggle") break;
    }
  });

  it("paints the Show-all chip label in the strong accent", () => {
    render(<ShowAllChip href="/tools" icon={Wrench} ariaLabel="Show all tools" testId="tools-show-all" />);

    const link = screen.getByTestId("tools-show-all");
    const capsule = screen.getByText("Show all");
    const painted = [link, capsule].flatMap(classes).filter((name) => name.startsWith("text-[color:"));
    expect(painted).toContain("text-[color:var(--clinical-accent-strong)]");
    expect(painted).not.toContain("text-[color:var(--clinical-accent)]");
  });
});
